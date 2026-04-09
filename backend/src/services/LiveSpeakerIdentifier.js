/**
 * LiveSpeakerIdentifier.js
 *
 * Per-meeting service that identifies the speaker in each ~3s audio chunk
 * during a live meeting.
 *
 * Approach:
 *   1. At meeting start, loads enrolled workspace users' voice embeddings into memory.
 *   2. For each chunk: requests an embedding via EmbeddingServerProcess (long-lived Python).
 *   3. Computes cosine similarity in Node against all in-memory enrolled profiles.
 *   4. Applies a sliding-window majority vote (last 4 chunks) to smooth label flicker.
 *   5. Returns identified speaker name + userId, or null if no confident match.
 *
 * Modularity:
 *   Set LIVE_SPEAKER_ID_ENABLED = false to disable the entire feature globally.
 *   Alternatively, simply don't call initLiveSpeakerIdentification() in AudioRecorder.
 *   All identification is non-blocking and non-fatal — existing transcription is unaffected.
 */

const prisma = require('../lib/prisma');
const embeddingServer = require('./EmbeddingServerProcess');

// ─── Tuneable constants ───────────────────────────────────────────────────────

/** Master on/off switch — set false to disable without removing integration code. */
const LIVE_SPEAKER_ID_ENABLED = true;

/** Minimum cosine similarity to accept a match (lower than post-meeting 0.72 to account for 3s audio). */
const LIVE_THRESHOLD = 0.55;

/** Number of recent chunk results kept for majority vote. */
const WINDOW_SIZE = 4;

/** Minimum votes (of WINDOW_SIZE) needed before committing a label. */
const MIN_VOTES_TO_CONFIRM = 2;

// ─────────────────────────────────────────────────────────────────────────────

class LiveSpeakerIdentifier {
  /**
   * @param {number|string} meetingId
   */
  constructor(meetingId) {
    this.meetingId = typeof meetingId === 'string' ? parseInt(meetingId, 10) : meetingId;
    this.enabled = false;
    /** @type {Array<{userId: number, userName: string, embedding: Float32Array}>} */
    this.enrolledProfiles = [];
    /**
     * Circular buffer of last WINDOW_SIZE chunk identification results.
     * Each entry: { userId: number, userName: string, score: number } or null (no match).
     */
    this.chunkWindow = [];
  }

  // ─── Initialisation ────────────────────────────────────────────────────────

  /**
   * Load enrolled workspace members' voice embeddings from the DB.
   * Must be called once before the first identifyChunk() call.
   * Safe to call even if no users are enrolled — sets enabled=false and returns.
   */
  async initialize() {
    if (!LIVE_SPEAKER_ID_ENABLED) {
      console.log(`[LiveSpeakerID] Feature disabled (LIVE_SPEAKER_ID_ENABLED=false) for meeting ${this.meetingId}`);
      return;
    }

    try {
      // Resolve workspace from meeting
      const meeting = await prisma.$queryRaw`
        SELECT workspace_id FROM meetings WHERE id = ${this.meetingId} LIMIT 1
      `;
      if (!meeting || meeting.length === 0) {
        console.warn(`[LiveSpeakerID] Meeting ${this.meetingId} not found — live ID disabled`);
        return;
      }
      const workspaceId = meeting[0].workspace_id;

      // Load enrolled users + their embeddings for this workspace
      const rows = await prisma.$queryRaw`
        SELECT
          u.id        AS user_id,
          u.name      AS user_name,
          uve.embedding::text AS embedding_str
        FROM user_voice_embeddings uve
        JOIN users u ON u.id = uve.user_id
        WHERE uve.is_active = TRUE
          AND u.biometric_consent = TRUE
          AND u.id IN (
            SELECT user_id FROM workspace_members
            WHERE workspace_id = ${workspaceId}
              AND is_active = TRUE
          )
        ORDER BY uve.created_at DESC
      `;

      if (!rows || rows.length === 0) {
        console.log(`[LiveSpeakerID] No enrolled users in workspace ${workspaceId} — live ID disabled for meeting ${this.meetingId}`);
        return;
      }

      // Deduplicate: keep latest embedding per user, parse pgvector string → Float32Array
      const seen = new Set();
      for (const row of rows) {
        if (seen.has(row.user_id)) continue;
        seen.add(row.user_id);

        const embStr = row.embedding_str; // "[0.1,0.2,...]"
        if (!embStr) continue;

        try {
          const arr = JSON.parse(embStr);
          this.enrolledProfiles.push({
            userId:   Number(row.user_id),
            userName: row.user_name,
            embedding: new Float32Array(arr),
          });
        } catch (e) {
          console.warn(`[LiveSpeakerID] Could not parse embedding for user ${row.user_id}: ${e.message}`);
        }
      }

      if (this.enrolledProfiles.length === 0) {
        console.log(`[LiveSpeakerID] No valid embeddings parsed — live ID disabled for meeting ${this.meetingId}`);
        return;
      }

      this.enabled = true;
      console.log(`[LiveSpeakerID] Ready for meeting ${this.meetingId} — ${this.enrolledProfiles.length} enrolled profile(s): ${this.enrolledProfiles.map(p => p.userName).join(', ')}`);
    } catch (err) {
      // Non-fatal — live ID just won't run
      console.warn(`[LiveSpeakerID] Initialization failed for meeting ${this.meetingId} (non-fatal): ${err.message}`);
    }
  }

  // ─── Cosine similarity (pure JS, no Python needed for comparison) ──────────

  /**
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @returns {number} cosine similarity in [-1, 1]
   */
  _cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot   += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find the best matching enrolled profile for the given query embedding.
   * @param {Float32Array} queryEmbedding
   * @returns {{ userId: number, userName: string, score: number } | null}
   */
  _bestMatch(queryEmbedding) {
    let best = null;
    for (const profile of this.enrolledProfiles) {
      const score = this._cosineSimilarity(queryEmbedding, profile.embedding);
      if (!best || score > best.score) {
        best = { userId: profile.userId, userName: profile.userName, score };
      }
    }
    if (!best || best.score < LIVE_THRESHOLD) return null;
    return best;
  }

  // ─── Sliding-window majority vote ─────────────────────────────────────────

  /**
   * From the current chunkWindow, return the most-voted userId if it meets the
   * minimum vote threshold, along with the average score of the winning chunks.
   * @returns {{ userId: number, userName: string, avgScore: number } | null}
   */
  _majorityVote() {
    const votes = new Map(); // userId → { count, userName, totalScore }
    for (const entry of this.chunkWindow) {
      if (!entry) continue;
      const existing = votes.get(entry.userId);
      if (existing) {
        existing.count++;
        existing.totalScore += entry.score;
      } else {
        votes.set(entry.userId, { count: 1, userName: entry.userName, totalScore: entry.score });
      }
    }

    let winner = null;
    let winnerCount = 0;
    for (const [userId, { count, userName, totalScore }] of votes) {
      if (count >= MIN_VOTES_TO_CONFIRM && count > winnerCount) {
        winner = { userId, userName, avgScore: totalScore / count };
        winnerCount = count;
      }
    }
    return winner;
  }

  // ─── Main public method ────────────────────────────────────────────────────

  /**
   * Identify the speaker in a single audio chunk.
   * Returns null if disabled, no match found, or any error occurs.
   * Always non-blocking relative to the transcription pipeline.
   *
   * @param {string} audioPath - Absolute path to the chunk WAV/WebM file
   * @param {number} chunkIndex - Chunk sequence number from TranscriptionService
   * @returns {Promise<{
   *   userId: number,
   *   userName: string,
   *   confidence: number,
   *   chunkIndex: number,
   *   isLive: true
   * } | null>}
   */
  async identifyChunk(audioPath, chunkIndex) {
    if (!this.enabled) return null;

    try {
      // Request embedding from long-lived Python process
      const result = await embeddingServer.embed(audioPath);

      if (result.status !== 'ok' || !result.embedding) {
        // 'skip' (too short, noisy, timeout) or 'error' — push null into window
        console.log(`[LiveSpeakerID] chunk ${chunkIndex}: skipped by Python (${result.reason ?? result.status})`);
        this.chunkWindow.push(null);
        if (this.chunkWindow.length > WINDOW_SIZE) this.chunkWindow.shift();
        return null;
      }

      const match = this._bestMatch(result.embedding);

      if (match) {
        console.log(`[LiveSpeakerID] chunk ${chunkIndex}: matched ${match.userName} (score=${match.score.toFixed(3)}, snr=${result.snr_db}dB, dur=${result.duration_sec}s)`);
      } else {
        // Log best score even when below threshold to help tune LIVE_THRESHOLD
        let bestScore = 0;
        for (const profile of this.enrolledProfiles) {
          const s = this._cosineSimilarity(result.embedding, profile.embedding);
          if (s > bestScore) bestScore = s;
        }
        console.log(`[LiveSpeakerID] chunk ${chunkIndex}: no match (best score=${bestScore.toFixed(3)} < threshold=${LIVE_THRESHOLD}, snr=${result.snr_db}dB, dur=${result.duration_sec}s)`);
      }

      // Push result into sliding window (null if below threshold)
      this.chunkWindow.push(
        match ? { userId: match.userId, userName: match.userName, score: match.score } : null
      );
      if (this.chunkWindow.length > WINDOW_SIZE) this.chunkWindow.shift();

      // Only broadcast once we have enough window entries for a stable vote
      if (this.chunkWindow.length < MIN_VOTES_TO_CONFIRM) return null;

      const voted = this._majorityVote();
      if (!voted) return null;

      console.log(`[LiveSpeakerID] chunk ${chunkIndex}: window vote → ${voted.userName} (avgScore=${voted.avgScore.toFixed(3)})`);
      return {
        userId:     voted.userId,
        userName:   voted.userName,
        confidence: voted.avgScore, // average score across winning window entries (accurate)
        chunkIndex,
        isLive:     true,
      };
    } catch (e) {
      // Always non-fatal — never let this crash the transcription pipeline
      return null;
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  cleanup() {
    this.chunkWindow = [];
    this.enabled = false;
    console.log(`[LiveSpeakerID] Cleaned up for meeting ${this.meetingId}`);
  }
}

module.exports = LiveSpeakerIdentifier;
