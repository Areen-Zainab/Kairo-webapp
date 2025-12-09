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
let globalModel = null; // { process: ChildProcess, loadedAt: Date, state: string, lastSuccessAt: Date }
let globalModelLoading = false; // Prevent concurrent loading attempts
let globalModelLoadPromise = null; // Promise for ongoing load
let globalModelMonitorInterval = null; // Interval for process monitoring

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
    if (!proc.stdin.writable) return false;
    return true;
  }

  /**
   * Comprehensive health check for global model process (CRITICAL FIX #1)
   * @returns {boolean} - True if global process is healthy and ready for transcription
   */
  static isGlobalModelHealthy() {
    if (!globalModel || !globalModel.process) return false;
    
    const proc = globalModel.process;
    
    // Check process is not killed
    if (proc.killed) {
      console.warn('⚠️  Global model process is killed');
      return false;
    }
    
    // Check process hasn't exited
    if (proc.exitCode !== null) {
      console.warn(`⚠️  Global model process has exited with code ${proc.exitCode}`);
      return false;
    }
    
    // Check stdin exists and is writable (CRITICAL FIX #2)
    if (!proc.stdin) {
      console.warn('⚠️  Global model process has no stdin');
      return false;
    }
    
    if (proc.stdin.destroyed) {
      console.warn('⚠️  Global model process stdin is destroyed');
      return false;
    }
    
    if (!proc.stdin.writable) {
      console.warn('⚠️  Global model process stdin is not writable');
      return false;
    }
    
    // Check process state
    if (globalModel.state === 'dead' || globalModel.state === 'recovering') {
      console.warn(`⚠️  Global model process is in ${globalModel.state} state`);
      return false;
    }
    
    return true;
  }

  /**
   * Mark global model process as dead and trigger recovery
   * @param {string} reason - Reason for marking as dead
   */
  static markGlobalModelDead(reason) {
    if (globalModel && globalModel.process) {
      console.error(`❌ Marking global model as dead: ${reason}`);
      globalModel.state = 'dead';
      
      // Try to kill the process if it's still alive
      try {
        if (!globalModel.process.killed) {
          globalModel.process.kill();
        }
      } catch (e) {
        // Ignore errors
      }
      
      globalModel.process = null; // Clear reference
      
      // Trigger recovery (will be picked up by monitor or next request)
      this._recoverGlobalModel();
    }
  }

  /**
   * Recover global model by recreating it
   * @private
   */
  static _recoverGlobalModel() {
    if (globalModelLoading) {
      console.log('🔄 Global model recovery already in progress');
      return;
    }
    
    console.log('🔄 Recovering global model process...');
    globalModel = null; // Clear old reference
    globalModelLoading = false;
    globalModelLoadPromise = null;
    
    // Recreate will happen on next getGlobalModel() call or via monitor
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
  /**
   * Validate that a Python executable has whisperx installed
   * @param {string} pythonCmd - Python command or path
   * @returns {Promise<boolean>} - True if whisperx is available
   */
  static async validatePythonEnvironment(pythonCmd) {
    return new Promise((resolve) => {
      try {
        const isFullPath = pythonCmd.includes(path.sep) || (process.platform === 'win32' && pythonCmd.includes('\\'));
        const spawnOptions = isFullPath
          ? { shell: false }
          : { shell: process.platform === 'win32' };
        
        // Quick check: try to import whisperx
        const proc = spawn(pythonCmd, ['-c', 'import whisperx'], {
          ...spawnOptions,
          timeout: 5000 // 5 second timeout
        });

        let stderr = '';
        proc.stderr.on('data', d => stderr += d.toString());
        
        proc.on('close', (code) => {
          // Code 0 means import succeeded
          resolve(code === 0);
        });

        proc.on('error', () => {
          resolve(false);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          try {
            proc.kill();
          } catch (e) {
            // Ignore
          }
          resolve(false);
        }, 5000);
      } catch (error) {
        resolve(false);
      }
    });
  }

  static async createGlobalModelProcess() {
    return new Promise(async (resolve, reject) => {
      console.log('🔄 Creating global transcription model process...');
      
      const venvPython = this.getPythonExecutable();
      const allCandidates = venvPython 
        ? [venvPython, 'py -3.10', 'python3.10', 'python', 'py']
        : ['py -3.10', 'python3.10', 'python', 'py'];
      
      // Validate Python environments first - only use ones with whisperx
      console.log('🔍 Validating Python environments for whisperx...');
      const validatedCandidates = [];
      for (const cmd of allCandidates) {
        const hasWhisperx = await this.validatePythonEnvironment(cmd);
        if (hasWhisperx) {
          validatedCandidates.push(cmd);
          console.log(`✅ Python environment validated: ${cmd}`);
        } else {
          console.warn(`⚠️  Python environment missing whisperx: ${cmd}`);
        }
      }
      
      if (validatedCandidates.length === 0) {
        const errorMsg = venvPython
          ? `No Python environment with whisperx found. Venv Python exists at ${venvPython} but whisperx is not installed. Please install whisperx in the venv.`
          : 'No Python environment with whisperx found. Please ensure whisperx is installed in your Python environment.';
        return reject(new Error(errorMsg));
      }
      
      let proc = null;
      let modelLoaded = false;
      let processKilledByTimeout = false; // Flag to prevent double-rejection
      let stderrBuffer = '';
      let timeout = null;
      let candidateIndex = 0;
      
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
          globalModel = {
            process: proc,
            loadedAt: new Date(),
            state: 'ready',
            lastSuccessAt: null
          };
          resolve(globalModel);
          
          // Start monitoring after successful load (CRITICAL FIX #3)
          this._startGlobalModelMonitoring();
          
          return true;
        }
        return false;
      };
      
      const tryCandidate = () => {
        if (candidateIndex >= validatedCandidates.length) {
          return reject(new Error('All validated Python environments failed to load model'));
        }
        
        const cmd = validatedCandidates[candidateIndex++];
        console.log(`🔄 Attempting to create global model with: ${cmd}`);
        
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
            
            // CRITICAL FIX #4: Better error detection from Python process
            // Check for ModuleNotFoundError - this means Python doesn't have whisperx
            if (stderrText.includes('ModuleNotFoundError') && stderrText.includes('whisperx')) {
              console.error(`❌ ModuleNotFoundError: whisperx not found in ${cmd}`);
              // Mark as dead immediately
              if (globalModel && globalModel.process === proc) {
                this.markGlobalModelDead('ModuleNotFoundError: whisperx not found');
              }
              // Try next validated candidate
              if (proc && !proc.killed) {
                proc.kill();
              }
              if (timeout) {
                clearTimeout(timeout);
                timeout = null;
              }
              stderrBuffer = '';
              return tryCandidate();
            }
            
            // Check for Python crashes (Traceback)
            if (stderrText.includes('Traceback')) {
              console.error(`[Global Model Error] Python crashed: ${stderrText.substring(0, 200)}`);
              // Mark as dead if this is the global model
              if (globalModel && globalModel.process === proc) {
                this.markGlobalModelDead('Python crash detected in stderr');
              }
            }
            
            // Log other errors
            if (stderrText.includes('[Error]')) {
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
            
            // CRITICAL FIX #4: Better error detection - check for errors in stderr buffer
            if (stderrBuffer.includes('ModuleNotFoundError') && stderrBuffer.includes('whisperx')) {
              console.error(`❌ ModuleNotFoundError: whisperx not found in ${cmd}`);
              // Mark as dead if this is the global model
              if (globalModel && globalModel.process === proc) {
                this.markGlobalModelDead('ModuleNotFoundError: whisperx not found');
              }
              // Try next validated candidate
              if (candidateIndex < validatedCandidates.length) {
                stderrBuffer = '';
                return tryCandidate();
              }
            }
            
            // Check for Python crashes
            if (stderrBuffer.includes('Traceback')) {
              console.error(`❌ Global model process crashed (Traceback detected)`);
              // Mark as dead if this is the global model
              if (globalModel && globalModel.process === proc) {
                this.markGlobalModelDead('Python crash (Traceback in stderr)');
              }
            }
            
            // Handle exit codes: null on Windows when killed, non-zero = error
            const exitCode = code === null ? 'null (killed)' : code;
            
            // Mark as dead if this is the global model (CRITICAL FIX #4)
            if (globalModel && globalModel.process === proc) {
              if (code === 0) {
                console.warn('⚠️  Global model process exited with code 0 (normal exit, but unexpected)');
                this.markGlobalModelDead('Process exited normally (unexpected)');
              } else {
                console.error(`❌ Global model process exited with code ${exitCode}`);
                this.markGlobalModelDead(`Process exited with code ${exitCode}`);
              }
            }
            
            // Try next validated candidate if available
            if (candidateIndex < validatedCandidates.length) {
              console.log(`🔄 Trying next Python candidate...`);
              stderrBuffer = '';
              return tryCandidate();
            }
            
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
            
            console.error(`❌ Global model process error with ${cmd}: ${error.message}`);
            
            // Mark as dead if this is the global model (CRITICAL FIX #4)
            if (globalModel && globalModel.process === proc) {
              this.markGlobalModelDead(`Process error: ${error.message}`);
            }
            
            // Try next validated candidate if available
            if (candidateIndex < validatedCandidates.length) {
              console.log(`🔄 Trying next Python candidate...`);
              stderrBuffer = '';
              return tryCandidate();
            }
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
        } catch (error) {
          console.error(`❌ Error spawning process with ${cmd}:`, error.message);
          // Try next candidate
          if (candidateIndex < validatedCandidates.length) {
            return tryCandidate();
          }
          return reject(error);
        }
      };
      
      // Start with first candidate
      tryCandidate();
      
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
  /**
   * Start monitoring global model process health (CRITICAL FIX #3)
   * @private
   */
  static _startGlobalModelMonitoring() {
    // Clear existing monitor if any
    if (globalModelMonitorInterval) {
      clearInterval(globalModelMonitorInterval);
    }
    
    // Monitor every 30 seconds
    globalModelMonitorInterval = setInterval(() => {
      if (!globalModel || !globalModel.process) {
        // No global model, nothing to monitor
        return;
      }
      
      const proc = globalModel.process;
      
      // Check if process is still healthy
      if (!this.isGlobalModelHealthy()) {
        console.warn('⚠️  Global model process health check failed, marking as dead');
        this.markGlobalModelDead('Health check failed in monitor');
        // Try to recreate immediately
        this.getGlobalModel().catch(err => {
          console.warn('⚠️  Failed to recreate global model in monitor:', err.message);
        });
        return;
      }
      
      // If process was dead but is now healthy again, update state
      if (globalModel.state === 'dead') {
        console.log('🔄 Global model process recovered, updating state');
        globalModel.state = 'ready';
      }
      
      // Check if process has been idle too long without success (stale process)
      if (globalModel.lastSuccessAt) {
        const timeSinceLastSuccess = Date.now() - globalModel.lastSuccessAt.getTime();
        const maxIdleTime = 5 * 60 * 1000; // 5 minutes
        
        if (timeSinceLastSuccess > maxIdleTime) {
          console.warn(`⚠️  Global model process idle for ${Math.round(timeSinceLastSuccess / 1000)}s, checking health...`);
          // Don't mark as dead, just log - might be legitimately idle
        }
      }
      
      // Update state to ready if it was transcribing
      if (globalModel.state === 'transcribing') {
        // If we're here, process is still alive, so it's ready again
        globalModel.state = 'ready';
      }
    }, 30000); // Check every 30 seconds
    
    console.log('✅ Started global model process monitoring');
  }

  /**
   * Stop monitoring global model process
   */
  static _stopGlobalModelMonitoring() {
    if (globalModelMonitorInterval) {
      clearInterval(globalModelMonitorInterval);
      globalModelMonitorInterval = null;
      console.log('⏹️  Stopped global model process monitoring');
    }
  }

  static async getGlobalModel() {
    // CRITICAL FIX #1: Check health before returning
    if (globalModel && globalModel.process) {
      if (!this.isGlobalModelHealthy()) {
        console.warn('⚠️  Global model process is unhealthy, recovering...');
        this.markGlobalModelDead('Health check failed in getGlobalModel');
        // Fall through to recreate
      } else {
        // Process is healthy, return it
        return globalModel;
      }
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
        // Model is already set in createGlobalModelProcess, just update loading state
        globalModelLoading = false;
        globalModelLoadPromise = null;
        return globalModel; // Return the globalModel that was set in createGlobalModelProcess
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
      if (model && this.isGlobalModelHealthy()) {
        return model;
      }
      
      // Wait 1 second before checking again (longer wait to avoid spam)
      await new Promise(resolve => setTimeout(resolve, 1000));
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
    // Use comprehensive health check
    return globalModel && this.isGlobalModelHealthy() ? globalModel.process : null;
  }

  /**
   * Release the global model (for testing/cleanup)
   * @returns {void}
   */
  /**
   * Mark a successful transcription on global model (for monitoring)
   */
  static markGlobalModelSuccess() {
    if (globalModel) {
      globalModel.lastSuccessAt = new Date();
      if (globalModel.state === 'ready') {
        globalModel.state = 'transcribing';
      }
    }
  }

  static releaseGlobalModel() {
    // Stop monitoring when releasing
    this._stopGlobalModelMonitoring();
    
    if (globalModel && globalModel.process) {
      try {
        if (!globalModel.process.killed) {
          globalModel.process.kill();
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    globalModel = null;
    globalModelLoading = false;
    globalModelLoadPromise = null;
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

