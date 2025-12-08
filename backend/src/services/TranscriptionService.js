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
    this.pythonResolvers = []; // Keep for backward compatibility, but use pendingRequests as source of truth
    this.pendingRequests = new Map(); // Map<requestId, {resolver, chunkIndex, audioPath, timestamp}>
    this.nextRequestId = 1; // Auto-incrementing request ID
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
    this.firstTimestamp = null; // Track first chunk timestamp for relative time calculation

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
        
        // Check if it's a ModuleNotFoundError - this means persistent process has wrong Python
        if (error.message && error.message.includes('ModuleNotFoundError')) {
          console.error('❌ Persistent process using wrong Python environment (missing whisperx)');
          // Kill and restart persistent process with correct Python
          try {
            if (this.pythonProc && !this.pythonProc.killed) {
              this.pythonProc.kill();
            }
            this.pythonProc = null;
            console.log('🔄 Clearing persistent process - will restart with correct Python on next request');
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        
        try {
          const text = await this.runPythonOneShot(audioPath);
          transcriptionResult = { text, chunkIndex };
        } catch (oneShotError) {
          // Check for ModuleNotFoundError and provide helpful message
          if (oneShotError.message && oneShotError.message.includes('whisperx')) {
            console.error(`❌ Transcription failed: whisperx not available in any Python environment`);
            return { 
              success: false, 
              text: '', 
              chunk: chunkIndex, 
              error: 'whisperx module not found. Please install whisperx in your Python environment.' 
            };
          }
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
        const timestampDate = new Date(timestamp);
        
        // Track first timestamp to calculate relative timestamps
        if (this.firstTimestamp === null) {
          this.firstTimestamp = timestampDate;
        }
        
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

        // Calculate actual timestamps relative to first chunk (in seconds)
        // This gives us the real time offset from the start of the meeting
        const relativeTimeSeconds = (timestampDate - this.firstTimestamp) / 1000;
        
        // Estimate duration based on text length (average speaking rate ~150 words/min = 2.5 words/sec)
        // Fallback to 3 seconds if text is very short
        const wordCount = cleanedText.trim().split(/\s+/).length;
        const estimatedDuration = Math.max(1.0, Math.min(5.0, wordCount / 2.5)); // Between 1-5 seconds

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

        // 3. Store utterance for diarization with actual timestamps
        // start_time and end_time are relative to meeting start (in seconds)
        // These will be refined by diarization if available
        this.utterances.push({
          chunk: chunkNum,
          timestamp: timestamp, // ISO timestamp for reference
          audioFile: path.basename(audioPath),
          text: cleanedText.trim(), // Use cleaned text
          speaker: null, // Will be assigned during diarization
          start_time: relativeTimeSeconds, // Actual time from meeting start
          end_time: relativeTimeSeconds + estimatedDuration, // Estimated end time
          diarized_start: null, // Will be set during diarization if available
          diarized_end: null // Will be set during diarization if available
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
        console.log(`✅ Chunk ${chunkNum} transcription done`);
        
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
   * Validate that a response line looks like transcription text (Issue 8)
   * @param {string} line - Line from Python stdout
   * @returns {boolean} - True if line appears to be transcription text
   * @private
   */
  _validateTranscriptionResponse(line) {
    if (!line || typeof line !== 'string') {
      return false;
    }
    
    // Must be at least 5 characters (very short lines are likely not transcription)
    if (line.length < 5) {
      return false;
    }
    
    // Must contain at least one letter (transcription should have words)
    if (!line.match(/[a-zA-Z]/)) {
      return false;
    }
    
    // Should not be all uppercase (likely a status message or command)
    if (line.length > 10 && line === line.toUpperCase() && !line.match(/[a-z]/)) {
      return false;
    }
    
    // Should not start with common log prefixes
    if (line.match(/^(Using|Loading|Starting|Error|Warning|Failed|Success|Model|Device|Compute|Detected|Performing|Audio|Language|Preloading|Streaming|Send|Type|EXIT|Quit)/i)) {
      return false;
    }
    
    // Should not be a command or instruction
    if (line.match(/^(Type|Send|Enter|Press|Click|Select|Choose|Input|Output|Command|Usage|Help|Options|Arguments)/i)) {
      return false;
    }
    
    // Should contain some lowercase letters (transcription is usually mixed case)
    // Exception: Very short lines might be all caps (like "OK" or "YES")
    if (line.length > 15 && !line.match(/[a-z]/)) {
      return false;
    }
    
    // Should not be mostly numbers or symbols
    const letterCount = (line.match(/[a-zA-Z]/g) || []).length;
    const totalChars = line.replace(/\s/g, '').length;
    if (totalChars > 0 && letterCount / totalChars < 0.3) {
      // Less than 30% letters - likely not transcription
      return false;
    }
    
    // If we get here, it might be transcription
    return true;
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
   * Validate that Python executable has whisperx available
   * @param {string} pythonCmd - Python command to test
   * @returns {Promise<boolean>} - True if whisperx is available
   */
  async validatePythonEnvironment(pythonCmd) {
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
   * Set up stdout/stderr/event handlers for a Python process
   * @param {ChildProcess} proc - Python process to set up handlers for
   * @param {boolean} isSharedProcess - If true, don't remove existing listeners (for global model)
   * @private
   */
  _setupProcessHandlers(proc, isSharedProcess = false) {
    // Only remove existing handlers if this is NOT a shared process
    // Shared processes (global model) may have handlers from other instances
    if (!isSharedProcess) {
      proc.removeAllListeners('data');
      proc.removeAllListeners('close');
      proc.removeAllListeners('error');
      proc.stdout.removeAllListeners('data');
      proc.stderr.removeAllListeners('data');
    }
    
    // Handle leftover stdout data BEFORE setting up new handlers
    // Try to match leftover data to pending requests
    if (!isSharedProcess && proc.stdout.readableLength > 0) {
      const leftover = proc.stdout.read();
      const leftoverStr = leftover.toString();
      console.log(`⚠️  Found ${leftoverStr.length} bytes of leftover stdout data, attempting to match...`);
      
      // Try to parse leftover data as response lines
      const lines = leftoverStr.split('\n').map(l => l.trim()).filter(l => l);
      for (const line of lines) {
        // Skip empty lines
        if (line === '') continue;
        
        // Apply same comprehensive filtering as main stdout handler (Issue 6)
        // Pattern 1: Timestamped log messages
        if (line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+-\s+\w+\.\w+\s+-\s+(WARNING|INFO|DEBUG|ERROR)/)) {
          console.warn(`⚠️  Leftover data contains log message, skipping: "${line.substring(0, 50)}..."`);
          continue;
        }
        
        // Pattern 2: Status messages
        if (line.match(/^(Global model loaded successfully|Model loaded successfully|Model was trained|Detected language:|Performing voice activity|Audio is shorter|language will be detected)/i)) {
          console.warn(`⚠️  Leftover data contains status message, skipping: "${line.substring(0, 50)}..."`);
          continue;
        }
        
        // Pattern 3: Python/torch warnings and info messages
        if (line.match(/(torch|UserWarning|deprecated|pyannote|whisperx\.|\[Kairo\]|Starting streaming mode|Send audio file paths|Preloading model|Loading WhisperX model)/i)) {
          console.warn(`⚠️  Leftover data contains Python log message, skipping: "${line.substring(0, 50)}..."`);
          continue;
        }
        
        // Pattern 4: Suspicious lines (too short, all caps, etc.)
        if (line.length < 3 || line.match(/^[A-Z\s]{10,}$/)) {
          console.warn(`⚠️  Leftover data contains suspicious line, skipping: "${line.substring(0, 50)}..."`);
          continue;
        }
        
        // Issue 8: Validate response looks like transcription before matching
        if (!this._validateTranscriptionResponse(line)) {
          console.warn(`⚠️  Leftover data failed validation, skipping: "${line.substring(0, 50)}..."`);
          continue;
        }
        
        // Try to match to oldest pending request (Python processes sequentially)
        const oldestRequestId = Array.from(this.pendingRequests.keys())[0];
        if (oldestRequestId) {
          const pending = this.pendingRequests.get(oldestRequestId);
          console.log(`✅ Matched leftover data to pending request ${oldestRequestId} (chunk ${pending.chunkIndex})`);
          this.pendingRequests.delete(oldestRequestId);
          // Also remove from resolver array for backward compatibility
          const resolverIdx = this.pythonResolvers.findIndex(r => r.requestId === oldestRequestId);
          if (resolverIdx !== -1) {
            this.pythonResolvers.splice(resolverIdx, 1);
          }
          pending.resolver.resolve(line);
        } else {
          console.warn(`⚠️  Leftover data has no matching pending request: "${line.substring(0, 50)}..."`);
        }
      }
    }
    
    // Set up stdout handler for transcription results
    proc.stdout.on('data', (data) => {
      this.pythonStdoutBuffer += data.toString();
      let idx;
      while ((idx = this.pythonStdoutBuffer.indexOf('\n')) !== -1) {
        const line = this.pythonStdoutBuffer.slice(0, idx).trim();
        this.pythonStdoutBuffer = this.pythonStdoutBuffer.slice(idx + 1);
        
        // Skip empty lines
        if (line === '') {
          console.log(`⚠️  Received empty line from Python stdout, skipping`);
          continue;
        }
        
        // Filter out log messages BEFORE matching to resolver
        // Pattern 1: Timestamped log messages (e.g., "2025-12-08 21:22:02 - whisperx.asr - WARNING - ...")
        if (line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+-\s+\w+\.\w+\s+-\s+(WARNING|INFO|DEBUG|ERROR)/)) {
          console.warn(`⚠️  Filtered out log message from stdout: "${line.substring(0, 80)}..."`);
          continue; // Don't consume a resolver for log messages
        }
        
        // Pattern 2: "Global model loaded successfully" and similar status messages
        if (line.match(/^(Global model loaded successfully|Model loaded successfully|Model was trained|Detected language:|Performing voice activity|Audio is shorter|language will be detected)/i)) {
          console.warn(`⚠️  Filtered out status message from stdout: "${line.substring(0, 80)}..."`);
          continue;
        }
        
        // Pattern 3: Python/torch warnings and info messages
        if (line.match(/(torch|UserWarning|deprecated|pyannote|whisperx\.|\[Kairo\]|Starting streaming mode|Send audio file paths|Preloading model|Loading WhisperX model)/i)) {
          console.warn(`⚠️  Filtered out Python log message from stdout: "${line.substring(0, 80)}..."`);
          continue;
        }
        
        // Pattern 4: Lines that are clearly not transcription (too short, all caps, etc.)
        if (line.length < 3 || line.match(/^[A-Z\s]{10,}$/)) {
          console.warn(`⚠️  Filtered out suspicious line (likely not transcription): "${line.substring(0, 50)}..."`);
          continue;
        }
        
        // Issue 8: Validate response looks like transcription before matching
        if (!this._validateTranscriptionResponse(line)) {
          console.warn(`⚠️  Response failed validation, skipping: "${line.substring(0, 50)}..."`);
          continue;
        }
        
        // Match response to oldest pending request (Python processes sequentially)
        // This ensures responses are matched correctly even if some are delayed or lost
        const oldestRequestId = Array.from(this.pendingRequests.keys())[0];
        if (oldestRequestId) {
          const pending = this.pendingRequests.get(oldestRequestId);
          this.pendingRequests.delete(oldestRequestId);
          
          // Also remove from resolver array for backward compatibility
          const resolverIdx = this.pythonResolvers.findIndex(r => r.requestId === oldestRequestId);
          if (resolverIdx !== -1) {
            this.pythonResolvers.splice(resolverIdx, 1);
          }
          
          pending.resolver.resolve(line);
        } else {
          console.warn(`⚠️  Received transcription response but no pending request: "${line.substring(0, 50)}..."`);
        }
      }
    });
    
    // Set up stderr handler
    proc.stderr.on('data', (data) => {
      const stderrText = data.toString();
      if (stderrText.includes('[Error]') || stderrText.includes('Traceback')) {
        console.error(`[Python Error]: ${stderrText.trim()}`);
        // Reject oldest pending request on error
        if (stderrText.includes('Traceback')) {
          const oldestRequestId = Array.from(this.pendingRequests.keys())[0];
          if (oldestRequestId) {
            const pending = this.pendingRequests.get(oldestRequestId);
            this.pendingRequests.delete(oldestRequestId);
            
            // Also remove from resolver array
            const resolverIdx = this.pythonResolvers.findIndex(r => r.requestId === oldestRequestId);
            if (resolverIdx !== -1) {
              this.pythonResolvers.splice(resolverIdx, 1);
            }
            
            pending.resolver.reject(new Error(stderrText));
          }
        }
      }
    });
    
    // Set up process event handlers
    proc.on('close', (code) => {
      this.pythonProcExited = true;
      console.log(`⚠️  Python process closed with code ${code}`);
      
      // Reject all pending requests
      for (const [requestId, pending] of this.pendingRequests.entries()) {
        pending.resolver.reject(new Error(`Python process closed with code ${code}`));
      }
      this.pendingRequests.clear();
      
      // Also clear resolver array for backward compatibility
      while (this.pythonResolvers.length) {
        const r = this.pythonResolvers.shift();
        if (r.reject) {
          r.reject(new Error(`Python process closed with code ${code}`));
        }
      }
    });
    
    proc.on('error', (error) => {
      this.pythonProcExited = true;
      console.error(`❌ Python process error: ${error.message}`);
      
      // Reject all pending requests
      for (const [requestId, pending] of this.pendingRequests.entries()) {
        pending.resolver.reject(error);
      }
      this.pendingRequests.clear();
      
      // Also clear resolver array for backward compatibility
      while (this.pythonResolvers.length) {
        const r = this.pythonResolvers.shift();
        if (r.reject) {
          r.reject(error);
        }
      }
    });
  }

  /**
   * Ensure Python process is running
   */
  async ensurePythonProc() {
    // Check if process is actually alive
    if (this.isPythonProcAlive()) return;
    
    const ModelPreloader = require('./ModelPreloader');
    
    // PRIORITY 1: Try to get global model first
    console.log('🔍 Checking for global transcription model...');
    const globalModel = await ModelPreloader.getGlobalModel();
    
    if (globalModel && ModelPreloader.isProcessHealthy(globalModel.process)) {
      console.log('✅ Using global transcription model');
      this.pythonProc = globalModel.process;
      this.pythonStdoutBuffer = '';
      this.pythonResolvers = [];
      this.pendingRequests.clear(); // Clear any stale pending requests
      this.pythonProcExited = false;
      
      // Set up handlers for the global process (isSharedProcess=true to preserve other instances' handlers)
      this._setupProcessHandlers(globalModel.process, true);
      
      // IMPORTANT: Don't transfer ownership - global model stays in ModelPreloader
      // This allows multiple TranscriptionService instances to share the same process
      return;
    }
    
    // PRIORITY 2: Fallback to per-meeting preloaded model
    if (this.meetingId) {
      const meetingIdNum = typeof this.meetingId === 'string' ? parseInt(this.meetingId, 10) : this.meetingId;
      
      // Check if preload is in progress - wait for it
      if (ModelPreloader.isPreloadInProgress(meetingIdNum)) {
        console.log(`⏳ Per-meeting preload in progress for meeting ${this.meetingId}, waiting...`);
        const preloaded = await ModelPreloader.waitForPreload(meetingIdNum);
        
        if (preloaded && preloaded.process && ModelPreloader.isProcessHealthy(preloaded.process)) {
          console.log(`✅ Using per-meeting preloaded model for meeting ${this.meetingId}`);
          ModelPreloader.transferModel(meetingIdNum);
          
          this.pythonProc = preloaded.process;
          this.pythonStdoutBuffer = '';
          this.pythonResolvers = [];
          this.pendingRequests.clear(); // Clear any stale pending requests
          this.pythonProcExited = false;
          
          this._setupProcessHandlers(preloaded.process);
          return;
        }
      }
      
      // Check if already preloaded
      const preloaded = ModelPreloader.getPreloadedProcess(meetingIdNum);
      if (preloaded && preloaded.process && ModelPreloader.isProcessHealthy(preloaded.process)) {
        console.log(`✅ Using per-meeting preloaded model for meeting ${this.meetingId}`);
        ModelPreloader.transferModel(meetingIdNum);
        
        this.pythonProc = preloaded.process;
        this.pythonStdoutBuffer = '';
        this.pythonResolvers = [];
        this.pendingRequests.clear(); // Clear any stale pending requests
        this.pythonProcExited = false;
        
        this._setupProcessHandlers(preloaded.process);
        return;
      }
    }
    
    // PRIORITY 3: Create new process (fallback if global and per-meeting both fail)
    console.log('⚠️  No preloaded model available, creating new process...');
    
    // Clear dead process if exists
    if (this.pythonProc) {
      try {
        if (!this.pythonProc.killed) {
          this.pythonProc.kill();
        }
      } catch (e) {
        // Ignore
      }
      this.pythonProc = null;
    }
    
    // Spawn new process - CRITICAL: Only use venv Python (it has whisperx)
    const venvPython = this.getPythonExecutable();
    
    if (!venvPython) {
      throw new Error('Venv Python not found. Cannot start persistent process without venv Python (whisperx required).');
    }

    // Validate venv Python has whisperx before using it
    console.log('🔍 Validating venv Python has whisperx...');
    const hasWhisperx = await this.validatePythonEnvironment(venvPython);
    
    if (!hasWhisperx) {
      throw new Error(`Venv Python at ${venvPython} does not have whisperx installed. Please install whisperx in the venv.`);
    }

    console.log(`✅ Starting persistent process with validated Python: ${venvPython}`);
    
    try {
      const isFullPath = venvPython.includes(path.sep) || (process.platform === 'win32' && venvPython.includes('\\'));
      const spawnOptions = isFullPath 
        ? { shell: false }
        : { shell: process.platform === 'win32' };
      
      const proc = spawn(venvPython, [PY_SCRIPT_PATH], {
        cwd: path.dirname(PY_SCRIPT_PATH),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        ...spawnOptions
      });
      
      this.pythonProc = proc;
      this.pythonStdoutBuffer = '';
      this.pythonResolvers = [];
      this.pendingRequests.clear(); // Clear any stale pending requests
      this.pythonProcExited = false;
      
      this._setupProcessHandlers(proc);
      
      console.log('✅ Persistent Python process started successfully');
    } catch (error) {
      throw new Error(`Failed to start Python process with ${venvPython}: ${error.message}`);
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
          // Process is dead - clear it and fallback to one-shot mode
          console.log('⚠️  Persistent Python process not alive, clearing and using one-shot mode');
          try {
            if (this.pythonProc && !this.pythonProc.killed) {
              this.pythonProc.kill();
            }
          } catch (e) {
            // Ignore cleanup errors
          }
          this.pythonProc = null;
          
          const text = await this.runPythonOneShot(audioPath);
          resolve({ text, chunkIndex });
          continue;
        }

        // Send request and wait for response (with chunkIndex)
        const result = await this._sendSingleRequest(audioPath, chunkIndex);
        resolve(result);
      } catch (error) {
        // Check if persistent process has wrong Python environment
        if (error.message && error.message.includes('ModuleNotFoundError')) {
          console.error('❌ Persistent process error: wrong Python environment');
          // Clear the process so it can be restarted with correct Python
          try {
            if (this.pythonProc && !this.pythonProc.killed) {
              this.pythonProc.kill();
            }
            this.pythonProc = null;
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        
        // Try one-shot as fallback
        try {
          const text = await this.runPythonOneShot(audioPath);
          resolve({ text, chunkIndex });
        } catch (oneShotError) {
          // Provide better error message for ModuleNotFoundError
          if (oneShotError.message && oneShotError.message.includes('whisperx')) {
            reject(new Error('whisperx module not found in any Python environment. Please install whisperx.'));
          } else {
            reject(oneShotError);
          }
        }
      }
    }

    this.processingTranscription = false;
  }

  /**
   * Check if a transcription request is already pending for the given audioPath and chunkIndex
   * @param {string} audioPath - Path to audio file
   * @param {number|null} chunkIndex - Chunk index
   * @returns {Promise<{text: string, chunkIndex: number|null}>|null} - Existing promise if pending, null otherwise
   */
  getPendingRequest(audioPath, chunkIndex = null) {
    const existingRequest = Array.from(this.pendingRequests.values())
      .find(p => p.audioPath === audioPath && p.chunkIndex === chunkIndex);
    
    if (existingRequest) {
      // Return a promise that resolves/rejects when the existing request does
      return new Promise((resolve, reject) => {
        // Store original resolvers
        const originalResolve = existingRequest.resolver.resolve;
        const originalReject = existingRequest.resolver.reject;
        
        // Wrap original resolve to also resolve our promise
        existingRequest.resolver.resolve = (text) => {
          originalResolve(text);
          resolve({ text, chunkIndex });
        };
        
        // Wrap original reject to also reject our promise
        existingRequest.resolver.reject = (error) => {
          originalReject(error);
          reject(error);
        };
      });
    }
    
    return null;
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
      const requestId = this.nextRequestId++;
      
      // Check if this exact audioPath is already pending (prevent duplicate retries)
      const existingRequest = Array.from(this.pendingRequests.values())
        .find(p => p.audioPath === audioPath && p.chunkIndex === chunkIndex);
      
      if (existingRequest) {
        console.warn(`⚠️  Request for ${path.basename(audioPath)} (chunk ${chunkIndex}) is already pending, reusing existing request`);
        // Return the existing promise instead of creating a new one
        existingRequest.resolver.resolve = (text) => {
          resolve({ text, chunkIndex });
        };
        existingRequest.resolver.reject = (error) => {
          reject(error);
        };
        return; // Don't create duplicate request
      }
      
      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        // Remove from pending requests
        this.pendingRequests.delete(requestId);
      };

      // Add timeout to prevent hanging forever
      timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Transcription timeout - Python process did not respond within 30 seconds'));
      }, 30000); // 30 second timeout

      // Create resolver wrapper that cleans up timeout and stores chunkIndex
      const resolverWrapper = {
        requestId: requestId, // Track request ID
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
      
      // Add to pending requests map (keyed by requestId for tracking)
      this.pendingRequests.set(requestId, {
        resolver: resolverWrapper,
        chunkIndex: chunkIndex,
        audioPath: audioPath,
        timestamp: Date.now()
      });
      
      // Also add to resolver array for backward compatibility
      this.pythonResolvers.push(resolverWrapper);

      try {
        if (!this.pythonProc.stdin || this.pythonProc.stdin.destroyed) {
          cleanup();
          return reject(new Error('Python process stdin is not available'));
        }

        this.pythonProc.stdin.write(audioPath + '\n');
      } catch (e) {
        cleanup();
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
  async runPythonOneShot(audioPath) {
    return new Promise(async (resolve, reject) => {
      // CRITICAL: Always prioritize venv Python - it has whisperx installed
      const venvPython = this.getPythonExecutable();
      
      // Build candidate list - venv Python first, then system Python only if venv doesn't exist
      const candidates = venvPython
        ? [venvPython] // Only use venv Python if available - don't fallback to system Python
        : ['py -3.10', 'python3.10', 'python', 'py']; // Only if no venv exists
      
      let attempt = 0;
      const validatedCandidates = [];

      // First, validate which Python executables have whisperx
      console.log('🔍 Validating Python environments for whisperx...');
      for (const cmd of candidates) {
        const hasWhisperx = await this.validatePythonEnvironment(cmd);
        if (hasWhisperx) {
          validatedCandidates.push(cmd);
          console.log(`✅ Python environment validated: ${cmd}`);
        } else {
          console.warn(`⚠️  Python environment missing whisperx: ${cmd}`);
        }
      }

      // If no validated candidates, reject immediately with helpful error
      if (validatedCandidates.length === 0) {
        const errorMsg = venvPython
          ? `No Python environment with whisperx found. Venv Python exists at ${venvPython} but whisperx is not installed. Please install whisperx in the venv.`
          : 'No Python environment with whisperx found. Please ensure whisperx is installed in your Python environment.';
        return reject(new Error(errorMsg));
      }

      const tryOne = () => {
        if (attempt >= validatedCandidates.length) {
          return reject(new Error('All Python environments failed - tried all validated candidates'));
        }

        const cmd = validatedCandidates[attempt++];
        console.log(`🔄 Attempting transcription with: ${cmd}`);
        
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

        proc.on('error', (error) => {
          console.error(`❌ Process error with ${cmd}:`, error.message);
          // Try next candidate
          if (attempt < validatedCandidates.length) {
            return tryOne();
          }
          return reject(new Error(`Failed to spawn Python process: ${error.message}`));
        });

        proc.on('close', (code) => {
          // Check for ModuleNotFoundError specifically
          if (stderr.includes('ModuleNotFoundError') && stderr.includes('whisperx')) {
            console.error(`❌ ModuleNotFoundError: whisperx not found in ${cmd}`);
            // Try next validated candidate
            if (attempt < validatedCandidates.length) {
              return tryOne();
            }
            return reject(new Error(`whisperx module not found in Python environment: ${cmd}. Please install whisperx.`));
          }

          if (code === 0) {
            // Clean the output - remove any log lines that might have leaked to stdout
            const cleanedText = this.cleanTranscriptionText(stdout.trim());
            if (cleanedText) {
              console.log(`✅ Transcription successful with: ${cmd}`);
              return resolve(cleanedText);
            } else {
              // If no clean text, try next candidate
              if (attempt < validatedCandidates.length) {
                return tryOne();
              }
              return reject(new Error('No transcription text found in output'));
            }
          }
          
          // Non-zero exit code
          if (attempt < validatedCandidates.length) {
            console.warn(`⚠️  Python process exited with code ${code}, trying next candidate...`);
            return tryOne();
          }
          
          // All candidates failed
          const errorMsg = stderr || `Python exited with code ${code}`;
          return reject(new Error(`Transcription failed: ${errorMsg}`));
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
      // Calculate duration using the best available timestamps (diarized if available)
      const maxEndTime = this.utterances.length > 0
        ? Math.max(...this.utterances.map(u => {
            // Use diarized_end if available, otherwise use end_time
            return (u.diarized_end !== null && u.diarized_end !== undefined)
              ? u.diarized_end
              : u.end_time;
          }))
        : 0;
      
      const jsonOutput = {
        metadata: {
          generated: new Date().toISOString(),
          total_utterances: this.utterances.length,
          speakers: [...new Set(this.utterances.map(u => u.speaker).filter(s => s))],
          duration_seconds: maxEndTime
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
        
        // PRIORITY: Use diarized timestamps if available (most accurate)
        // Otherwise fall back to calculated timestamps from ISO timestamps
        const startTime = utterance.diarized_start !== null && utterance.diarized_start !== undefined
          ? utterance.diarized_start
          : utterance.start_time;
        const endTime = utterance.diarized_end !== null && utterance.diarized_end !== undefined
          ? utterance.diarized_end
          : utterance.end_time;
        
        const timeRange = `[${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s]`;
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
      // Use diarized timestamps if available, otherwise use calculated timestamps
      const startTime = utterance.diarized_start !== null && utterance.diarized_start !== undefined
        ? utterance.diarized_start
        : utterance.start_time;
      const endTime = utterance.diarized_end !== null && utterance.diarized_end !== undefined
        ? utterance.diarized_end
        : utterance.end_time;
      
      const startTimeFormatted = this.formatSRTTime(startTime);
      const endTimeFormatted = this.formatSRTTime(endTime);
      const speaker = utterance.speaker || 'UNKNOWN';

      srt += `${index + 1}\n`;
      srt += `${startTimeFormatted} --> ${endTimeFormatted}\n`;
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
   * Cancel all pending transcription requests gracefully
   */
  cancelPendingRequests() {
    const pendingCount = this.pendingRequests.size;
    if (pendingCount > 0) {
      console.log(`⏹️  Cancelling ${pendingCount} pending transcription request(s)...`);
      
      // Reject all pending requests with cancellation error
      for (const [requestId, pending] of this.pendingRequests.entries()) {
        try {
          pending.resolver.reject(new Error('Transcription cancelled - recording stopped'));
        } catch (e) {
          // Ignore errors from already-resolved promises
        }
      }
      
      // Clear pending requests
      this.pendingRequests.clear();
      
      // Also clear resolver array for backward compatibility
      while (this.pythonResolvers.length) {
        const r = this.pythonResolvers.shift();
        if (r.reject) {
          try {
            r.reject(new Error('Transcription cancelled - recording stopped'));
          } catch (e) {
            // Ignore errors from already-resolved promises
          }
        }
      }
      
      console.log(`✅ Cancelled ${pendingCount} pending transcription request(s)`);
    }
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
      
      // Cancel all pending requests gracefully before cleanup
      this.cancelPendingRequests();
      
      if (this.pythonProc && !this.pythonProc.killed) {
        // Check if this is the global model - don't kill it
        const ModelPreloader = require('./ModelPreloader');
        const globalProcess = ModelPreloader.getGlobalModelProcessSync();
        
        if (globalProcess && this.pythonProc === globalProcess) {
          console.log('ℹ️  Skipping cleanup of global model (shared resource)');
          // Clear reference but don't kill the process
          this.pythonProc = null;
        } else {
          // This is a per-meeting process, kill it
          try {
            this.pythonProc.stdin?.write('EXIT\n');
          } catch (e) {
            // stdin might be closed
          }
          this.pythonProc.kill();
          this.pythonProc = null;
          console.log('✅ Python process stopped');
        }
      }

      // Clear state
      this.pythonStdoutBuffer = '';
      this.pythonResolvers = [];
      this.pendingRequests.clear();
      
      console.log('✅ TranscriptionService cleanup completed');
    } catch (error) {
      console.error('⚠️  Error during TranscriptionService cleanup:', error.message);
    }
  }
}

module.exports = TranscriptionService;

