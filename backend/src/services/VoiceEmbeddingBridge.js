/**
 * VoiceEmbeddingBridge.js
 *
 * Phase 2: Node.js → Python bridge for VoiceEmbeddingService.py
 *
 * Spawns the Python script and parses JSON output.
 * All heavy ML work stays in Python; this file just manages the process.
 *
 * Usage:
 *   const bridge = require('./VoiceEmbeddingBridge');
 *   const result = await bridge.generateEmbedding('/path/to/audio.wav');
 *   const match  = await bridge.compareAudio('/path/ref.wav', '/path/meeting_seg.wav');
 *   const check  = await bridge.validateAudio('/path/to/audio.wav');
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to the Python script
const PY_SCRIPT = path.resolve(
  __dirname,
  '../../ai-layer/whisperX/VoiceEmbeddingService.py'
);

// Candidate Python executables — same pattern used by TranscriptionService
const VENV_CANDIDATES = [
  path.resolve(__dirname, '../../../venv/Scripts/python.exe'),   // root venv (Windows)
  path.resolve(__dirname, '../../../venv/bin/python'),            // root venv (Unix)
  path.resolve(__dirname, '../../venv/Scripts/python.exe'),
  path.resolve(__dirname, '../../venv/bin/python'),
];

/**
 * Get the Python executable path.
 * @returns {string|null}
 */
function getPython() {
  for (const candidate of VENV_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'python'; // System fallback
}

/**
 * Run VoiceEmbeddingService.py with the given arguments.
 * Returns the parsed JSON output from stdout.
 * @param {string[]} args - e.g. ['embed', '/path/to/audio.wav']
 * @param {number} timeoutMs - max execution time in ms (default 60s)
 * @returns {Promise<object>}
 */
function runPythonEmbedder(args, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const python = getPython();
    const proc = spawn(python, [PY_SCRIPT, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        KMP_DUPLICATE_LIB_OK: 'TRUE',
        OMP_NUM_THREADS: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => {
      const line = d.toString().trim();
      if (line) console.log(`[VoiceEmbedding/py] ${line}`);
      stderr += line + '\n';
    });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`VoiceEmbeddingService timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const raw = stdout.trim();
      if (!raw) {
        return reject(new Error(`No JSON output from Python (exit ${code}). Stderr: ${stderr.slice(0, 500)}`));
      }
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Failed to parse Python JSON output: ${raw.slice(0, 300)}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn Python: ${err.message}`));
    });
  });
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Generate a voice embedding for an audio file.
 *
 * @param {string} audioPath - Absolute path to the audio file
 * @returns {Promise<{
 *   status: string,
 *   embedding?: number[],
 *   dimensions?: number,
 *   snr_db?: number,
 *   duration_sec?: number,
 *   reason?: string
 * }>}
 */
async function generateEmbedding(audioPath) {
  console.log(`[VoiceEmbeddingBridge] Generating embedding for: ${path.basename(audioPath)}`);
  return runPythonEmbedder(['embed', audioPath]);
}

/**
 * Compare two audio files (signup sample vs. meeting segment).
 * Used in Tier 1 identification.
 *
 * @param {string} referenceAudioPath - The enrolled signup sample
 * @param {string} meetingAudioPath   - The diarized speaker segment
 * @returns {Promise<{
 *   status: string,
 *   similarity?: number,
 *   identified?: boolean,
 *   confidence_threshold?: number,
 *   tier?: number
 * }>}
 */
async function compareAudio(referenceAudioPath, meetingAudioPath) {
  console.log(`[VoiceEmbeddingBridge] Comparing audio files...`);
  return runPythonEmbedder(['compare', referenceAudioPath, meetingAudioPath]);
}

/**
 * Validate audio quality (SNR check + duration check).
 * Call this before accepting a signup sample from the user.
 *
 * @param {string} audioPath
 * @returns {Promise<{
 *   status: string,
 *   valid: boolean,
 *   snr_db?: number,
 *   duration_sec?: number,
 *   action?: string
 * }>}
 */
async function validateAudio(audioPath) {
  console.log(`[VoiceEmbeddingBridge] Validating audio: ${path.basename(audioPath)}`);
  return runPythonEmbedder(['validate', audioPath]);
}

/**
 * High-level: Generate embedding, validate and store it for a user.
 * Calls generateEmbedding + stores the result in user_voice_embeddings via
 * SpeakerIdentificationService.
 *
 * @param {number} userId
 * @param {string} audioPath
 * @param {object} prisma - Prisma client instance
 * @returns {Promise<{success: boolean, embeddingId?: string, reason?: string}>}
 */
async function enrollUserVoice(userId, audioPath, prisma) {
  const SpeakerIdentificationService = require('./SpeakerIdentificationService');

  // Check consent first
  const hasConsent = await SpeakerIdentificationService.hasConsent(userId);
  if (!hasConsent) {
    return { success: false, reason: 'user_has_not_given_biometric_consent' };
  }

  // Generate embedding
  const result = await generateEmbedding(audioPath);

  if (result.status !== 'ok') {
    console.warn(`[VoiceEmbeddingBridge] Enrollment rejected for user ${userId}: ${result.reason}`);
    return { success: false, reason: result.reason, snr_db: result.snr_db };
  }

  // Get current max version for this user
  const versions = await prisma.$queryRaw`
    SELECT MAX(version) as max_version 
    FROM user_voice_embeddings 
    WHERE user_id = ${userId} AND is_active = TRUE
  `;
  const nextVersion = (Number(versions[0]?.max_version) || 0) + 1;

  // Store the embedding into postgres
  // Note: pgvector stores as array literal: '[0.1, 0.2, ...]'
  const embeddingLiteral = `[${result.embedding.join(',')}]`;
  const insertResult = await prisma.$queryRaw`
    INSERT INTO user_voice_embeddings 
      (id, user_id, embedding, version, snr_score, is_active, created_at, updated_at)
    VALUES (
      gen_random_uuid()::text,
      ${userId},
      ${embeddingLiteral}::vector,
      ${nextVersion},
      ${result.snr_db},
      TRUE,
      NOW(),
      NOW()
    )
    RETURNING id
  `;

  const embeddingId = insertResult[0]?.id;
  console.log(`✅ [VoiceEmbeddingBridge] Enrolled user ${userId} — version ${nextVersion}, embedding ${embeddingId}`);

  return {
    success: true,
    embeddingId,
    version: nextVersion,
    snrDb: result.snr_db,
    dimensions: result.dimensions,
  };
}

module.exports = {
  generateEmbedding,
  compareAudio,
  validateAudio,
  enrollUserVoice,
};
