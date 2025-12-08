// ModelPreloader.js - Preloads WhisperX models before meetings start
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PY_SCRIPT_PATH = path.resolve(__dirname, '../../../ai-layer/whisperX/transcribe-whisper.py');
const ROOT_VENV_PYTHON_WIN = path.resolve(__dirname, '../../../venv/Scripts/python.exe');
const ROOT_VENV_PYTHON_UNIX = path.resolve(__dirname, '../../../venv/bin/python');

// Global map to track preloaded models by meeting ID
const preloadedModels = new Map();

// Global map to track preloads in progress (before model is loaded)
// Structure: { process: ChildProcess, promise: Promise, startedAt: Date, failed?: boolean }
const preloadsInProgress = new Map();

// Global model state (shared across all meetings)
let globalModel = null; // { process: ChildProcess, loadedAt: Date }
let globalModelLoading = false; // Prevent concurrent loading attempts
let globalModelLoadPromise = null; // Promise for ongoing load

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
   * Check if a Python process is healthy and can accept requests
   * @param {ChildProcess} proc - Python process to check
   * @returns {boolean} - True if process is alive and usable
   */
  static isProcessHealthy(proc) {
    if (!proc) return false;
    if (proc.killed) return false;
    if (proc.exitCode !== null) return false;
    if (!proc.stdin || proc.stdin.destroyed) return false;
    return true;
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

    // Check if preload is already in progress
    if (preloadsInProgress.has(meetingId)) {
      console.log(`⏳ Preload already in progress for meeting ${meetingId}, waiting for completion...`);
      const inProgress = preloadsInProgress.get(meetingId);
      return inProgress.promise;
    }

    console.log(`🔄 Preloading WhisperX model for meeting ${meetingId}...`);

    // Create promise variable first to avoid TDZ issue
    let preloadPromise;
    preloadPromise = new Promise((resolve, reject) => {
      const venvPython = this.getPythonExecutable();
      const candidates = venvPython 
        ? [venvPython, 'py -3.10', 'python3.10', 'python', 'py']
        : ['py -3.10', 'python3.10', 'python', 'py'];

      let proc = null;
      let modelLoaded = false;
      let processKilledByTimeout = false; // Flag to prevent double-rejection
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let timeout = null;

      // Helper function to check if model loaded (checks accumulated buffer)
      const checkModelLoaded = () => {
        // Check accumulated buffer, not just current chunk (message might be split)
        if (stderrBuffer.includes('[Kairo] ✓ Model loaded successfully') || 
            stderrBuffer.includes('[Kairo]') && stderrBuffer.includes('Model loaded successfully')) {
          modelLoaded = true;
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          console.log(`✅ Model preloaded successfully for meeting ${meetingId}`);
          
          // Move from in-progress to preloaded
          preloadsInProgress.delete(meetingId);
          
          // Store the process for reuse
          preloadedModels.set(meetingId, {
            process: proc,
            loadedAt: new Date(),
            meetingId: meetingId
          });
          
          resolve();
          return true;
        }
        return false;
      };

      // Try each Python candidate
      for (const cmd of candidates) {
        try {
          const spawnOptions = {
            cwd: path.dirname(PY_SCRIPT_PATH),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
          };

          // Use shell: false for full paths, shell: true for commands (especially on Windows for commands with spaces)
          // Check if cmd is a full path (contains path separators)
          const isFullPath = cmd.includes(path.sep) || (process.platform === 'win32' && cmd.includes('\\'));
          const useShell = isFullPath 
            ? false // Direct execution, no shell for full paths
            : (process.platform === 'win32'); // Use shell for command strings on Windows
          
          proc = spawn(cmd, [PY_SCRIPT_PATH], { ...spawnOptions, shell: useShell });

          // Track this preload as in progress IMMEDIATELY after spawn
          preloadsInProgress.set(meetingId, {
            process: proc,
            promise: preloadPromise, // Now safe to reference since we used 'let' and assigned before Promise constructor
            startedAt: new Date()
          });

          proc.stdout.on('data', (data) => {
            stdoutBuffer += data.toString();
          });

          proc.stderr.on('data', (data) => {
            const stderrText = data.toString();
            stderrBuffer += stderrText;
            
            // Check accumulated buffer for success message
            if (checkModelLoaded()) {
              return; // Model loaded, exit early
            }
            
            // Log errors
            if (stderrText.includes('[Error]') || stderrText.includes('Traceback')) {
              console.error(`[ModelPreloader Error]: ${stderrText.trim()}`);
            }
          });

          proc.on('close', (code) => {
            // Clear timeout if still active
            if (timeout) {
              clearTimeout(timeout);
              timeout = null;
            }
            
            // If process was killed by timeout, don't reject again (already rejected)
            if (processKilledByTimeout) {
              return;
            }
            
            // Check buffer one last time (process might have exited after loading)
            if (checkModelLoaded()) {
              return; // Model loaded successfully before close
            }
            
              // Mark as failed but keep in Map briefly
              const inProgress = preloadsInProgress.get(meetingId);
              if (inProgress) {
                inProgress.failed = true;
              const exitCode = code === null ? 'null (killed)' : code;
              inProgress.error = new Error(`Python process exited with code ${exitCode}: ${stderrBuffer}`);
              }
            
            const exitCode = code === null ? 'null (killed)' : code;
            console.error(`❌ Model preload failed for meeting ${meetingId} - process exited with code ${exitCode}`);
              preloadedModels.delete(meetingId);
              
              // Don't immediately remove - give TranscriptionService time to detect it
              setTimeout(() => {
                preloadsInProgress.delete(meetingId);
              }, 5000); // 5 second delay
              
            // Reject with error including stderr buffer
            const errorMsg = `Python process exited with code ${exitCode}. ` +
              (stderrBuffer ? `Stderr: ${stderrBuffer.substring(0, 500)}` : 'No stderr output');
            reject(new Error(errorMsg));
          });

          proc.on('error', (error) => {
            // Clear timeout if still active
            if (timeout) {
              clearTimeout(timeout);
              timeout = null;
            }
            
            // If process was killed by timeout, don't reject again
            if (processKilledByTimeout) {
              return;
            }
            
            // Mark as failed but keep in Map briefly so TranscriptionService can detect it
            const inProgress = preloadsInProgress.get(meetingId);
            if (inProgress) {
              inProgress.failed = true;
              inProgress.error = error;
            }
            console.error(`❌ Model preload error for meeting ${meetingId}: ${error.message}`);
            preloadedModels.delete(meetingId);
            
            // Don't immediately remove from Map - give TranscriptionService time to detect it
            setTimeout(() => {
              preloadsInProgress.delete(meetingId);
            }, 5000); // 5 second delay
            
            reject(error);
          });

          // Send PRELOAD command to trigger model loading
          setTimeout(() => {
            if (!modelLoaded && proc && proc.stdin && !proc.stdin.destroyed) {
              proc.stdin.write('PRELOAD\n');
              // Flush stdin to ensure command is sent immediately
              if (proc.stdin.flush) {
                proc.stdin.flush();
              }
            }
          }, 100);

          // Timeout after 2 minutes
          timeout = setTimeout(() => {
            if (!modelLoaded) {
              processKilledByTimeout = true; // Mark as killed by timeout
              
              // Check buffer one last time before killing (might have just loaded)
              if (checkModelLoaded()) {
                return; // Model loaded, don't kill
              }
              
              // Mark as failed
              const inProgress = preloadsInProgress.get(meetingId);
              if (inProgress) {
                inProgress.failed = true;
                inProgress.error = new Error('Model preload timeout');
              }
              console.error(`❌ Model preload timeout for meeting ${meetingId}`);
              
              // Log stderr buffer for debugging
              if (stderrBuffer) {
                console.error(`[Debug] Stderr buffer at timeout: ${stderrBuffer.substring(0, 500)}`);
              }
              
              if (proc && !proc.killed) {
                proc.kill();
              }
              preloadedModels.delete(meetingId);
              
              // Remove after delay
              setTimeout(() => {
                preloadsInProgress.delete(meetingId);
              }, 5000);
              
              reject(new Error(`Model preload timeout. Stderr: ${stderrBuffer.substring(0, 200)}`));
            }
          }, 120000); // 2 minutes

          break; // Successfully started process
        } catch (error) {
          // Try next candidate
          continue;
        }
      }

      if (!proc) {
        preloadsInProgress.delete(meetingId);
        reject(new Error('Failed to start Python process for model preloading'));
      }
    });

    return preloadPromise;
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

  /**
   * Get all meeting IDs with preloads in progress
   * @returns {number[]}
   */
  static getPreloadsInProgressIds() {
    return Array.from(preloadsInProgress.keys());
  }

  /**
   * Check if a preload is currently in progress for a meeting
   * @param {number} meetingId - Meeting ID
   * @returns {boolean}
   */
  static isPreloadInProgress(meetingId) {
    const inProgress = preloadsInProgress.get(meetingId);
    if (!inProgress) {
      return false;
    }
    
    // If preload failed, don't consider it in progress (TranscriptionService should create new one)
    if (inProgress.failed) {
      return false;
    }
    
    // Check if process is still alive
    const proc = inProgress.process;
    if (!proc || proc.killed || proc.exitCode !== null) {
      // Only remove if not already marked as failed (failed ones are removed after delay)
      if (!inProgress.failed) {
        preloadsInProgress.delete(meetingId);
      }
      return false;
    }
    
    return true;
  }

  /**
   * Wait for a preload in progress to complete
   * @param {number} meetingId - Meeting ID
   * @param {number} maxWaitMs - Maximum time to wait in milliseconds (default: 120000 = 2 minutes)
   * @returns {Promise<object|null>} - Preloaded process info or null if timeout/failed
   */
  static async waitForPreload(meetingId, maxWaitMs = 120000) {
    const inProgress = preloadsInProgress.get(meetingId);
    if (!inProgress) {
      // Check if already preloaded
      return preloadedModels.get(meetingId) || null;
    }

    console.log(`⏳ Waiting for preload to complete for meeting ${meetingId}...`);
    
    try {
      // Wait for the preload promise to resolve
      await Promise.race([
        inProgress.promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Wait timeout')), maxWaitMs)
        )
      ]);
      
      // After promise resolves, check if model is now preloaded
      return preloadedModels.get(meetingId) || null;
    } catch (error) {
      console.error(`⚠️  Error waiting for preload for meeting ${meetingId}:`, error.message);
      return null;
    }
  }

  /**
   * Create a new global model process
   * @returns {Promise<{process: ChildProcess, loadedAt: Date}>}
   * @private
   */
  static async createGlobalModelProcess() {
    return new Promise((resolve, reject) => {
      console.log('🔄 Creating global transcription model process...');
      
      const venvPython = this.getPythonExecutable();
      const candidates = venvPython 
        ? [venvPython, 'py -3.10', 'python3.10', 'python', 'py']
        : ['py -3.10', 'python3.10', 'python', 'py'];
      
      let proc = null;
      let modelLoaded = false;
      let processKilledByTimeout = false; // Flag to prevent double-rejection
      let stderrBuffer = '';
      let timeout = null;
      
      // Helper function to check if model loaded (checks accumulated buffer)
      const checkModelLoaded = () => {
        // Check accumulated buffer, not just current chunk (message might be split)
        if (stderrBuffer.includes('[Kairo] ✓ Model loaded successfully') || 
            stderrBuffer.includes('[Kairo]') && stderrBuffer.includes('Model loaded successfully')) {
          modelLoaded = true;
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          console.log('✅ Global model loaded successfully');
          resolve({
            process: proc,
            loadedAt: new Date()
          });
          return true;
        }
        return false;
      };
      
      for (const cmd of candidates) {
        try {
          const isFullPath = cmd.includes(path.sep) || (process.platform === 'win32' && cmd.includes('\\'));
          const useShell = isFullPath ? false : (process.platform === 'win32');
          
          proc = spawn(cmd, [PY_SCRIPT_PATH], {
            cwd: path.dirname(PY_SCRIPT_PATH),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
            shell: useShell
          });
          
          // Timeout after 2 minutes - store reference to clear it
          timeout = setTimeout(() => {
            if (!modelLoaded) {
              processKilledByTimeout = true; // Mark as killed by timeout
              console.error('❌ Global model load timeout');
              
              // Check buffer one last time before killing (might have just loaded)
              if (checkModelLoaded()) {
                return; // Model loaded, don't kill
              }
              
              // Log stderr buffer for debugging
              if (stderrBuffer) {
                console.error(`[Debug] Stderr buffer at timeout: ${stderrBuffer.substring(0, 500)}`);
              }
              
              if (proc && !proc.killed) {
                proc.kill();
              }
              reject(new Error(`Global model load timeout. Stderr: ${stderrBuffer.substring(0, 200)}`));
            }
          }, 120000);
          
          proc.stderr.on('data', (data) => {
            const stderrText = data.toString();
            stderrBuffer += stderrText;
            
            // Check accumulated buffer for success message
            if (checkModelLoaded()) {
              return; // Model loaded, exit early
            }
            
            // Log errors
            if (stderrText.includes('[Error]') || stderrText.includes('Traceback')) {
              console.error(`[Global Model Error]: ${stderrText.trim()}`);
            }
            
            // Log progress messages for debugging
            if (stderrText.includes('[Kairo] Loading WhisperX model') || 
                stderrText.includes('[Kairo] Preloading model')) {
              console.log(`[Global Model] ${stderrText.trim()}`);
            }
          });
          
          proc.on('close', (code) => {
            // Clear timeout if still active
            if (timeout) {
              clearTimeout(timeout);
              timeout = null;
            }
            
            // If process was killed by timeout, don't reject again (already rejected)
            if (processKilledByTimeout) {
              return;
            }
            
            // Check buffer one last time (process might have exited after loading)
            if (checkModelLoaded()) {
              return; // Model loaded successfully before close
            }
            
            // Handle exit codes: null on Windows when killed, non-zero = error
            const exitCode = code === null ? 'null (killed)' : code;
            console.error(`❌ Global model process exited with code ${exitCode}`);
            
            // Include stderr buffer in error for debugging
            const errorMsg = `Python process exited with code ${exitCode}. ` +
              (stderrBuffer ? `Stderr: ${stderrBuffer.substring(0, 500)}` : 'No stderr output');
            
            reject(new Error(errorMsg));
          });
          
          proc.on('error', (error) => {
            // Clear timeout if still active
            if (timeout) {
              clearTimeout(timeout);
              timeout = null;
            }
            
            // If process was killed by timeout, don't reject again
            if (processKilledByTimeout) {
              return;
            }
            
            console.error(`❌ Global model process error: ${error.message}`);
            reject(error);
          });
          
          // Send PRELOAD command
          setTimeout(() => {
            if (!modelLoaded && proc && proc.stdin && !proc.stdin.destroyed) {
              proc.stdin.write('PRELOAD\n');
              // Flush stdin to ensure command is sent immediately
              if (proc.stdin.flush) {
                proc.stdin.flush();
              }
            }
          }, 100);
          
          break; // Successfully started
        } catch (error) {
          continue; // Try next candidate
        }
      }
      
      if (!proc) {
        reject(new Error('Failed to start Python process for global model'));
      }
    });
  }

  /**
   * Get or create the global transcription model
   * Returns existing model if healthy, creates new one if needed
   * @returns {Promise<{process: ChildProcess, loadedAt: Date}|null>} - Global model or null if failed
   */
  static async getGlobalModel() {
    // Check if global model exists and is healthy
    if (globalModel && this.isProcessHealthy(globalModel.process)) {
      return globalModel;
    }
    
    // Clear unhealthy model
    if (globalModel && !this.isProcessHealthy(globalModel.process)) {
      console.log('⚠️  Global model is unhealthy, clearing...');
      try {
        if (globalModel.process && !globalModel.process.killed) {
          globalModel.process.kill();
        }
      } catch (e) {
        // Ignore errors when killing dead process
      }
      globalModel = null;
    }
    
    // If loading in progress, wait for it
    if (globalModelLoading && globalModelLoadPromise) {
      console.log('⏳ Global model loading in progress, waiting...');
      try {
        return await globalModelLoadPromise;
      } catch (error) {
        console.warn('⚠️  Global model load failed, returning null:', error.message);
        return null;
      }
    }
    
    // Start loading
    globalModelLoading = true;
    globalModelLoadPromise = this.createGlobalModelProcess()
      .then((model) => {
        globalModel = model;
        globalModelLoading = false;
        globalModelLoadPromise = null;
        return model;
      })
      .catch((error) => {
        globalModelLoading = false;
        globalModelLoadPromise = null;
        throw error;
      });
    
    try {
      return await globalModelLoadPromise;
    } catch (error) {
      console.error('❌ Failed to create global model:', error.message);
      return null;
    }
  }

  /**
   * Wait for global model to be ready (with timeout)
   * @param {number} maxWaitMs - Maximum time to wait in milliseconds (default: 60000)
   * @returns {Promise<{process: ChildProcess, loadedAt: Date}|null>} - Global model or null if timeout
   */
  static async waitForGlobalModel(maxWaitMs = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const model = await this.getGlobalModel();
      if (model && this.isProcessHealthy(model.process)) {
        return model;
      }
      
      // Wait 500ms before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.warn(`⚠️  Global model not ready after ${maxWaitMs}ms`);
    return null;
  }

  /**
   * Check if global model is available and healthy
   * @returns {boolean}
   */
  static isGlobalModelAvailable() {
    return globalModel !== null && this.isProcessHealthy(globalModel.process);
  }

  /**
   * Get the global model process synchronously (for cleanup checks)
   * @returns {ChildProcess|null} - Global model process or null
   */
  static getGlobalModelProcessSync() {
    return globalModel && this.isProcessHealthy(globalModel.process) ? globalModel.process : null;
  }

  /**
   * Release the global model (for testing/cleanup)
   * @returns {void}
   */
  static releaseGlobalModel() {
    if (globalModel) {
      console.log('🗑️  Releasing global model...');
      try {
        if (globalModel.process && !globalModel.process.killed) {
          globalModel.process.kill();
        }
      } catch (error) {
        console.error('⚠️  Error releasing global model:', error.message);
      }
      globalModel = null;
      globalModelLoading = false;
      globalModelLoadPromise = null;
    }
  }
}

module.exports = ModelPreloader;

