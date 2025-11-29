// AudioRecorder.js - Handles all audio recording logic with two-recorder architecture
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const { spawn } = require('child_process');

const PY_SCRIPT_PATH = path.resolve(__dirname, '../../../ai-layer/whisperX/transcribe-whisper.py');

class AudioRecorder {
  constructor(page, meetingDataDir, chunksDir) {
    this.page = page;
    this.meetingDataDir = meetingDataDir;
    this.chunksDir = chunksDir;
    this.chunkSequence = 0;
    this.chunkFlushInterval = null;
    this.transcriptFilepath = null;
    this.pythonProc = null;
    this.pythonStdoutBuffer = '';
    this.pythonResolvers = [];
  }

  /**
   * Inject two-recorder audio capture system into the browser
   */
  async injectAudioCapture() {
    await this.page.evaluateOnNewDocument(() => {
      // Core state for two-recorder system
      window.audioCapture = {
        audioContext: null,
        completeRecorder: null,
        completeChunks: [],
        streamRecorder: null,
        streamChunks: [],
        lastProcessedIndex: 0,
        isRecording: false,
        trackToRecord: null
      };

      // CRITICAL: getAndClearChunks returns CUMULATIVE blob (all chunks from start)
      window.getAndClearChunks = function () {
        return new Promise((resolve) => {
          try {
            const last = window.audioCapture.lastProcessedIndex || 0;
            const all = window.audioCapture.streamChunks || [];
            
            if (last >= all.length) return resolve(null);

            const slice = all.slice(last);
            const totalSize = slice.reduce((sum, chunk) => sum + (chunk.size || 0), 0);
            if (totalSize < 1000) return resolve(null); // Minimum 1KB

            window.audioCapture.lastProcessedIndex = all.length;
            
            // CRITICAL: Create blob from ALL chunks, not just new ones
            // This ensures WebM header is included
            const allChunksBlob = new Blob(window.audioCapture.streamChunks, { 
              type: 'audio/webm;codecs=opus' 
            });
            
            const reader = new FileReader();
            reader.onloadend = () => {
              try {
                const base64Data = reader.result.split(',')[1];
                if (!base64Data || base64Data.length < 100) return resolve(null);
                
                resolve({
                  audio: base64Data,
                  size: allChunksBlob.size,
                  chunks: slice.length,
                  totalChunks: all.length,
                  ts: Date.now(),
                  isCumulative: true // Flag to indicate this is cumulative
                });
              } catch (e) {
                resolve(null);
              }
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(allChunksBlob);
          } catch (e) {
            resolve(null);
          }
        });
      };

      // Utility to safely resume audio context
      async function resumeAudioContextIfNeeded(ctx) {
        try {
          if (!ctx) return;
          if (typeof ctx.state !== 'undefined' && ctx.state === 'suspended') {
            await ctx.resume().catch(() => { });
          }
        } catch (e) { }
      }

      // Intercept RTCPeerConnection to capture audio tracks
      const OriginalRTCPeerConnection = window.RTCPeerConnection;

      window.RTCPeerConnection = function (config) {
        const pc = new OriginalRTCPeerConnection(config);

        pc.addEventListener('track', async (event) => {
          try {
            // Accept any incoming remote audio track
            if (!event.track) return;
            if (event.track.kind !== 'audio') return;

            // If we've already hooked a track, ignore additional local tracks but allow new remote
            if (window.audioCapture.trackToRecord && window.audioCapture.trackToRecord.id === event.track.id) {
              return;
            }

            // Assign track and attempt to start recording
            window.audioCapture.trackToRecord = event.track;

            // If recorder not active, start it
            if (!window.audioCapture.isRecording) {
              try { window.startAudioRecording(); } catch (_) { }
            }
          } catch (_) { }
        });

        return pc;
      };

      window.startAudioRecording = function () {
        try {
          if (!window.audioCapture.trackToRecord) {
            console.log('[KAIRO] ⚠️ No track to record');
            return;
          }
          if (window.audioCapture.isRecording) return;

          window.audioCapture.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          resumeAudioContextIfNeeded(window.audioCapture.audioContext).catch(() => { });

          const dest = window.audioCapture.audioContext.createMediaStreamDestination();

          try {
            // Create stream from the remote track
            const stream = new MediaStream([window.audioCapture.trackToRecord]);
            const audioSource = window.audioCapture.audioContext.createMediaStreamSource(stream);
            audioSource.connect(dest);
            window.audioCapture._destStream = dest.stream;
            console.log('[KAIRO] 🔗 Connected track to destination');
          } catch (err) {
            console.log('[KAIRO] ⚠️ Error connecting track:', err && err.message ? err.message : err);
            return;
          }

          const mimeType = (MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';

          try {
            // RECORDER 1: Complete Recording Stream (never interrupted)
            window.audioCapture.completeRecorder = new MediaRecorder(window.audioCapture._destStream, {
              mimeType: mimeType,
              audioBitsPerSecond: 128000
            });

            // RECORDER 2: Transcription Stream (can be interrupted)
            window.audioCapture.streamRecorder = new MediaRecorder(window.audioCapture._destStream, {
              mimeType: mimeType,
              audioBitsPerSecond: 128000
            });
          } catch (err) {
            console.error('[KAIRO] ❌ MediaRecorder creation failed:', err);
            return;
          }

          // Complete recorder handlers (for final recording)
          window.audioCapture.completeRecorder.ondataavailable = (event) => {
            try {
              if (event.data && event.data.size > 0) {
                window.audioCapture.completeChunks.push(event.data);
              }
            } catch (e) { }
          };

          // Stream recorder handlers (for transcription chunks)
          window.audioCapture.streamRecorder.ondataavailable = (event) => {
            try {
              if (event.data && event.data.size > 0) {
                window.audioCapture.streamChunks.push(event.data);
              }
            } catch (e) { }
          };

          window.audioCapture.completeRecorder.onstart = () => {
            console.log('[KAIRO] 🔴 COMPLETE RECORDER ACTIVE');
          };

          window.audioCapture.streamRecorder.onstart = () => {
            console.log('[KAIRO] 🔴 STREAM RECORDER ACTIVE');
          };

          window.audioCapture.completeRecorder.onstop = () => {
            console.log('[KAIRO] ⏹️ Complete recorder stopped');
            console.log('[KAIRO] 📦 Total complete chunks:', window.audioCapture.completeChunks.length);
          };

          window.audioCapture.streamRecorder.onstop = () => {
            console.log('[KAIRO] ⏹️ Stream recorder stopped');
            console.log('[KAIRO] 📦 Total stream chunks:', window.audioCapture.streamChunks.length);
          };

          window.audioCapture.completeRecorder.onerror = (error) => {
            console.error('[KAIRO] ❌ Complete recorder error:', error);
          };

          window.audioCapture.streamRecorder.onerror = (error) => {
            console.error('[KAIRO] ❌ Stream recorder error:', error);
          };

          // Start both recorders with different timeslices
          try {
            // Complete recorder: 10s timeslice, never interrupted
            window.audioCapture.completeRecorder.start(10000);
            // Stream recorder: 2s timeslice, for transcription
            window.audioCapture.streamRecorder.start(2000);
            window.audioCapture.isRecording = true;
            console.log('[KAIRO] 🔴 RECORDING ACTIVE (both recorders)');
          } catch (err) {
            console.error('[KAIRO] ❌ mediaRecorder.start failed:', err);
          }
        } catch (error) {
          console.error('[KAIRO] ❌ Failed to start recording:', error);
        }
      };

      window.stopAndGetAudio = function () {
        return new Promise((resolve) => {
          try {
            // Return data from completeRecorder, not streamRecorder
            if (!window.audioCapture.completeRecorder) {
              console.log('[KAIRO] No complete recorder found');
              resolve(null);
              return;
            }

            const processChunks = () => {
              try {
                // Get all chunks including any that arrived after stop was called
                const allChunks = [...window.audioCapture.completeChunks];
                
                if (allChunks.length === 0) {
                  console.log('[KAIRO] No chunks recorded');
                  resolve(null);
                  return;
                }

                const blob = new Blob(allChunks, { type: 'audio/webm;codecs=opus' });
                const reader = new FileReader();
                reader.onloadend = () => {
                  try {
                    const base64Data = reader.result.split(',')[1];
                    if (!base64Data) {
                      resolve(null);
                      return;
                    }
                    resolve({
                      audio: base64Data,
                      size: blob.size,
                      chunks: allChunks.length
                    });
                  } catch (e) {
                    console.error('[KAIRO] Error processing blob:', e);
                    resolve(null);
                  }
                };
                reader.onerror = () => {
                  console.error('[KAIRO] FileReader error');
                  resolve(null);
                };
                reader.readAsDataURL(blob);
              } catch (e) {
                console.error('[KAIRO] Error in processChunks:', e);
                resolve(null);
              }
            };

            // If recorder is still active, stop it and wait for final data
            if (window.audioCapture.completeRecorder.state === 'recording') {
              // Request final data before stopping
              try {
                window.audioCapture.completeRecorder.requestData();
              } catch (e) {
                console.log('[KAIRO] Could not request final data:', e);
              }

              // Set up handler for when recorder stops
              const stopHandler = () => {
                // Small delay to ensure all data is available
                setTimeout(processChunks, 100);
              };

              window.audioCapture.completeRecorder.onstop = stopHandler;
              
              // Stop the recorder
              try {
                window.audioCapture.completeRecorder.stop();
              } catch (e) {
                console.error('[KAIRO] Error stopping recorder:', e);
                // If stop fails, process what we have
                processChunks();
              }
            } else if (window.audioCapture.completeRecorder.state === 'paused') {
              // If paused, just process existing chunks
              processChunks();
            } else {
              // Already stopped, process chunks immediately
              processChunks();
            }
          } catch (error) {
            console.error('[KAIRO] Error in stopAndGetAudio:', error);
            resolve(null);
          }
        });
      };
    });

    console.log('✅ Audio capture system injected (two-recorder architecture)');
  }

  /**
   * Start real-time transcription with event-driven chunk retrieval
   */
  async startRealtimeTranscription() {
    // Initialize transcript file
    const transcriptTimestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
    const transcriptFilename = `transcript_${transcriptTimestamp}.txt`;
    this.transcriptFilepath = path.join(this.meetingDataDir, transcriptFilename);
    try {
      fs.writeFileSync(this.transcriptFilepath, `Kairo Transcript (${new Date().toISOString()})\n\n`);
    } catch (_) { }
    console.log('📝 Live transcript file:', path.resolve(this.transcriptFilepath));

    if (this.chunkFlushInterval) clearInterval(this.chunkFlushInterval);

    // Interval runs every 1000ms
    this.chunkFlushInterval = setInterval(async () => {
      try {
        if (!this.page || this.page.isClosed()) return;

        // Event-driven: Wait for streamRecorder dataavailable event
        const chunkReady = await this.page.evaluate(() => {
          return new Promise((resolve) => {
            if (!window.audioCapture?.streamRecorder || 
                window.audioCapture.streamRecorder.state !== 'recording') {
              return resolve(false);
            }

            let resolved = false;
            const timeout = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                window.audioCapture.streamRecorder.removeEventListener('dataavailable', handler);
                resolve(false);
              }
            }, 3000);

            const handler = (event) => {
              if (resolved) return;
              resolved = true;
              clearTimeout(timeout);
              window.audioCapture.streamRecorder.removeEventListener('dataavailable', handler);
              setTimeout(() => resolve(true), 50);
            };
            
            window.audioCapture.streamRecorder.addEventListener('dataavailable', handler);
            
            try {
              window.audioCapture.streamRecorder.requestData();
            } catch (e) {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                window.audioCapture.streamRecorder.removeEventListener('dataavailable', handler);
                resolve(false);
              }
            }
          });
        }).catch(() => false);

        if (!chunkReady) return;

        // Get cumulative chunk
        const chunkData = await this.page.evaluate(() => {
          return window.getAndClearChunks ? window.getAndClearChunks() : null;
        }).catch(() => null);

        if (!chunkData || !chunkData.audio || chunkData.size < 1000) return; // Minimum 1KB

        // Save cumulative chunk (this IS a valid WebM file)
        const ts = chunkData.ts || Date.now();
        const idx = this.chunkSequence++;
        const chunkFilename = `chunk_${ts}_${idx}.webm`;
        const chunkPath = path.join(this.chunksDir, chunkFilename);
        
        fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
        console.log(`💾 Chunk saved: ${chunkPath} (${(chunkData.size / 1024).toFixed(1)} KB)`);

        // Convert to MP3 and transcribe
        const mp3Path = chunkPath.replace(/\.webm$/i, '.mp3');
        const ok = await this.convertToMp3(chunkPath, mp3Path);
        if (ok) {
          console.log(`🎧 Chunk MP3: ${path.resolve(mp3Path)}`);
          await this.transcribeChunk(mp3Path);
        } else {
          // Fallback: try transcribing WebM directly
          await this.transcribeChunk(chunkPath);
        }
      } catch (err) {
        // Don't crash the interval
        // console.error('⚠️ Realtime chunk loop error:', err.message || err);
      }
    }, 1000);
  }

  /**
   * Flush any pending chunks before stopping
   */
  async flushPendingChunks() {
    try {
      if (!this.page || this.page.isClosed()) return;

      // Get any remaining cumulative chunk
      const chunkData = await this.page.evaluate(() => {
        try {
          return window.getAndClearChunks ? window.getAndClearChunks() : null;
        } catch (e) {
          return null;
        }
      }).catch(() => null);

      if (!chunkData || !chunkData.audio || chunkData.size < 1000) return;

      const ts = chunkData.ts || Date.now();
      const idx = this.chunkSequence++;
      const chunkFilename = `chunk_${ts}_${idx}.webm`;
      const chunkPath = path.join(this.chunksDir, chunkFilename);
      fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
      console.log(`💾 Final chunk saved: ${path.resolve(chunkPath)} (${(chunkData.size / 1024).toFixed(1)} KB)`);

      const mp3Path = chunkPath.replace(/\.webm$/i, '.mp3');
      try {
        await this.convertToMp3(chunkPath, mp3Path);
        console.log(`🎧 Final chunk MP3: ${path.resolve(mp3Path)}`);
      } catch (_) { }
      await this.transcribeChunk(fs.existsSync(mp3Path) ? mp3Path : chunkPath);
    } catch (err) {
      // Ignore flush errors
    }
  }

  /**
   * Save complete recording from completeRecorder
   * NOTE: This will stop the completeRecorder as part of getting the audio
   */
  async saveCompleteRecording(baseName) {
    try {
      if (!this.page || this.page.isClosed()) {
        console.log('❌ Page is closed, cannot retrieve complete recording');
        return null;
      }

      console.log('⏳ Retrieving complete audio data from completeRecorder...');

      // stopAndGetAudio will stop the completeRecorder and return all chunks
      const audioData = await this.page.evaluate(() => {
        try {
          return window.stopAndGetAudio ? window.stopAndGetAudio() : null;
        } catch (e) {
          console.error('[KAIRO] Error in stopAndGetAudio:', e);
          return null;
        }
      }).catch(err => {
        console.error('❌ Error retrieving audio:', err && err.message ? err.message : err);
        return null;
      });

      if (!audioData || !audioData.audio) {
        console.log('❌ No complete recording available');
        console.log('   Debug: audioData =', audioData ? 'exists but no audio' : 'null');
        return null;
      }

      console.log('✅ Audio retrieved:', (audioData.size / 1024).toFixed(1), 'KB');

      // Save the complete WebM
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
      const webmFilename = baseName ? `${baseName}_complete.webm` : `recording_${timestamp}.webm`;
      const webmPath = path.join(this.meetingDataDir, webmFilename);

      console.log('⏳ Saving WebM file...');
      fs.writeFileSync(webmPath, Buffer.from(audioData.audio, 'base64'));
      console.log('✅ WebM saved:', path.resolve(webmPath));

      // Convert to MP3
      console.log('⏳ Converting to MP3...');
      const mp3Filename = baseName ? `${baseName}_complete.mp3` : `recording_${timestamp}.mp3`;
      const mp3Path = path.join(this.meetingDataDir, mp3Filename);

      const conversionSuccess = await this.convertToMp3(webmPath, mp3Path);
      
      if (conversionSuccess) {
        console.log('\n✅ COMPLETE RECORDING CREATED!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📁 Complete MP3:', mp3Filename);
        console.log('📂 Path:', path.resolve(mp3Path));
        console.log('📁 Complete WebM:', webmFilename);
        console.log('📂 Path:', path.resolve(webmPath));
        console.log('📊 Size:', (audioData.size / 1024 / 1024).toFixed(2), 'MB');
        console.log('📦 Chunks:', audioData.chunks);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } else {
        console.log('⚠️ MP3 conversion failed, but WebM saved');
      }

      return { mp3Path, webmPath, size: audioData.size };
    } catch (error) {
      console.error('\n❌ Save failed:', error && error.message ? error.message : error);
      return null;
    }
  }

  /**
   * Stop recording and cleanup
   * NOTE: This stops the streamRecorder only. The completeRecorder is stopped by saveCompleteRecording()
   */
  async stopRecording() {
    // Clear interval
    if (this.chunkFlushInterval) {
      clearInterval(this.chunkFlushInterval);
      this.chunkFlushInterval = null;
    }

    // Flush pending chunks from streamRecorder
    await this.flushPendingChunks();

    // Stop streamRecorder only (completeRecorder is stopped by saveCompleteRecording)
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.evaluate(() => {
          try {
            // Only stop streamRecorder here - completeRecorder is stopped by stopAndGetAudio
            if (window.audioCapture?.streamRecorder && window.audioCapture.streamRecorder.state !== 'inactive') {
              window.audioCapture.streamRecorder.stop();
            }
            // Don't close audioContext yet - completeRecorder might still need it
          } catch (e) { }
        });
      }
    } catch (err) {
      // Ignore
    }

    // Kill Python process
    try {
      if (this.pythonProc && !this.pythonProc.killed) {
        this.pythonProc.stdin?.write('EXIT\n');
        this.pythonProc.kill();
        this.pythonProc = null;
      }
    } catch (err) {
      // Ignore
    }
  }

  /**
   * Final cleanup - close audio context after recording is saved
   */
  async finalCleanup() {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.evaluate(() => {
          try {
            // Now we can close the audio context
            if (window.audioCapture?.audioContext) {
              window.audioCapture.audioContext.close();
            }
          } catch (e) { }
        });
      }
    } catch (err) {
      // Ignore
    }
  }

  /**
   * Convert WebM to MP3
   */
  async convertToMp3(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(inputPath)) {
        console.log(`⚠️  Input file not found: ${inputPath}`);
        return resolve(false);
      }
      const ffmpegPath = ffmpeg.path;
      const command = `"${ffmpegPath}" -i "${inputPath}" -vn -ar 44100 -ac 2 -b:a 192k -f mp3 "${outputPath}" -y`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.log(`⚠️  FFmpeg conversion failed for ${path.basename(inputPath)}:`, error.message);
          return resolve(false);
        }

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          console.log(`✅ MP3 conversion complete: ${path.basename(outputPath)}`);
          resolve(true);
        } else {
          console.log(`⚠️  MP3 file not created or empty: ${path.basename(outputPath)}`);
          resolve(false);
        }
      });
    });
  }

  /**
   * Convert WebM to WAV (for transcription if needed)
   */
  async convertToWav(inputPath, outputPath) {
    return new Promise((resolve) => {
      const ffmpegPath = ffmpeg.path;
      const command = `"${ffmpegPath}" -i "${inputPath}" -ac 1 -ar 16000 -f wav "${outputPath}" -y`;
      exec(command, (error) => {
        if (error) {
          console.log('⚠️  FFmpeg WAV conversion failed:', error.message);
          return resolve(false);
        }
        resolve(true);
      });
    });
  }

  /**
   * Transcribe a chunk using WhisperX
   */
  async transcribeChunk(chunkPath) {
    return this.sendToPython(chunkPath).catch(() => this.runPythonOneShot(chunkPath)).then((text) => {
      if (text && text.trim()) {
        const line = `[${new Date().toISOString()}] ${text}\n`;
        if (this.transcriptFilepath) fs.appendFileSync(this.transcriptFilepath, line);
        process.stdout.write(`\n📝 Transcribed: ${text.substring(0, 100)}${text.length > 100 ? '…' : ''}\n`);
      }
    }).catch((e) => {
      // If transcription fails, log but don't crash
      console.error('⚠️ Transcription failed for', chunkPath, e && e.message ? e.message : e);
    });
  }

  /**
   * Ensure Python process is running
   */
  ensurePythonProc() {
    if (this.pythonProc && !this.pythonProc.killed) return;
    const candidates = ['py -3.10', 'python3.10', 'python', 'py'];
    let started = false;
    for (const cmd of candidates) {
      try {
        const proc = spawn(cmd, [PY_SCRIPT_PATH], { shell: process.platform === 'win32' });
        this.pythonProc = proc;
        this.pythonStdoutBuffer = '';
        this.pythonResolvers = [];
        proc.stdout.on('data', (data) => {
          this.pythonStdoutBuffer += data.toString();
          let idx;
          while ((idx = this.pythonStdoutBuffer.indexOf('\n')) !== -1) {
            const line = this.pythonStdoutBuffer.slice(0, idx).trim();
            this.pythonStdoutBuffer = this.pythonStdoutBuffer.slice(idx + 1);
            const resolver = this.pythonResolvers.shift();
            if (resolver) resolver.resolve(line);
          }
        });
        proc.stderr.on('data', (data) => {
          const resolver = this.pythonResolvers.shift();
          if (resolver) resolver.reject(new Error(data.toString()));
        });
        proc.on('close', () => {
          while (this.pythonResolvers.length) {
            const r = this.pythonResolvers.shift();
            r.reject(new Error('Python process closed'));
          }
        });
        started = true;
        break;
      } catch (_) { }
    }
    if (!started) throw new Error('Failed to start Python');
  }

  /**
   * Send audio path to Python process
   */
  sendToPython(audioPath) {
    return new Promise((resolve, reject) => {
      try {
        this.ensurePythonProc();
      } catch (e) {
        return reject(e);
      }
      this.pythonResolvers.push({ resolve, reject });
      try {
        this.pythonProc.stdin.write(audioPath + '\n');
      } catch (e) {
        const r = this.pythonResolvers.pop();
        if (r) r.reject(e);
      }
    });
  }

  /**
   * Run Python transcription as one-shot process
   */
  runPythonOneShot(audioPath) {
    return new Promise((resolve, reject) => {
      const candidates = ['py -3.10', 'python3.10', 'python', 'py'];
      let attempt = 0;
      const tryOne = () => {
        if (attempt >= candidates.length) return reject(new Error('Python not found'));
        const cmd = candidates[attempt++];
        const proc = spawn(cmd, [PY_SCRIPT_PATH, audioPath], { shell: process.platform === 'win32' });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', d => stdout += d.toString());
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('error', () => tryOne());
        proc.on('close', (code) => {
          if (code === 0) return resolve(stdout.trim());
          if (attempt < candidates.length) return tryOne();
          return reject(new Error(stderr || `Python exited with code ${code}`));
        });
      };
      tryOne();
    });
  }
}

module.exports = AudioRecorder;

