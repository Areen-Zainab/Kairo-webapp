/**
 * EmbeddingServerProcess.js
 *
 * Global singleton that manages a single long-lived Python process running
 * VoiceEmbeddingService.py in --server mode.
 *
 * Keeps the ECAPA-TDNN encoder warm between requests so per-chunk overhead is
 * <100ms after the first call (vs 3-5s model-load overhead per subprocess spawn).
 *
 * Protocol (newline-delimited JSON over stdin/stdout):
 *   request:  {"reqId":"abc","action":"embed_live","path":"/abs/path.wav"}\n
 *   response: {"reqId":"abc","status":"ok","embedding":[...],"snr_db":18.2}\n
 *            {"reqId":"abc","status":"skip","reason":"snr_too_low"}\n
 *
 * Usage:
 *   const embeddingServer = require('./EmbeddingServerProcess');
 *   const result = await embeddingServer.embed('/abs/path/chunk.wav');
 *   // result: { status: 'ok', embedding: Float32Array, snr_db: 18.2 }
 *   // result: { status: 'skip', reason: 'snr_too_low' }
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PY_SCRIPT = path.resolve(
  __dirname,
  '../../../ai-layer/whisperX/VoiceEmbeddingService.py'
);

const VENV_CANDIDATES = [
  path.resolve(__dirname, '../../../venv/Scripts/python.exe'),
  path.resolve(__dirname, '../../../venv/bin/python'),
  path.resolve(__dirname, '../../venv/Scripts/python.exe'),
  path.resolve(__dirname, '../../venv/bin/python'),
];

const MAX_RESTART_ATTEMPTS = 3;
const RESTART_BASE_DELAY_MS = 2000;
/** Default per-request timeout once encoder is warm. */
const DEFAULT_TIMEOUT_MS = 10000;
/**
 * Timeout for the FIRST request, which pays the cold-start penalty of loading the
 * SpeechBrain encoder (~5-15s on Windows/CPU). Subsequent requests use DEFAULT_TIMEOUT_MS.
 */
const FIRST_REQUEST_TIMEOUT_MS = 35000;
/** After this many ms of uptime without a crash, reset the restart counter. */
const RESTART_COUNTER_RESET_MS = 60000;

class EmbeddingServerProcess {
  constructor() {
    this.proc = null;
    this.pending = new Map();   // reqId → { resolve, reject, timer }
    this.nextId = 1;
    this.lineBuffer = '';
    this.restartAttempts = 0;
    this.starting = false;
    this.stopped = false;       // set true when stop() is called; disables auto-restart
    this._resetTimer = null;    // timer that resets restartAttempts after stable uptime
    this.encoderReady = false;  // flips to true after first successful ok response
  }

  // ─── Python executable resolution ────────────────────────────────────────

  _getPython() {
    for (const c of VENV_CANDIDATES) {
      if (fs.existsSync(c)) return c;
    }
    return 'python';
  }

  // ─── Process lifecycle ────────────────────────────────────────────────────

  _start() {
    if (this.proc || this.starting) return;
    this.starting = true;

    const python = this._getPython();
    console.log(`[EmbeddingServer] Starting persistent Python process (${path.basename(python)})`);

    this.proc = spawn(python, [PY_SCRIPT, '--server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, KMP_DUPLICATE_LIB_OK: 'TRUE', OMP_NUM_THREADS: '1' },
    });

    this.lineBuffer = '';

    this.proc.stdout.on('data', (chunk) => {
      this.lineBuffer += chunk.toString();
      let nl;
      while ((nl = this.lineBuffer.indexOf('\n')) !== -1) {
        const line = this.lineBuffer.slice(0, nl).trim();
        this.lineBuffer = this.lineBuffer.slice(nl + 1);
        if (line) this._handleResponse(line);
      }
    });

    this.proc.stderr.on('data', (d) => {
      const line = d.toString().trim();
      if (line) console.log(`[EmbeddingServer/py] ${line}`);
    });

    // Schedule restartAttempts reset after stable uptime
    if (this._resetTimer) clearTimeout(this._resetTimer);
    this._resetTimer = setTimeout(() => {
      this.restartAttempts = 0;
    }, RESTART_COUNTER_RESET_MS);

    this.proc.on('close', (code) => {
      if (this._resetTimer) { clearTimeout(this._resetTimer); this._resetTimer = null; }
      console.warn(`[EmbeddingServer] Python process exited (code ${code})`);
      this.proc = null;
      this.starting = false;
      this._handleCrash();
    });

    this.proc.on('error', (err) => {
      if (this._resetTimer) { clearTimeout(this._resetTimer); this._resetTimer = null; }
      console.error(`[EmbeddingServer] Failed to spawn Python: ${err.message}`);
      this.proc = null;
      this.starting = false;
      this._handleCrash();
    });

    this.starting = false;
  }

  _handleResponse(rawLine) {
    let parsed;
    try {
      parsed = JSON.parse(rawLine);
    } catch (e) {
      console.warn(`[EmbeddingServer] Unparseable stdout line: ${rawLine.slice(0, 200)}`);
      return;
    }

    const reqId = parsed.reqId;
    if (!reqId) return;

    const pending = this.pending.get(reqId);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(reqId);

    // Convert embedding array → Float32Array for efficient in-memory cosine math
    if (parsed.status === 'ok' && Array.isArray(parsed.embedding)) {
      parsed.embedding = new Float32Array(parsed.embedding);
    }

    // Mark encoder as warm after first successful response
    if (!this.encoderReady && (parsed.status === 'ok' || parsed.status === 'skip')) {
      this.encoderReady = true;
    }

    pending.resolve(parsed);
  }

  _handleCrash() {
    this.encoderReady = false; // next restart pays cold-start again
    // Reject all pending requests immediately
    for (const [, { reject, timer }] of this.pending) {
      clearTimeout(timer);
      reject(new Error('EmbeddingServer: Python process crashed'));
    }
    this.pending.clear();

    if (this.stopped) return;

    // Exponential-backoff restart
    if (this.restartAttempts < MAX_RESTART_ATTEMPTS) {
      const delay = RESTART_BASE_DELAY_MS * Math.pow(2, this.restartAttempts);
      this.restartAttempts++;
      console.warn(`[EmbeddingServer] Restarting in ${delay}ms (attempt ${this.restartAttempts}/${MAX_RESTART_ATTEMPTS})`);
      setTimeout(() => this._start(), delay);
    } else {
      console.error('[EmbeddingServer] Max restart attempts reached — live speaker ID disabled until server restart');
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Generate an embedding for a live audio chunk.
   * Starts the Python server on first call (lazy init).
   *
   * @param {string} audioPath - Absolute path to the audio file
   * @param {number} [timeoutMs] - Max wait time in ms (default 10s)
   * @returns {Promise<{
   *   status: 'ok' | 'skip' | 'error',
   *   embedding?: Float32Array,
   *   snr_db?: number,
   *   duration_sec?: number,
   *   reason?: string
   * }>}
   */
  async embed(audioPath, timeoutMs = null) {
    // Use a longer timeout on the first call to cover encoder cold-start (~5-15s)
    if (timeoutMs === null) {
      timeoutMs = this.encoderReady ? DEFAULT_TIMEOUT_MS : FIRST_REQUEST_TIMEOUT_MS;
    }
    if (!this.proc) this._start();

    // If still no proc after start (spawn failed immediately), reject
    if (!this.proc) {
      return { status: 'skip', reason: 'server_unavailable' };
    }

    return new Promise((resolve, reject) => {
      const reqId = String(this.nextId++);

      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        resolve({ status: 'skip', reason: 'timeout' }); // non-fatal timeout
      }, timeoutMs);

      this.pending.set(reqId, { resolve, reject, timer });

      try {
        const msg = JSON.stringify({ reqId, action: 'embed_live', path: audioPath }) + '\n';
        this.proc.stdin.write(msg);
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(reqId);
        resolve({ status: 'skip', reason: `stdin_write_error: ${e.message}` });
      }
    });
  }

  /**
   * Gracefully stop the Python server process.
   * Called automatically on Node process exit; can also be called manually.
   */
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this._resetTimer) { clearTimeout(this._resetTimer); this._resetTimer = null; }
    if (this.proc) {
      try { this.proc.stdin.end(); } catch (_) {}
      // Give stdin.end() a moment to flush, then force-kill
      setTimeout(() => {
        try { if (this.proc) this.proc.kill(); } catch (_) {}
        this.proc = null;
      }, 200);
    }
    for (const [, { reject, timer }] of this.pending) {
      clearTimeout(timer);
      reject(new Error('EmbeddingServer: stopped'));
    }
    this.pending.clear();
    console.log('[EmbeddingServer] Stopped');
  }
}

// Export as singleton — one shared process for all concurrent meetings
const instance = new EmbeddingServerProcess();

// Register cleanup handlers so the Python process is not orphaned on Node exit
for (const sig of ['exit', 'SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    try { instance.stop(); } catch (_) {}
  });
}

module.exports = instance;
