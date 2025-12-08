// TranscriptionService.js - Handles all transcription operations and Python process management
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PY_SCRIPT_PATH = path.resolve(__dirname, '../../../ai-layer/whisperX/transcribe-whisper.py');
// Check for venv in root directory (where backend runs with venv activated)
const ROOT_VENV_PYTHON_WIN = path.resolve(__dirname, '../../../venv/Scripts/python.exe');
const ROOT_VENV_PYTHON_UNIX = path.resolve(__dirname, '../../../venv/bin/python');

class TranscriptionService {
  constructor(meetingDataDir, transcriptFilepath, meetingId = null) {
    this.meetingDataDir = meetingDataDir;
    this.transcriptFilepath = transcriptFilepath; // Keep for backward compatibility
    this.meetingId = meetingId; // Meeting ID for preloaded model lookup
    this.pythonProc = null;
    this.pythonStdoutBuffer = '';
    this.pythonResolvers = [];
    this.pythonProcExited = false;
    this.pythonProcExited = false;
    this.transcriptionQueue = []; // Queue for sequential processing
    this.processingTranscription = false; // Flag to prevent concurrent processing

    // Create transcripts subdirectory
    this.transcriptsDir = path.join(meetingDataDir, 'transcripts');
    if (!fs.existsSync(this.transcriptsDir)) {
      fs.mkdirSync(this.transcriptsDir, { recursive: true });
      console.log(`📁 Created transcripts directory: ${this.transcriptsDir}`);
    }

    // Define output file paths
    this.completeTranscriptPath = path.join(meetingDataDir, 'transcript_complete.txt');
    this.diarizedJsonPath = path.join(meetingDataDir, 'transcript_diarized.json');
    this.diarizedTextPath = path.join(meetingDataDir, 'transcript_diarized.txt');

    // Initialize complete transcript file with header
    const header = `Kairo Complete Transcript\nGenerated: ${new Date().toISOString()}\n${'='.repeat(80)}\n\n`;
    try {
      fs.writeFileSync(this.completeTranscriptPath, header);
    } catch (error) {
      console.warn(`⚠️  Could not initialize complete transcript file: ${error.message}`);
    }

    // Initialize utterances array for diarization
    this.utterances = [];
    this.chunkCount = 0;

    // Verify Python script exists
    if (!fs.existsSync(PY_SCRIPT_PATH)) {
      console.warn(`⚠️  Python script not found at: ${PY_SCRIPT_PATH}`);
    }

    console.log('✅ TranscriptionService initialized');
    console.log(`   Meeting data directory: ${meetingDataDir}`);
    console.log(`   Transcripts directory: ${this.transcriptsDir}`);
    console.log(`   Legacy transcript file: ${transcriptFilepath || 'none'}`);
    console.log(`   Python script: ${PY_SCRIPT_PATH}`);
  }

  /**
   * Main transcription method
   * @param {string} audioPath - Path to audio file to transcribe
   * @param {number} chunkIndex - Optional chunk index for tracking
   * @returns {Promise<object>} - Transcription result object
   */
  async transcribe(audioPath, chunkIndex = null) {
    try {
      // Validate audio path exists
      if (!fs.existsSync(audioPath)) {
        console.error(`❌ Audio file not found: ${audioPath}`);
        return { success: false, text: '', chunk: chunkIndex, error: 'File not found' };
      }

      const fileSize = fs.statSync(audioPath).size;
      console.log(`🔍 Transcribing: ${path.basename(audioPath)} (${(fileSize / 1024).toFixed(1)} KB)`);

      // Try persistent Python process first, fallback to one-shot
      let transcriptionResult = null;
      try {
        transcriptionResult = await this.sendToPython(audioPath, chunkIndex);
      } catch (error) {
        console.warn(`⚠️  Persistent Python process failed, trying one-shot: ${error.message}`);
        try {
          const text = await this.runPythonOneShot(audioPath);
          transcriptionResult = { text, chunkIndex };
        } catch (oneShotError) {
          console.error(`❌ Transcription failed: ${oneShotError.message}`);
          return { success: false, text: '', chunk: chunkIndex, error: oneShotError.message };
        }
      }

      // Extract text and response chunkIndex from result
      const text = transcriptionResult.text;
      const responseChunkIndex = transcriptionResult.chunkIndex;

      // Validate chunkIndex matches (if both are provided)
      if (chunkIndex !== null && responseChunkIndex !== null && chunkIndex !== responseChunkIndex) {
        console.error(`❌ ChunkIndex mismatch! Requested: ${chunkIndex}, Response: ${responseChunkIndex}`);
        // Use the response chunkIndex (from resolver) as it's the authoritative source
      }

      // Use response chunkIndex if available, otherwise fall back to provided chunkIndex
      const finalChunkIndex = responseChunkIndex !== null ? responseChunkIndex : chunkIndex;

      // Clean the transcription text - remove any log lines
      const cleanedText = this.cleanTranscriptionText(text);

      // If transcription returned empty or whitespace, log warning but don't fail
      if (!cleanedText || !cleanedText.trim()) {
        console.warn(`⚠️  Empty transcription result for ${path.basename(audioPath)}`);
        return { success: false, text: '', chunk: finalChunkIndex, error: 'Empty transcription result' };
      }

      // Process transcription result
      if (cleanedText && cleanedText.trim()) {
        const timestamp = new Date().toISOString();
        // Use finalChunkIndex (from resolver) as the authoritative source
        let chunkNum;
        if (finalChunkIndex !== null) {
          chunkNum = finalChunkIndex;
          // Update chunkCount to reflect the highest chunk index we've seen
          if (finalChunkIndex >= this.chunkCount) {
            this.chunkCount = finalChunkIndex + 1;
          }
        } else {
          chunkNum = this.chunkCount++;
        }

        // 1. Save individual chunk transcript file - ONLY transcription text and timestamp
        const chunkFilename = `chunk_${chunkNum}_transcript.txt`;
        const chunkTranscriptPath = path.join(this.transcriptsDir, chunkFilename);
        const chunkContent = `${timestamp}\n${cleanedText.trim()}\n`;

        try {
          fs.writeFileSync(chunkTranscriptPath, chunkContent);
          console.log(`   📄 Chunk transcript saved: ${chunkFilename}`);
        } catch (fileError) {
          console.warn(`⚠️  Could not save chunk transcript: ${fileError.message}`);
        }

        // 2. Append to complete transcript file - only transcription text
        const completeLine = `[Chunk ${chunkNum}] [${timestamp}]\n${cleanedText.trim()}\n\n`;
        try {
          fs.appendFileSync(this.completeTranscriptPath, completeLine);
        } catch (fileError) {
          console.warn(`⚠️  Could not append to complete transcript: ${fileError.message}`);
        }

        // 3. Store utterance for diarization (basic structure, will be enhanced later)
        // Assuming 3-second chunks, will be updated during diarization
        this.utterances.push({
          chunk: chunkNum,
          timestamp: timestamp,
          audioFile: path.basename(audioPath),
          text: cleanedText.trim(), // Use cleaned text
          speaker: null, // Will be assigned during diarization
          start_time: chunkNum * 3.0, // Assuming 3-second chunks
          end_time: (chunkNum + 1) * 3.0
        });

        // 4. Append to legacy transcript file (backward compatibility)
        if (this.transcriptFilepath) {
          try {
            const legacyLine = `[${timestamp}] ${cleanedText.trim()}\n`;
            fs.appendFileSync(this.transcriptFilepath, legacyLine);
          } catch (fileError) {
            console.warn(`⚠️  Could not append to legacy transcript file: ${fileError.message}`);
          }
        }

        // Log transcription result
        const preview = cleanedText.length > 100 ? cleanedText.substring(0, 100) + '…' : cleanedText;
        console.log(`📝 Transcribed: ${preview}`);

        return {
          success: true,
          text: cleanedText.trim(),
          chunk: chunkNum,
          timestamp: timestamp,
          chunkFile: chunkTranscriptPath
        };
      } else {
        console.log(`⚠️  Empty transcription result for ${path.basename(audioPath)}`);
        return { success: false, text: '', chunk: finalChunkIndex };
      }
    } catch (error) {
      // Log errors gracefully without crashing
      console.error(`❌ Transcription error for ${audioPath}:`, error.message || error);
      // Use chunkIndex from parameter as fallback (finalChunkIndex may not be defined in catch block)
      return { success: false, error: error.message, chunk: chunkIndex };
    }
  }

  /**
   * Clean transcription text - remove log lines and keep only actual transcription
   * @param {string} text - Raw text from Python output
   * @returns {string} - Cleaned transcription text
   */
  cleanTranscriptionText(text) {
    if (!text) return '';

    // Check for transcription failure marker
    if (text.trim() === '[TRANSCRIPTION_FAILED]') {
      return '';
    }

    // Split into lines
    const lines = text.split('\\n');
    const cleanedLines = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Skip failure marker
      if (trimmed === '[TRANSCRIPTION_FAILED]') continue;

      // Skip log lines (common patterns)
      if (
        trimmed.includes('whisperx.') ||
        trimmed.includes('INFO -') ||
        trimmed.includes('WARNING -') ||
        trimmed.includes('ERROR -') ||
        trimmed.includes('Model was trained') ||
        trimmed.includes('Detected language:') ||
        trimmed.includes('Performing voice activity') ||
        trimmed.includes('Audio is shorter') ||
        trimmed.includes('language will be detected') ||
        trimmed.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/) || // Timestamp lines
        trimmed.includes('pyannote') ||
        trimmed.includes('torch') ||
        trimmed.includes('UserWarning') ||
        trimmed.includes('deprecated')
      ) {
        continue; // Skip this line
      }

      // Keep this line - it's likely actual transcription
      cleanedLines.push(trimmed);
    }

    // Join and return
    return cleanedLines.join(' ').trim();
  }

  /**
   * Get Python executable path (prefer root venv, fallback to system Python)
   */
  getPythonExecutable() {
    // Check for root venv Python (Windows)
    if (process.platform === 'win32' && fs.existsSync(ROOT_VENV_PYTHON_WIN)) {
      return ROOT_VENV_PYTHON_WIN;
    }
    // Check for root venv Python (Unix/Mac)
    if (fs.existsSync(ROOT_VENV_PYTHON_UNIX)) {
      return ROOT_VENV_PYTHON_UNIX;
    }
    // Fallback to system Python
    return null;
  }

  /**
   * Check if Python process is actually alive and working
   */
  isPythonProcAlive() {
    if (!this.pythonProc) return false;
    // Check if we've tracked that it exited
    if (this.pythonProcExited) return false;
    // Check if process was killed
    if (this.pythonProc.killed) return false;
    // Check if process has exited (exitCode is set when process exits)
    if (this.pythonProc.exitCode !== null) return false;
    // Check if process has no stdin (can't write to it)
    if (!this.pythonProc.stdin || this.pythonProc.stdin.destroyed) return false;
    return true;
  }

  /**
   * Ensure Python process is running
   */
  async ensurePythonProc() {
    // Check if process is actually alive (not just not killed)
    if (this.isPythonProcAlive()) return;

    // Check if there's a preloaded model for this meeting
    if (this.meetingId) {
      const ModelPreloader = require('./ModelPreloader');
      // Normalize meetingId to number (ModelPreloader stores it as number from Meeting.create)
      const meetingIdNum = typeof this.meetingId === 'string' ? parseInt(this.meetingId, 10) : this.meetingId;

      // First check if preload is in progress - wait for it to complete
      if (ModelPreloader.isPreloadInProgress(meetingIdNum)) {
        console.log(`⏳ Preload in progress for meeting ${this.meetingId}, waiting for completion...`);
        const preloaded = await ModelPreloader.waitForPreload(meetingIdNum);
        if (preloaded && preloaded.process) {
          const proc = preloaded.process;
          // Check if preloaded process is still alive
          if (proc && !proc.killed && proc.exitCode === null && proc.stdin && !proc.stdin.destroyed) {
            console.log(`✅ Reusing preloaded model for meeting ${this.meetingId} (looked up as ${meetingIdNum}) after waiting`);

            // Transfer ownership from preloader to TranscriptionService (removes from Map without killing process)
            ModelPreloader.transferModel(meetingIdNum);

            // Take ownership of the process
            this.pythonProc = proc;
            this.pythonStdoutBuffer = '';
            this.pythonResolvers = [];
            this.pythonProcExited = false;

            // Remove old handlers and set up TranscriptionService handlers
            proc.removeAllListeners('data');
            proc.removeAllListeners('close');
            proc.removeAllListeners('error');

            // Drain any leftover data from stdout before setting up new handlers
            // This prevents PRELOAD's empty line or any buffered data from consuming resolvers
            if (proc.stdout.readableLength > 0) {
              const leftover = proc.stdout.read();
              console.log(`⚠️  Drained ${leftover ? leftover.length : 0} bytes of leftover stdout data from preloaded process`);
            }

            // Set up stdout handler for transcription results
            proc.stdout.removeAllListeners('data');
            proc.stdout.on('data', (data) => {
              this.pythonStdoutBuffer += data.toString();
              let idx;
              while ((idx = this.pythonStdoutBuffer.indexOf('\n')) !== -1) {
                const line = this.pythonStdoutBuffer.slice(0, idx).trim();
                this.pythonStdoutBuffer = this.pythonStdoutBuffer.slice(idx + 1);

                // Skip empty lines (they shouldn't consume resolvers)
                if (line === '') {
                  console.log(`⚠️  Received empty line from Python stdout, skipping (should not happen)`);
                  continue;
                }

                // Filter out log messages that might have leaked to stdout
                // These look like: "2025-12-05 19:52:28 - whisperx.asr - WARNING - ..."
                if (line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+-\s+\w+\.\w+\s+-\s+(WARNING|INFO|DEBUG|ERROR)/)) {
                  console.warn(`⚠️  Filtered out log message from stdout (should be in stderr): "${line.substring(0, 80)}..."`);
                  continue; // Don't consume a resolver for log messages
                }

                const resolver = this.pythonResolvers.shift();
                if (resolver) {
                  // Resolve with text and the chunkIndex stored in the resolver
                  resolver.resolve(line);
                } else {
                  console.warn(`⚠️  Received transcription response but no resolver waiting: "${line.substring(0, 50)}..."`);
                }
              }
            });

            // Set up stderr handler
            proc.stderr.removeAllListeners('data');
            proc.stderr.on('data', (data) => {
              const stderrText = data.toString();
              if (stderrText.includes('[Error]') || stderrText.includes('Traceback')) {
                console.error(`[Python Error]: ${stderrText.trim()}`);
                if (this.pythonResolvers.length > 0) {
                  const resolver = this.pythonResolvers[0];
                  if (stderrText.includes('Traceback')) {
                    this.pythonResolvers.shift();
                    resolver.reject(new Error(stderrText));
                  }
                }
              }
            });

            // Set up process event handlers
            proc.on('close', (code) => {
              this.pythonProcExited = true;
              console.log(`⚠️  Python process closed with code ${code}`);
              while (this.pythonResolvers.length) {
                const r = this.pythonResolvers.shift();
                r.reject(new Error(`Python process closed with code ${code}`));
              }
            });

            proc.on('error', (error) => {
              this.pythonProcExited = true;
              console.error(`❌ Python process error: ${error.message}`);
              while (this.pythonResolvers.length) {
                const r = this.pythonResolvers.shift();
                r.reject(error);
              }
            });

            console.log(`✅ Preloaded process transferred to TranscriptionService for meeting ${this.meetingId}`);
            return;
          } else {
            // Preloaded process is dead after waiting, remove it
            console.log(`⚠️  Preloaded process for meeting ${this.meetingId} (looked up as ${meetingIdNum}) is dead after waiting, creating new one`);
            ModelPreloader.releaseModel(meetingIdNum);
          }
        } else {
          // Preload failed or timed out, continue to create new process
          console.log(`⚠️  Preload for meeting ${this.meetingId} did not complete successfully, creating new process`);
        }
      }

      // Check if there's already a completed preloaded model
      const preloaded = ModelPreloader.getPreloadedProcess(meetingIdNum);
      if (preloaded && preloaded.process) {
        const proc = preloaded.process;
        // Check if preloaded process is still alive
        if (proc && !proc.killed && proc.exitCode === null && proc.stdin && !proc.stdin.destroyed) {
          console.log(`✅ Reusing preloaded model for meeting ${this.meetingId} (looked up as ${meetingIdNum})`);

          // Transfer ownership from preloader to TranscriptionService (removes from Map without killing process)
          ModelPreloader.transferModel(meetingIdNum);

          // Take ownership of the process
          this.pythonProc = proc;
          this.pythonStdoutBuffer = '';
          this.pythonResolvers = [];
          this.pythonProcExited = false;

          // Remove old handlers and set up TranscriptionService handlers
          proc.removeAllListeners('data');
          proc.removeAllListeners('close');
          proc.removeAllListeners('error');

          // Drain any leftover data from stdout before setting up new handlers
          // This prevents PRELOAD's empty line or any buffered data from consuming resolvers
          if (proc.stdout.readableLength > 0) {
            const leftover = proc.stdout.read();
            console.log(`⚠️  Drained ${leftover ? leftover.length : 0} bytes of leftover stdout data from preloaded process`);
          }

          // Set up stdout handler for transcription results
          proc.stdout.removeAllListeners('data');
          proc.stdout.on('data', (data) => {
            this.pythonStdoutBuffer += data.toString();
            let idx;
            while ((idx = this.pythonStdoutBuffer.indexOf('\n')) !== -1) {
              const line = this.pythonStdoutBuffer.slice(0, idx).trim();
              this.pythonStdoutBuffer = this.pythonStdoutBuffer.slice(idx + 1);

              // Skip empty lines (they shouldn't consume resolvers)
              if (line === '') {
                console.log(`⚠️  Received empty line from Python stdout, skipping (should not happen)`);
                continue;
              }

              // Filter out log messages that might have leaked to stdout
              // These look like: "2025-12-05 19:52:28 - whisperx.asr - WARNING - ..."
              if (line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+-\s+\w+\.\w+\s+-\s+(WARNING|INFO|DEBUG|ERROR)/)) {
                console.warn(`⚠️  Filtered out log message from stdout (should be in stderr): "${line.substring(0, 80)}..."`);
                continue; // Don't consume a resolver for log messages
              }

              const resolver = this.pythonResolvers.shift();
              if (resolver) {
                // Resolve with text and the chunkIndex stored in the resolver
                resolver.resolve(line);
              } else {
                console.warn(`⚠️  Received transcription response but no resolver waiting: "${line.substring(0, 50)}..."`);
              }
            }
          });

          // Set up stderr handler
          proc.stderr.removeAllListeners('data');
          proc.stderr.on('data', (data) => {
            const stderrText = data.toString();
            if (stderrText.includes('[Error]') || stderrText.includes('Traceback')) {
              console.error(`[Python Error]: ${stderrText.trim()}`);
              if (this.pythonResolvers.length > 0) {
                const resolver = this.pythonResolvers[0];
                if (stderrText.includes('Traceback')) {
                  this.pythonResolvers.shift();
                  resolver.reject(new Error(stderrText));
                }
              }
            }
          });

          // Set up process event handlers
          proc.on('close', (code) => {
            this.pythonProcExited = true;
            console.log(`⚠️  Python process closed with code ${code}`);
            while (this.pythonResolvers.length) {
              const r = this.pythonResolvers.shift();
              r.reject(new Error(`Python process closed with code ${code}`));
            }
          });

          proc.on('error', (error) => {
            this.pythonProcExited = true;
            console.error(`❌ Python process error: ${error.message}`);
            while (this.pythonResolvers.length) {
              const r = this.pythonResolvers.shift();
              r.reject(error);
            }
          });

          console.log(`✅ Preloaded process transferred to TranscriptionService for meeting ${this.meetingId}`);
          return;
        } else {
          // Preloaded process is dead, remove it
          console.log(`⚠️  Preloaded process for meeting ${this.meetingId} (looked up as ${meetingIdNum}) is dead, creating new one`);
          ModelPreloader.releaseModel(meetingIdNum);
        }
      } else {
        // No preloaded model found - log for debugging
        const allPreloadedIds = ModelPreloader.getPreloadedMeetingIds();
        const inProgressIds = ModelPreloader.getPreloadsInProgressIds();
        console.log(`ℹ️  No preloaded model found for meeting ${this.meetingId} (looked up as ${meetingIdNum}). Available preloaded meetings: [${allPreloadedIds.join(', ')}]. Preloads in progress: [${inProgressIds.join(', ')}]`);
      }
    }

    // If process exists but is dead, clear it
    if (this.pythonProc) {
      console.log('⚠️  Python process is dead, restarting...');
      try {
        if (!this.pythonProc.killed) {
          this.pythonProc.kill();
        }
      } catch (e) {
        // Ignore errors when killing dead process
      }
      this.pythonProc = null;
    }

    // Try root venv Python first, then fallback to system Python
    const venvPython = this.getPythonExecutable();
    const candidates = venvPython
      ? [venvPython, 'py -3.10', 'python3.10', 'python', 'py']
      : ['py -3.10', 'python3.10', 'python', 'py'];
    let started = false;

    for (const cmd of candidates) {
      try {
        // Check if cmd is a full path (contains path separators)
        const isFullPath = cmd.includes(path.sep) || (process.platform === 'win32' && cmd.includes('\\'));

        // For full paths, don't use shell mode and pass executable + script separately
        // For command strings like 'py -3.10', use shell mode
        const spawnOptions = isFullPath
          ? { shell: false } // Direct execution, no shell
          : { shell: process.platform === 'win32' }; // Use shell for command strings

        const proc = spawn(cmd, [PY_SCRIPT_PATH], spawnOptions);

        this.pythonProc = proc;
        this.pythonStdoutBuffer = '';
        this.pythonResolvers = [];
        this.pythonProcExited = false; // Track if process has exited

        proc.stdout.on('data', (data) => {
          this.pythonStdoutBuffer += data.toString();
          let idx;
          while ((idx = this.pythonStdoutBuffer.indexOf('\n')) !== -1) {
            const line = this.pythonStdoutBuffer.slice(0, idx).trim();
            this.pythonStdoutBuffer = this.pythonStdoutBuffer.slice(idx + 1);

            // Skip empty lines (they shouldn't consume resolvers)
            if (line === '') {
              console.log(`⚠️  Received empty line from Python stdout, skipping`);
              continue;
            }

            // Filter out log messages that might have leaked to stdout
            // These look like: "2025-12-05 19:52:28 - whisperx.asr - WARNING - ..."
            if (line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+-\s+\w+\.\w+\s+-\s+(WARNING|INFO|DEBUG|ERROR)/)) {
              console.warn(`⚠️  Filtered out log message from stdout (should be in stderr): "${line.substring(0, 80)}..."`);
              continue; // Don't consume a resolver for log messages
            }

            const resolver = this.pythonResolvers.shift();
            if (resolver) {
              resolver.resolve(line);
            } else {
              console.warn(`⚠️  Received transcription response but no resolver waiting: "${line.substring(0, 50)}..."`);
            }
          }
        });

        proc.stderr.on('data', (data) => {
          // Log stderr but don't reject - it might be warnings/info, not errors
          // DO NOT shift resolvers here - stderr is separate from stdout
          const stderrText = data.toString();
          // Only log actual errors, filter out warnings/info
          if (stderrText.includes('[Error]') || stderrText.includes('Traceback')) {
            console.error(`[Python Error]: ${stderrText.trim()}`);
            // Only reject if there's a resolver waiting (but don't shift it here)
            if (this.pythonResolvers.length > 0) {
              const resolver = this.pythonResolvers[0]; // Peek, don't shift
              // Only reject if it's a critical error
              if (stderrText.includes('Traceback')) {
                this.pythonResolvers.shift();
                resolver.reject(new Error(stderrText));
              }
            }
          } else {
            // Log warnings/info to console but don't treat as fatal
            // Filter out common warnings that aren't errors
            if (!stderrText.includes('UserWarning') &&
              !stderrText.includes('deprecated') &&
              !stderrText.includes('INFO') &&
              !stderrText.includes('WARNING') &&
              !stderrText.includes('Model was trained')) {
              // Only log if it's not a common warning
              if (stderrText.trim().length > 0) {
                console.log(`[Python stderr]: ${stderrText.trim()}`);
              }
            }
          }
        });

        proc.on('close', (code) => {
          this.pythonProcExited = true;
          console.log(`⚠️  Python process closed with code ${code}`);
          // Reject all pending resolvers
          while (this.pythonResolvers.length) {
            const r = this.pythonResolvers.shift();
            r.reject(new Error(`Python process closed with code ${code}`));
          }
        });

        proc.on('error', (error) => {
          this.pythonProcExited = true;
          console.error(`❌ Python process error: ${error.message}`);
          // Reject all pending resolvers
          while (this.pythonResolvers.length) {
            const r = this.pythonResolvers.shift();
            r.reject(error);
          }
        });

        started = true;
        break;
      } catch (error) {
        // Try next candidate
        continue;
      }
    }

    if (!started) {
      throw new Error('Failed to start Python process - no valid Python command found');
    }
  }

  /**
   * Process transcription queue sequentially
   * @private
   */
  async _processTranscriptionQueue() {
    if (this.processingTranscription || this.transcriptionQueue.length === 0) {
      return;
    }

    this.processingTranscription = true;

    while (this.transcriptionQueue.length > 0) {
      const { audioPath, chunkIndex, resolve, reject } = this.transcriptionQueue.shift();

      try {
        // Ensure process exists and is alive (wait for preload if in progress)
        await this.ensurePythonProc();

        if (!this.isPythonProcAlive()) {
          // Fallback to one-shot mode
          console.log('⚠️  Persistent Python process not alive, using one-shot mode');
          const text = await this.runPythonOneShot(audioPath);
          resolve({ text, chunkIndex });
          continue;
        }

        // Send request and wait for response (with chunkIndex)
        const result = await this._sendSingleRequest(audioPath, chunkIndex);
        resolve(result);
      } catch (error) {
        // Try one-shot as fallback
        try {
          const text = await this.runPythonOneShot(audioPath);
          resolve({ text, chunkIndex });
        } catch (oneShotError) {
          reject(oneShotError);
        }
      }
    }

    this.processingTranscription = false;
  }

  /**
   * Send a single transcription request to Python process
   * @param {string} audioPath - Path to audio file
   * @param {number|null} chunkIndex - Chunk index for correlation
   * @returns {Promise<{text: string, chunkIndex: number|null}>} - Transcription text and chunk index
   * @private
   */
  _sendSingleRequest(audioPath, chunkIndex = null) {
    return new Promise((resolve, reject) => {
      let timeout = null;

      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
      };

      // Add timeout to prevent hanging forever
      timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Transcription timeout - Python process did not respond within 30 seconds'));
      }, 30000); // 30 second timeout

      // Create resolver wrapper that cleans up timeout and stores chunkIndex
      const resolverWrapper = {
        chunkIndex: chunkIndex, // Store chunkIndex with resolver
        resolve: (text) => {
          cleanup();
          resolve({ text, chunkIndex }); // Return both text and chunkIndex
        },
        reject: (error) => {
          cleanup();
          reject(error);
        }
      };

      // Add to resolver queue (only one at a time since we process sequentially)
      this.pythonResolvers.push(resolverWrapper);

      try {
        if (!this.pythonProc.stdin || this.pythonProc.stdin.destroyed) {
          cleanup();
          this.pythonResolvers.pop(); // Remove the resolver we just added
          return reject(new Error('Python process stdin is not available'));
        }

        this.pythonProc.stdin.write(audioPath + '\n');
      } catch (e) {
        cleanup();
        this.pythonResolvers.pop(); // Remove the resolver we just added
        return reject(e);
      }
    });
  }

  /**
   * Send audio path to persistent Python process (queued for sequential processing)
   * @param {string} audioPath - Path to audio file
   * @param {number|null} chunkIndex - Chunk index for correlation
   * @returns {Promise<{text: string, chunkIndex: number|null}>} - Transcription text and chunk index
   */
  sendToPython(audioPath, chunkIndex = null) {
    return new Promise((resolve, reject) => {
      // Add to queue for sequential processing with chunkIndex
      this.transcriptionQueue.push({ audioPath, chunkIndex, resolve, reject });

      // Start processing queue if not already processing
      this._processTranscriptionQueue();
    }).then((result) => {
      // Clean the text before returning
      return {
        text: this.cleanTranscriptionText(result.text),
        chunkIndex: result.chunkIndex
      };
    });
  }

  /**
   * Run Python transcription as one-shot process (fallback)
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<string>} - Transcription text
   */
  runPythonOneShot(audioPath) {
    return new Promise((resolve, reject) => {
      // Try root venv Python first, then fallback to system Python
      const venvPython = this.getPythonExecutable();
      const candidates = venvPython
        ? [venvPython, 'py -3.10', 'python3.10', 'python', 'py']
        : ['py -3.10', 'python3.10', 'python', 'py'];
      let attempt = 0;

      const tryOne = () => {
        if (attempt >= candidates.length) {
          return reject(new Error('Python not found - tried all candidates'));
        }

        const cmd = candidates[attempt++];
        // Check if cmd is a full path (contains path separators)
        const isFullPath = cmd.includes(path.sep) || (process.platform === 'win32' && cmd.includes('\\'));

        // For full paths, don't use shell mode and pass executable + script separately
        // For command strings like 'py -3.10', use shell mode
        const spawnOptions = isFullPath
          ? { shell: false } // Direct execution, no shell
          : { shell: process.platform === 'win32' }; // Use shell for command strings

        const proc = spawn(cmd, [PY_SCRIPT_PATH, audioPath], spawnOptions);

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', d => stdout += d.toString());
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('error', () => {
          // Try next candidate
          tryOne();
        });

        proc.on('close', (code) => {
          if (code === 0) {
            // Clean the output - remove any log lines that might have leaked to stdout
            const cleanedText = this.cleanTranscriptionText(stdout.trim());
            if (cleanedText) {
              return resolve(cleanedText);
            } else {
              // If no clean text, try next candidate
              if (attempt < candidates.length) {
                return tryOne();
              }
              return reject(new Error('No transcription text found in output'));
            }
          }
          if (attempt < candidates.length) {
            return tryOne();
          }
          return reject(new Error(stderr || `Python exited with code ${code}`));
        });
      };

      tryOne();
    });
  }

  /**
   * Perform speaker diarization on complete audio file
   * @param {string} completeAudioPath - Path to complete audio recording
   * @returns {Promise<object|null>} - Diarization result or null if failed
   */
  async performDiarization(completeAudioPath) {
    try {
      console.log('\n🎭 Starting speaker diarization...');
      console.log(`   Audio file: ${path.basename(completeAudioPath)}`);

      if (!fs.existsSync(completeAudioPath)) {
        console.error(`❌ Audio file not found: ${completeAudioPath}`);
        return null;
      }

      // Call Python script with diarization flag
      const result = await this.runDiarizationPython(completeAudioPath);

      if (!result || !result.segments) {
        console.warn('⚠️  Diarization returned no segments');
        // Save outputs without diarization
        await this.saveDiarizedOutputs();
        return null;
      }

      console.log(`✅ Diarization complete: ${result.segments.length} segments found`);

      // Map diarized segments to our utterances
      this.assignSpeakersToUtterances(result.segments);

      // Save diarized outputs
      await this.saveDiarizedOutputs();

      return result;
    } catch (error) {
      console.error('❌ Diarization failed:', error.message);
      // Still save outputs without diarization
      await this.saveDiarizedOutputs();
      return null;
    }
  }

  /**
   * Run Python script in diarization mode
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<object>} - Diarization result with segments
   */
  async runDiarizationPython(audioPath) {
    return new Promise((resolve, reject) => {
      // Try root venv Python first, then fallback to system Python
      const venvPython = this.getPythonExecutable();
      const candidates = venvPython
        ? [venvPython, 'py -3.10', 'python3.10', 'python', 'py']
        : ['py -3.10', 'python3.10', 'python', 'py'];
      let attempt = 0;

      const tryOne = () => {
        if (attempt >= candidates.length) {
          return reject(new Error('Python not found for diarization'));
        }

        const cmd = candidates[attempt++];
        // Check if cmd is a full path (contains path separators)
        const isFullPath = cmd.includes(path.sep) || (process.platform === 'win32' && cmd.includes('\\'));

        // For full paths, don't use shell mode and pass executable + script separately
        // For command strings like 'py -3.10', use shell mode
        const spawnOptions = isFullPath
          ? { shell: false } // Direct execution, no shell
          : { shell: process.platform === 'win32' }; // Use shell for command strings

        // Add --diarize flag to Python script
        const proc = spawn(cmd, [PY_SCRIPT_PATH, audioPath, '--diarize'], spawnOptions);

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', d => stdout += d.toString());
        proc.stderr.on('data', d => stderr += d.toString());

        proc.on('error', () => {
          // Try next candidate
          tryOne();
        });

        proc.on('close', (code) => {
          if (code === 0) {
            try {
              // Extract JSON from stdout (might have log messages mixed in)
              // Look for the JSON object (starts with { and ends with })
              const jsonStart = stdout.indexOf('{');
              const jsonEnd = stdout.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
                const result = JSON.parse(jsonStr);
                return resolve(result);
              } else {
                // Try parsing the whole stdout as JSON
                const result = JSON.parse(stdout.trim());
                return resolve(result);
              }
            } catch (parseError) {
              console.warn('⚠️  Could not parse diarization JSON:', parseError.message);
              console.log('Raw stdout:', stdout.substring(0, 500));
              console.log('Raw stderr:', stderr.substring(0, 500));
              return resolve({ segments: [] });
            }
          }
          if (attempt < candidates.length) {
            return tryOne();
          }
          return reject(new Error(stderr || `Diarization failed with code ${code}`));
        });
      };

      tryOne();
    });
  }

  /**
   * Map diarized segments to utterances based on timing
   * @param {Array} segments - Diarized segments from Python script
   */
  assignSpeakersToUtterances(segments) {
    console.log('🔗 Mapping speakers to utterances...');

    for (const utterance of this.utterances) {
      // Find diarized segment that overlaps with this utterance's time range
      const matchingSegment = segments.find(seg => {
        const overlapStart = Math.max(seg.start, utterance.start_time);
        const overlapEnd = Math.min(seg.end, utterance.end_time);
        const overlap = overlapEnd - overlapStart;

        // If there's significant overlap (>50% of utterance duration)
        const utteranceDuration = utterance.end_time - utterance.start_time;
        return overlap > (utteranceDuration * 0.5);
      });

      if (matchingSegment) {
        utterance.speaker = matchingSegment.speaker;
        utterance.diarized_start = matchingSegment.start;
        utterance.diarized_end = matchingSegment.end;
      } else {
        utterance.speaker = 'UNKNOWN';
      }
    }

    console.log(`✅ Assigned speakers to ${this.utterances.length} utterances`);
  }

  /**
   * Save diarized outputs in multiple formats
   */
  async saveDiarizedOutputs() {
    try {
      // 1. Save JSON format (structured data)
      const jsonOutput = {
        metadata: {
          generated: new Date().toISOString(),
          total_utterances: this.utterances.length,
          speakers: [...new Set(this.utterances.map(u => u.speaker).filter(s => s))],
          duration_seconds: this.utterances.length > 0
            ? Math.max(...this.utterances.map(u => u.end_time))
            : 0
        },
        utterances: this.utterances
      };

      fs.writeFileSync(
        this.diarizedJsonPath,
        JSON.stringify(jsonOutput, null, 2)
      );
      console.log(`✅ Diarized JSON saved: ${path.basename(this.diarizedJsonPath)}`);

      // 2. Save human-readable text format
      let textOutput = `Kairo Speaker-Diarized Transcript\n`;
      textOutput += `Generated: ${new Date().toISOString()}\n`;
      textOutput += `${'='.repeat(80)}\n\n`;

      for (const utterance of this.utterances) {
        const speaker = utterance.speaker || 'UNKNOWN';
        const timeRange = `[${utterance.start_time.toFixed(1)}s - ${utterance.end_time.toFixed(1)}s]`;
        textOutput += `${speaker} ${timeRange}:\n${utterance.text}\n\n`;
      }

      fs.writeFileSync(this.diarizedTextPath, textOutput);
      console.log(`✅ Diarized text saved: ${path.basename(this.diarizedTextPath)}`);

      // 3. Optional: Save SRT subtitle format
      const srtPath = path.join(this.meetingDataDir, 'transcript_diarized.srt');
      const srtContent = this.generateSRT();
      fs.writeFileSync(srtPath, srtContent);
      console.log(`✅ SRT subtitles saved: ${path.basename(srtPath)}`);

    } catch (error) {
      console.error('❌ Error saving diarized outputs:', error.message);
    }
  }

  /**
   * Generate SRT subtitle format
   * @returns {string} - SRT formatted content
   */
  generateSRT() {
    let srt = '';

    this.utterances.forEach((utterance, index) => {
      const startTime = this.formatSRTTime(utterance.start_time);
      const endTime = this.formatSRTTime(utterance.end_time);
      const speaker = utterance.speaker || 'UNKNOWN';

      srt += `${index + 1}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      srt += `[${speaker}] ${utterance.text}\n\n`;
    });

    return srt;
  }

  /**
   * Format seconds to SRT time format (HH:MM:SS,mmm)
   * @param {number} seconds - Time in seconds
   * @returns {string} - Formatted time string
   */
  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  }

  /**
   * Finalize transcription: perform diarization and generate all outputs
   * @param {string} completeAudioPath - Path to complete audio recording
   * @returns {Promise<object>} - Statistics object
   */
  async finalize(completeAudioPath) {
    console.log('\n📊 Finalizing transcription outputs...');
    console.log(`   Chunks processed: ${this.chunkCount}`);
    console.log(`   Utterances collected: ${this.utterances.length}`);

    try {
      // Ensure complete transcript file exists and has content
      if (!fs.existsSync(this.completeTranscriptPath) || fs.statSync(this.completeTranscriptPath).size < 100) {
        console.warn('⚠️  Complete transcript file is empty or missing, generating from utterances...');
        // Regenerate from utterances if file is empty
        const header = `Kairo Complete Transcript\nGenerated: ${new Date().toISOString()}\n${'='.repeat(80)}\n\n`;
        let content = header;
        for (const utterance of this.utterances) {
          content += `[Chunk ${utterance.chunk}] [${utterance.timestamp}]\n${utterance.text}\n\n`;
        }
        fs.writeFileSync(this.completeTranscriptPath, content);
        console.log(`✅ Regenerated complete transcript from ${this.utterances.length} utterances`);
      }

      // 1. Perform speaker diarization on complete audio
      if (completeAudioPath && fs.existsSync(completeAudioPath)) {
        console.log(`\n🎭 Performing diarization on complete audio: ${path.basename(completeAudioPath)}`);
        await this.performDiarization(completeAudioPath);
      } else {
        console.warn('⚠️  Complete audio file not available for diarization');
        console.log('   Generating transcript without speaker diarization...');
        // Save outputs without diarization
        await this.saveDiarizedOutputs();
      }

      // 2. Generate summary statistics
      const stats = this.generateStatistics();
      const statsPath = path.join(this.meetingDataDir, 'transcript_stats.json');
      fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
      console.log(`✅ Statistics saved: ${path.basename(statsPath)}`);

      // 3. Trigger AI insights generation (async, non-blocking)
      // This runs after diarized transcript is saved, but doesn't block finalization
      if (this.meetingId) {
        try {
          const AIInsightsService = require('./AIInsightsService');
          console.log(`\n🧠 [TranscriptionService.finalize] Triggering AI insights generation for meeting ${this.meetingId}...`);
          // Run asynchronously - don't block transcription finalization
          AIInsightsService.generateInsights(this.meetingId)
            .then((result) => {
              if (result.success) {
                if (result.skipped) {
                  console.log(`ℹ️  [TranscriptionService.finalize] AI insights already exist for meeting ${this.meetingId}`);
                } else {
                  console.log(`✅ [TranscriptionService.finalize] AI insights generation completed for meeting ${this.meetingId}`);
                }
              } else {
                console.error(`⚠️  [TranscriptionService.finalize] AI insights generation failed for meeting ${this.meetingId}: ${result.error}`);
              }
            })
            .catch((err) => {
              console.error(`⚠️  [TranscriptionService.finalize] AI insights generation error for meeting ${this.meetingId}:`, err.message);
            });
        } catch (error) {
          console.error(`⚠️  [TranscriptionService.finalize] Failed to trigger AI insights for meeting ${this.meetingId}:`, error.message);
        }
      } else {
        console.log(`⚠️  [TranscriptionService.finalize] No meeting ID available, skipping AI insights generation`);
      }

      // 4. Verify all output files exist
      const outputFiles = {
        'Complete transcript': this.completeTranscriptPath,
        'Diarized JSON': this.diarizedJsonPath,
        'Diarized text': this.diarizedTextPath,
        'SRT subtitles': path.join(this.meetingDataDir, 'transcript_diarized.srt'),
        'Statistics': statsPath
      };

      console.log(`\n📋 Transcription Summary:`);
      console.log(`   Total chunks processed: ${this.chunkCount}`);
      console.log(`   Total utterances: ${this.utterances.length}`);
      console.log(`   Speakers identified: ${stats.speakers.length}`);
      console.log(`   Total words: ${stats.total_words}`);
      console.log(`   Duration: ${stats.duration_seconds.toFixed(1)}s`);
      console.log(`\n📁 Output files:`);
      for (const [name, filePath] of Object.entries(outputFiles)) {
        const exists = fs.existsSync(filePath);
        const size = exists ? fs.statSync(filePath).size : 0;
        const status = exists && size > 0 ? '✅' : '⚠️';
        console.log(`   ${status} ${name}: ${path.basename(filePath)} (${(size / 1024).toFixed(1)} KB)`);
      }
      console.log(`   └─ Individual chunks: transcripts/ (${this.chunkCount} files)`);

      return stats;
    } catch (error) {
      console.error('❌ Error during finalization:', error.message);
      console.error('   Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Generate statistics about the transcription
   * @returns {object} - Statistics object
   */
  generateStatistics() {
    const speakers = [...new Set(this.utterances.map(u => u.speaker).filter(s => s && s !== 'UNKNOWN'))];
    const totalWords = this.utterances.reduce((sum, u) => sum + u.text.split(/\s+/).length, 0);
    const duration = this.utterances.length > 0
      ? Math.max(...this.utterances.map(u => u.end_time))
      : 0;

    // Calculate speaking time per speaker
    const speakerStats = {};
    speakers.forEach(speaker => {
      const speakerUtterances = this.utterances.filter(u => u.speaker === speaker);
      const speakingTime = speakerUtterances.reduce((sum, u) => sum + (u.end_time - u.start_time), 0);
      const wordCount = speakerUtterances.reduce((sum, u) => sum + u.text.split(/\s+/).length, 0);

      speakerStats[speaker] = {
        utterance_count: speakerUtterances.length,
        speaking_time_seconds: speakingTime,
        word_count: wordCount,
        speaking_percentage: duration > 0 ? ((speakingTime / duration) * 100).toFixed(1) : '0.0'
      };
    });

    return {
      total_chunks: this.chunkCount,
      total_utterances: this.utterances.length,
      total_words: totalWords,
      duration_seconds: duration,
      speakers: speakers,
      speaker_statistics: speakerStats,
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Cleanup: Stop Python process and clear resources
   */
  cleanup() {
    try {
      // Log final state
      console.log('\n📊 Final transcription state:');
      console.log(`   Total chunks processed: ${this.chunkCount}`);
      console.log(`   Total utterances: ${this.utterances.length}`);

      if (this.pythonProc && !this.pythonProc.killed) {
        // Send EXIT command to Python process
        try {
          this.pythonProc.stdin?.write('EXIT\n');
        } catch (e) {
          // stdin might be closed
        }

        // Kill the process
        this.pythonProc.kill();
        this.pythonProc = null;
        console.log('✅ Python process stopped');
      }

      // Clear state
      this.pythonStdoutBuffer = '';
      this.pythonResolvers = [];

      console.log('✅ TranscriptionService cleanup completed');
    } catch (error) {
      console.error('⚠️  Error during TranscriptionService cleanup:', error.message);
    }
  }
}

module.exports = TranscriptionService;

