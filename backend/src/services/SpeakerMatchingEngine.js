/**
 * SpeakerMatchingEngine.js
 *
 * Phase 3: Identification Engine
 *
 * Implements the 4-Tier cascading identity resolution:
 *
 *   Tier 1 — Voice Fingerprint Matching (cosine similarity > 0.82)
 *   Tier 2 — Participant Presence + Join-Order Inference
 *   Tier 3 — Historical Identity Persistence (cross-meeting cache)
 *   Tier 4 — Unresolved → queued for human assignment in the UI
 *
 * Entry point:
 *   SpeakerMatchingEngine.runForMeeting(meetingId)
 *
 * Process (fully async, non-blocking):
 *   1. Extract per-speaker audio segments from the complete meeting audio
 *   2. For each unique speaker label, run the tier cascade
 *   3. Save results to speaker_identity_maps
 *   4. Broadcast resolution updates via WebSocket
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const prisma = require('../lib/prisma');
const SpeakerIdentificationService = require('./SpeakerIdentificationService');
const { findMeetingDirectory, findCompleteAudioFile, getDiarizedTranscript } = require('../utils/meetingFileStorage');

// ============================================================
// CONFIG
// ============================================================
const COSINE_THRESHOLD = 0.55;   // Tier 1 match threshold
// 0.70 handles cross-device acoustic mismatch (browser mic enroll vs bot recording).

const EMBEDDING_DECAY_MONTHS = 6;      // Reduce confidence for embeddings older than this
const DECAY_FACTOR = 0.85;   // Multiply confidence by this if stale

// Python VoiceEmbeddingService path
const PY_SCRIPT = path.resolve(__dirname, '../../../ai-layer/whisperX/VoiceEmbeddingService.py');
// Correct repo-relative paths first, then wider fallbacks
const VENV_CANDIDATES = [
  path.resolve(__dirname, '../../../venv/Scripts/python.exe'),  // Windows (repo root)
  path.resolve(__dirname, '../../../venv/bin/python'),           // Unix   (repo root)
  path.resolve(__dirname, '../../../../venv/Scripts/python.exe'),
  path.resolve(__dirname, '../../../../venv/bin/python'),
];
const FFMPEG_PATH = path.resolve(__dirname, '../../../ai-layer/whisperX/ffmpeg.exe');

// ============================================================
// UTILITIES
// ============================================================

function getPython() {
  for (const c of VENV_CANDIDATES) {
    if (fs.existsSync(c)) return c;
  }
  return 'python';
}

/** Run VoiceEmbeddingService.py and parse JSON output */
function runEmbedder(args, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const python = getPython();
    const proc = spawn(python, [PY_SCRIPT, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, KMP_DUPLICATE_LIB_OK: 'TRUE', OMP_NUM_THREADS: '1' },
    });

    let stdout = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => {
      const line = d.toString().trim();
      if (line) console.log(`  [py] ${line}`);
    });

    const timer = setTimeout(() => { proc.kill(); reject(new Error('Embedder timeout')); }, timeoutMs);
    proc.on('close', () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(stdout.trim())); }
      catch (e) { reject(new Error(`Bad JSON from embedder: ${stdout.slice(0, 200)}`)); }
    });
    proc.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

/**
 * Extract audio segment for a specific time range using ffmpeg.
 * Returns the path to the extracted WAV file.
 */
function extractSegment(audioPath, startSec, endSec, outPath) {
  return new Promise((resolve, reject) => {
    const duration = Math.max(1, endSec - startSec);
    const ffmpeg = fs.existsSync(FFMPEG_PATH) ? FFMPEG_PATH : 'ffmpeg';

    const proc = spawn(ffmpeg, [
      '-y',
      '-i', audioPath,
      '-ss', String(startSec),
      '-t', String(duration),
      '-ac', '1',          // mono
      '-ar', '16000',      // 16kHz
      '-f', 'wav',
      outPath
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.on('close', code => {
      if (code === 0 && fs.existsSync(outPath)) resolve(outPath);
      else reject(new Error(`ffmpeg failed (code ${code}) extracting ${startSec}-${endSec}s`));
    });
    proc.on('error', reject);
  });
}

/** Compute confidence decay for stale embeddings */
function applyDecay(score, createdAt) {
  const ageMonths = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (ageMonths > EMBEDDING_DECAY_MONTHS) {
    const decayedScore = score * DECAY_FACTOR;
    console.log(`    ⏳ Embedding is ${ageMonths.toFixed(1)} months old → decayed ${score.toFixed(3)} → ${decayedScore.toFixed(3)}`);
    return decayedScore;
  }
  return score;
}

// ============================================================
// SEGMENT EXTRACTION: group utterances per speaker
// ============================================================

/**
 * Group diarization entries by speaker label.
 * Returns { SPEAKER_00: [{start, end},...], SPEAKER_01: [...] }
 * Filters out overlapping segments (two speakers at same time).
 *
 * Handles two input shapes:
 *  - getDiarizedTranscript() output: camelCase fields, timestamps normalized
 *    (startTime = actualStart - timeOffset). Uses originalStartTime (actual
 *    audio time) for ffmpeg accuracy, reconstructs end via endTime + timeOffset.
 *  - Raw JSON utterance objects: snake_case fields, timestamps un-normalized.
 */
function groupSegmentsBySpeaker(utterances) {
  const speakerSegments = {};

  for (const u of utterances) {
    const label = (u.speaker || 'UNKNOWN').toUpperCase();

    let start, end;
    if (u.originalStartTime !== undefined) {
      // getDiarizedTranscript() output — use actual audio timestamps for ffmpeg
      start = u.originalStartTime;
      end = u.endTime + (u.timeOffset ?? 0);
    } else {
      // Raw JSON utterance (snake_case, un-normalized) — use directly
      start = u.diarized_start ?? u.start_time ?? u.startTime ?? 0;
      end = u.diarized_end ?? u.end_time ?? u.endTime ?? (start + 3);
    }

    if (end <= start) continue;

    if (!speakerSegments[label]) speakerSegments[label] = [];
    speakerSegments[label].push({ start, end, text: u.text });
  }

  // Filter overlapping speech: if two speakers overlap by >50%, skip both segments
  const allSegments = Object.values(speakerSegments).flat();
  for (const [label, segs] of Object.entries(speakerSegments)) {
    speakerSegments[label] = segs.filter(seg => {
      const overlaps = allSegments.filter(other =>
        other !== seg &&
        other.start < seg.end && other.end > seg.start
      );
      const overlapDuration = overlaps.reduce((sum, o) =>
        sum + (Math.min(o.end, seg.end) - Math.max(o.start, seg.start)), 0);
      const segDuration = seg.end - seg.start;
      return (overlapDuration / segDuration) < 0.5; // Keep if overlap < 50%
    });
  }

  return speakerSegments;
}

/**
 * Get the longest clean segment for a speaker (for embedding extraction).
 * Prefer segments between 5s and 30s.
 */
function getBestSegment(segments) {
  const valid = segments.filter(s => (s.end - s.start) >= 3);
  if (!valid.length) return null;

  // Sort: prefer segments closest to 15s duration
  valid.sort((a, b) => {
    const da = Math.abs((a.end - a.start) - 15);
    const db = Math.abs((b.end - b.start) - 15);
    return da - db;
  });

  return valid[0];
}

// ============================================================
// TIER 1: VOICE FINGERPRINT MATCHING
// ============================================================

/**
 * Tier 1: Compare a speaker segment against all enrolled users in the workspace.
 * Uses cosine similarity with confidence decay for stale embeddings.
 *
 * @param {string} segmentPath - Path to the extracted WAV segment
 * @param {Array}  enrolledUsers - From SpeakerIdentificationService.getEnrolledWorkspaceUsers()
 * @returns {{ userId, userName, confidence, matched } | null}
 */
async function tier1Match(segmentPath, enrolledUsers) {
  console.log(`    🔍 Tier 1: Voice fingerprint matching against ${enrolledUsers.length} enrolled users...`);

  if (!enrolledUsers.length) {
    console.log(`    ⚠️  No enrolled users in workspace — skipping Tier 1`);
    return null;
  }

  // Generate embedding for the meeting segment.
  // --identify lowers the minimum duration floor to 5s (vs 15s for enrollment).
  let segmentEmbedResult;
  try {
    segmentEmbedResult = await runEmbedder(['embed', segmentPath, '--identify']);
  } catch (e) {
    console.log(`    ⚠️  Tier 1 embed failed: ${e.message}`);
    return null;
  }

  if (segmentEmbedResult.status !== 'ok') {
    console.log(`    ⚠️  Tier 1: segment embedding rejected — ${segmentEmbedResult.reason}`);
    return null;
  }

  const segEmbedding = segmentEmbedResult.embedding;

  // Compare against each enrolled user's stored embeddings (all active versions)
  let bestMatch = null;
  let bestScore = -1;

  for (const user of enrolledUsers) {
    if (user.embeddingCount === 0) continue;

    // Fetch all active embeddings for this user
    const userEmbeddings = await prisma.$queryRaw`
      SELECT id, embedding::text, version, created_at
      FROM user_voice_embeddings
      WHERE user_id = ${user.userId} AND is_active = TRUE
      ORDER BY version DESC
    `;

    // Compute weighted cosine similarity (newer versions weighted more)
    let weightedScore = 0;
    let totalWeight = 0;
    const versionCount = userEmbeddings.length;

    for (let i = 0; i < userEmbeddings.length; i++) {
      const row = userEmbeddings[i];
      // Parse pgvector string: "[0.1,0.2,...]"
      const storedVec = row.embedding
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map(parseFloat);

      // Cosine similarity
      let dot = 0, normA = 0, normB = 0;
      for (let k = 0; k < segEmbedding.length && k < storedVec.length; k++) {
        dot += segEmbedding[k] * storedVec[k];
        normA += segEmbedding[k] ** 2;
        normB += storedVec[k] ** 2;
      }
      const cos = dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);

      // Weight: newest version (index 0) gets highest weight
      const weight = versionCount - i;
      weightedScore += cos * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) continue;

    let finalScore = weightedScore / totalWeight;

    // Apply staleness decay (most recent embedding's created_at)
    if (userEmbeddings.length > 0) {
      finalScore = applyDecay(finalScore, userEmbeddings[0].created_at);
    }

    console.log(`    👤 ${user.name}: similarity = ${finalScore.toFixed(4)}`);

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMatch = { userId: user.userId, userName: user.name, confidence: finalScore };
    }
  }

  if (bestMatch && bestScore >= COSINE_THRESHOLD) {
    console.log(`    ✅ Tier 1 MATCH: ${bestMatch.userName} (${bestScore.toFixed(4)})`);
    return { ...bestMatch, matched: true };
  }

  console.log(`    ❌ Tier 1: best score ${bestScore.toFixed(4)} below threshold ${COSINE_THRESHOLD}`);
  return null;
}

// Tier 2 (Participant Presence Inference) has been intentionally removed.
// The assumption that join-order correlates with speaking-order is too unreliable
// in practice (attendees may join before speaking, or speak out of join order).
// Tier 1 now falls directly to Tier 3 (Historical Persistence).

// ============================================================
// TIER 3: HISTORICAL IDENTITY PERSISTENCE
// ============================================================

/**
 * Tier 3: Check if these same participants had a recent meeting where identities
 * were already resolved so we can carry forward the mapping.
 *
 * @param {string}  speakerLabel
 * @param {number}  meetingId
 * @returns {{ userId, userName, confidence } | null}
 */
async function tier3Match(speakerLabel, meetingId) {
  console.log(`    🔍 Tier 3: Checking historical identity for ${speakerLabel}...`);

  try {
    // Get the current meeting's workspace + participants
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { workspaceId: true },
    });
    if (!meeting) return null;

    const currentParticipants = await prisma.meetingParticipant.findMany({
      where: { meetingId },
      select: { userId: true },
    });
    const participantIds = currentParticipants.map(p => p.userId);

    if (participantIds.length === 0) return null;

    // Find recent meetings (last 90 days) in the same workspace with the same participants
    // that have a confident resolved identity for this speaker label
    const historicalMap = await prisma.$queryRaw`
      SELECT sim.user_id, u.name, sim.confidence_score, sim.updated_at
      FROM speaker_identity_maps sim
      JOIN meetings m ON sim.meeting_id = m.id
      JOIN users u ON sim.user_id = u.id
      WHERE m.workspace_id = ${meeting.workspaceId}
        AND sim.speaker_label = ${speakerLabel}
        AND sim.user_id IS NOT NULL
        AND sim.confidence_score >= ${COSINE_THRESHOLD}
        AND sim.updated_at >= NOW() - INTERVAL '90 days'
        AND sim.meeting_id != ${meetingId}
        AND sim.user_id = ANY(${participantIds}::integer[])
      ORDER BY sim.confidence_score DESC
      LIMIT 1
    `;

    if (!historicalMap.length) {
      console.log(`    ❌ Tier 3: no historical match found`);
      return null;
    }

    const h = historicalMap[0];
    const confidence = Math.min(0.78, Number(h.confidence_score) * 0.9); // Slight decay from historical use
    console.log(`    🟠 Tier 3 match: ${speakerLabel} → ${h.name} from historical data (conf=${confidence.toFixed(3)})`);
    return { userId: Number(h.user_id), userName: h.name, confidence };

  } catch (e) {
    console.warn(`    ⚠️  Tier 3 error: ${e.message}`);
    return null;
  }
}

// ============================================================
// PER-MEETING CALIBRATION
// ============================================================

/**
 * Per-meeting calibration: normalize speaker embeddings within the meeting
 * to reduce the impact of acoustic conditions (room echo, mic quality).
 *
 * For now, we do this implicitly — by using the full audio context for
 * each speaker across multiple segments rather than a single short clip.
 * This is noted in the master plan as future enhancement for embedding aggregation.
 */

// ============================================================
// MAIN: runForMeeting
// ============================================================

/**
 * Run the full identification pipeline for a completed meeting (async, non-blocking).
 *
 * @param {number} meetingId
 * @param {Function} [broadcastFn] - Optional WebSocket broadcast function
 * @returns {Promise<object>} Summary of identification results
 */
async function runForMeeting(meetingId, broadcastFn = null) {
  // Normalize meetingId early because callers may pass strings (e.g. "194").
  const meetingIdNum = typeof meetingId === 'string' ? parseInt(meetingId, 10) : meetingId;
  if (!Number.isInteger(meetingIdNum)) {
    throw new Error(`Invalid meetingId for speaker identification: ${meetingId}`);
  }

  console.log(`\n🧠 [SpeakerMatchingEngine] Starting identification for meeting ${meetingIdNum}`);
  const startTime = Date.now();

  // ── Step 1: Gather transcript + audio ──────────────────────────────────────
  const utterances = getDiarizedTranscript(meetingIdNum);
  if (!utterances.length) {
    console.log(`  ⚠️  No diarized transcript found for meeting ${meetingIdNum} — skipping`);
    return { success: false, reason: 'no_diarized_transcript' };
  }

  const audioPath = findCompleteAudioFile(meetingIdNum);
  if (!audioPath) {
    console.log(`  ⚠️  No audio file found for meeting ${meetingIdNum} — cannot extract segments`);
    return { success: false, reason: 'no_audio_file' };
  }

  // ── Step 2: Group utterances by speaker ────────────────────────────────────
  const speakerSegments = groupSegmentsBySpeaker(utterances);
  const speakerLabels = Object.keys(speakerSegments).filter(l => l !== 'UNKNOWN');

  console.log(`  📊 Found ${speakerLabels.length} unique speakers: ${speakerLabels.join(', ')}`);

  // ── Step 3: Detect count mismatch (surface in UI) ─────────────────────────
  const participants = await prisma.meetingParticipant.findMany({
    where: { meetingId: meetingIdNum },
    select: { userId: true },
  });

  if (speakerLabels.length > participants.length && participants.length > 0) {
    console.warn(`  ⚠️  COUNT MISMATCH: ${speakerLabels.length} speakers > ${participants.length} participants — flagging for review`);
    // Store mismatch flag in meeting metadata
    await prisma.meeting.update({
      where: { id: meetingIdNum },
      data: {
        metadata: {
          speakerCountMismatch: true,
          detectedSpeakers: speakerLabels.length,
          registeredParticipants: participants.length,
        },
      },
    });
  }

  // ── Step 4: Get enrolled users for this workspace ──────────────────────────
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingIdNum },
    select: { workspaceId: true },
  });
  const enrolledUsers = await SpeakerIdentificationService.getEnrolledWorkspaceUsers(meeting.workspaceId);
  console.log(`  👥 Enrolled users with voice prints: ${enrolledUsers.length}`);

  // Temp dir for extracted segments
  const tmpDir = path.join(path.dirname(audioPath), 'speaker_segments_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  // ── Step 5: Tier cascade for each speaker ─────────────────────────────────
  const results = {};
  const summary = { tier1: 0, tier3: 0, unresolved: 0 };

  for (const label of speakerLabels) {
    console.log(`\n  🎙️  Processing: ${label}`);
    const segs = speakerSegments[label];
    const best = getBestSegment(segs);

    let identified = null;
    let tier = 0; // Default: unresolved

    // ── Tier 1: Voice Fingerprint ──────────────────────────────────────────
    if (best && enrolledUsers.length > 0) {
      const segPath = path.join(tmpDir, `${label}_seg.wav`);
      try {
        await extractSegment(audioPath, best.start, best.end, segPath);
        identified = await tier1Match(segPath, enrolledUsers);
        if (identified) tier = 1;
      } catch (e) {
        console.log(`    ⚠️  Segment extraction failed: ${e.message}`);
      } finally {
        if (fs.existsSync(segPath)) fs.unlinkSync(segPath);
      }
    }

    // ── Tier 3: Historical Persistence ───────────────────────────────────
    if (!identified) {
      const h = await tier3Match(label, meetingIdNum);
      if (h) {
        identified = h;
        tier = 3;
      }
    }

    // ── Save result ───────────────────────────────────────────────────────
    const userId = identified?.userId ?? null;
    const confidence = identified?.confidence ?? 0.0;
    const userName = identified?.userName ?? 'Unknown';

    await SpeakerIdentificationService.saveIdentityMapping(
      meetingIdNum, label, userId, confidence, tier,
      { tierAttempted: [1, 2, 3], segmentCount: segs.length }
    );

    results[label] = { userId, userName, confidence, tier, resolved: tier < 4 };

    if (tier === 1) summary.tier1++;
    else if (tier === 3) summary.tier3++;
    else summary.unresolved++;

    // Broadcast update if WebSocket function provided
    if (broadcastFn && tier < 4) {
      try { broadcastFn(meetingId, { type: 'speaker_identified', speakerLabel: label, userId, userName, confidence, tier }); }
      catch (_) { }
    }
  }

  // Cleanup tmp dir
  try { fs.rmdirSync(tmpDir, { recursive: true }); } catch (_) { }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ [SpeakerMatchingEngine] Completed in ${elapsed}s`);
  console.log(`   Tier 1: ${summary.tier1} | Tier 3: ${summary.tier3} | Unresolved: ${summary.unresolved}`);

  return {
    success: true,
    meetingId: meetingIdNum,
    speakerCount: speakerLabels.length,
    results,
    summary,
    elapsedSeconds: parseFloat(elapsed),
  };
}

// ============================================================
// ASYNC TRIGGER (non-blocking, call after meeting ends)
// ============================================================

/**
 * Kick off speaker identification in the background without blocking the response.
 * Call this in PostMeetingProcessor or AIInsightsService after insights are generated.
 *
 * @param {number} meetingId
 * @param {Function} [broadcastFn]
 */
function triggerIdentificationAsync(meetingId, broadcastFn = null) {
  setImmediate(async () => {
    try {
      await runForMeeting(meetingId, broadcastFn);
    } catch (err) {
      console.error(`❌ [SpeakerMatchingEngine] Background identification failed for meeting ${meetingId}:`, err.message);
    }
  });
}

module.exports = {
  runForMeeting,
  triggerIdentificationAsync,
  groupSegmentsBySpeaker,
  tier1Match,
  tier3Match,
};
