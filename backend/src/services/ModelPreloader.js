// ModelPreloader.js - Preloads WhisperX models before meetings start
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PY_SCRIPT_PATH = path.resolve(__dirname, '../../../ai-layer/whisperX/transcribe-whisper.py');
const ROOT_VENV_PYTHON_WIN = path.resolve(__dirname, '../../../venv/Scripts/python.exe');
const ROOT_VENV_PYTHON_UNIX = path.resolve(__dirname, '../../../venv/bin/python');

// Global map to track preloaded models by meeting ID
const preloadedModels = new Map();

class ModelPreloader {
  /**
   * Get Python executable path (prioritize root venv)
   */
  static getPythonExecutable() {
    if (process.platform === 'win32') {
      if (fs.existsSync(ROOT_VENV_PYTHON_WIN)) {
        return ROOT_VENV_PYTHON_WIN;
      }
    } else {
      if (fs.existsSync(ROOT_VENV_PYTHON_UNIX)) {
        return ROOT_VENV_PYTHON_UNIX;
      }
    }
    return null;
  }

  /**
   * Preload model for a meeting
   * @param {number} meetingId - Meeting ID
   * @returns {Promise<void>}
   */
  static async preloadModel(meetingId) {
    // Check if already preloaded
    if (preloadedModels.has(meetingId)) {
      console.log(`✅ Model already preloaded for meeting ${meetingId}`);
      return;
    }

    console.log(`🔄 Preloading WhisperX model for meeting ${meetingId}...`);

    return new Promise((resolve, reject) => {
      const venvPython = this.getPythonExecutable();
      const candidates = venvPython 
        ? [venvPython, 'py -3.10', 'python3.10', 'python', 'py']
        : ['py -3.10', 'python3.10', 'python', 'py'];

      let proc = null;
      let modelLoaded = false;
      let stdoutBuffer = '';
      let stderrBuffer = '';

      // Try each Python candidate
      for (const cmd of candidates) {
        try {
          const spawnOptions = {
            cwd: path.dirname(PY_SCRIPT_PATH),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
          };

          // Use shell: false for full paths, shell: true for commands
          const useShell = !path.isAbsolute(cmd) && !cmd.includes(' ');
          proc = spawn(cmd, [PY_SCRIPT_PATH], { ...spawnOptions, shell: useShell });

          proc.stdout.on('data', (data) => {
            stdoutBuffer += data.toString();
          });

          proc.stderr.on('data', (data) => {
            const stderrText = data.toString();
            stderrBuffer += stderrText;
            
            // Check for model load completion
            if (stderrText.includes('[Kairo] ✓ Model loaded successfully')) {
              modelLoaded = true;
              console.log(`✅ Model preloaded successfully for meeting ${meetingId}`);
              
              // Store the process for reuse
              preloadedModels.set(meetingId, {
                process: proc,
                loadedAt: new Date(),
                meetingId: meetingId
              });
              
              resolve();
              return;
            }
            
            // Log errors
            if (stderrText.includes('[Error]') || stderrText.includes('Traceback')) {
              console.error(`[ModelPreloader Error]: ${stderrText.trim()}`);
            }
          });

          proc.on('close', (code) => {
            if (!modelLoaded) {
              console.error(`❌ Model preload failed for meeting ${meetingId} - process exited with code ${code}`);
              preloadedModels.delete(meetingId);
              if (code !== 0) {
                reject(new Error(`Python process exited with code ${code}: ${stderrBuffer}`));
              }
            }
          });

          proc.on('error', (error) => {
            console.error(`❌ Model preload error for meeting ${meetingId}: ${error.message}`);
            preloadedModels.delete(meetingId);
            reject(error);
          });

          // Send PRELOAD command to trigger model loading
          setTimeout(() => {
            if (!modelLoaded && proc && proc.stdin && !proc.stdin.destroyed) {
              proc.stdin.write('PRELOAD\n');
            }
          }, 100);

          // Timeout after 2 minutes
          const timeout = setTimeout(() => {
            if (!modelLoaded) {
              console.error(`❌ Model preload timeout for meeting ${meetingId}`);
              if (proc && !proc.killed) {
                proc.kill();
              }
              preloadedModels.delete(meetingId);
              reject(new Error('Model preload timeout'));
            }
          }, 120000); // 2 minutes

          // Clear timeout when model loads
          const originalResolve = resolve;
          resolve = (...args) => {
            clearTimeout(timeout);
            originalResolve(...args);
          };

          break; // Successfully started process
        } catch (error) {
          // Try next candidate
          continue;
        }
      }

      if (!proc) {
        reject(new Error('Failed to start Python process for model preloading'));
      }
    });
  }

  /**
   * Get preloaded process for a meeting
   * @param {number} meetingId - Meeting ID
   * @returns {object|null} - Preloaded process info or null
   */
  static getPreloadedProcess(meetingId) {
    return preloadedModels.get(meetingId) || null;
  }

  /**
   * Check if model is preloaded for a meeting
   * @param {number} meetingId - Meeting ID
   * @returns {boolean}
   */
  static isPreloaded(meetingId) {
    const preloaded = preloadedModels.get(meetingId);
    if (!preloaded) return false;
    
    // Check if process is still alive
    const proc = preloaded.process;
    if (!proc || proc.killed || proc.exitCode !== null) {
      preloadedModels.delete(meetingId);
      return false;
    }
    
    return true;
  }

  /**
   * Transfer preloaded model ownership to another service (removes from Map without killing process)
   * @param {number} meetingId - Meeting ID
   * @returns {boolean} - True if model was transferred, false if not found
   */
  static transferModel(meetingId) {
    const preloaded = preloadedModels.get(meetingId);
    if (preloaded) {
      console.log(`🔄 Transferring preloaded model ownership for meeting ${meetingId} (process will remain alive)`);
      preloadedModels.delete(meetingId);
      return true;
    }
    return false;
  }

  /**
   * Release preloaded model for a meeting (kills the process and removes from Map)
   * @param {number} meetingId - Meeting ID
   */
  static releaseModel(meetingId) {
    const preloaded = preloadedModels.get(meetingId);
    if (preloaded) {
      console.log(`🗑️  Releasing preloaded model for meeting ${meetingId}`);
      try {
        if (preloaded.process && !preloaded.process.killed) {
          preloaded.process.kill();
        }
      } catch (error) {
        console.error(`⚠️  Error releasing model for meeting ${meetingId}:`, error.message);
      }
      preloadedModels.delete(meetingId);
    }
  }

  /**
   * Release all preloaded models
   */
  static releaseAll() {
    console.log(`🗑️  Releasing all preloaded models...`);
    for (const [meetingId, preloaded] of preloadedModels.entries()) {
      try {
        if (preloaded.process && !preloaded.process.killed) {
          preloaded.process.kill();
        }
      } catch (error) {
        console.error(`⚠️  Error releasing model for meeting ${meetingId}:`, error.message);
      }
    }
    preloadedModels.clear();
  }

  /**
   * Get all preloaded meeting IDs
   * @returns {number[]}
   */
  static getPreloadedMeetingIds() {
    return Array.from(preloadedModels.keys());
  }
}

module.exports = ModelPreloader;

