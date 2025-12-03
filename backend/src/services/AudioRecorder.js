// AudioRecorder.js - Handles all audio recording logic with two-recorder architecture
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const TranscriptionService = require('./TranscriptionService');

class AudioRecorder {
  constructor(page, meetingDataDir, chunksDir) {
    this.page = page;
    this.meetingDataDir = meetingDataDir;
    this.chunksDir = chunksDir;
    this.chunkSequence = 0;
    this.chunkFlushInterval = null;
    this.transcriptFilepath = null;
    this.transcriptionService = null; // Will be initialized when transcript file is created
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

      // getAndClearChunks returns CUMULATIVE audio (all chunks from start)
      // This ensures each file is valid and playable for transcription
      window.getAndClearChunks = function () {
        return new Promise((resolve) => {
          try {
            const last = window.audioCapture.lastProcessedIndex || 0;
            const all = window.audioCapture.streamChunks || [];
            
            if (last >= all.length) return resolve(null);

            // Get only NEW chunks to check size
            const newChunks = all.slice(last);
            const totalSize = newChunks.reduce((sum, chunk) => sum + (chunk.size || 0), 0);
            if (totalSize < 1000) return resolve(null); // Minimum 1KB of new data

            window.audioCapture.lastProcessedIndex = all.length;
            
            // CRITICAL: Create blob from ALL chunks (cumulative)
            // This ensures valid WebM with header and all audio data
            const allChunksBlob = new Blob(all, { 
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
                  chunks: newChunks.length,  // Number of NEW chunks added
                  totalChunks: all.length,
                  startIndex: last,          // Track what's new
                  endIndex: all.length,      // Track what's new
                  ts: Date.now(),
                  isCumulative: true         // Flag for transcription service
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
            // Stream recorder: 3s timeslice, for transcription (user requested 3 seconds)
            window.audioCapture.streamRecorder.start(3000);
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
                
                console.log('[KAIRO] Processing chunks:', allChunks.length);
                
                if (allChunks.length === 0) {
                  console.log('[KAIRO] No chunks recorded');
                  resolve(null);
                  return;
                }

                const blob = new Blob(allChunks, { type: 'audio/webm;codecs=opus' });
                console.log('[KAIRO] Blob created, size:', blob.size);
                
                const reader = new FileReader();
                reader.onloadend = () => {
                  try {
                    const base64Data = reader.result.split(',')[1];
                    if (!base64Data) {
                      console.error('[KAIRO] No base64 data in result');
                      resolve(null);
                      return;
                    }
                    console.log('[KAIRO] Successfully converted to base64');
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
              console.log('[KAIRO] Recorder is active, stopping...');
              
              // Strategy: Wait for final dataavailable event before processing
              let finalDataReceived = false;
              let stopHandlerCalled = false;
              const initialChunkCount = window.audioCapture.completeChunks.length;
              
              // Set up handler for final data
              const dataHandler = (event) => {
                console.log('[KAIRO] Final dataavailable event received, chunk size:', event.data?.size);
                if (event.data && event.data.size > 0) {
                  // This will be added to completeChunks by the ondataavailable handler
                  finalDataReceived = true;
                }
              };
              
              // Listen for final data
              window.audioCapture.completeRecorder.addEventListener('dataavailable', dataHandler, { once: true });
              
              // Set up handler for when recorder stops
              const stopHandler = () => {
                if (stopHandlerCalled) return;
                stopHandlerCalled = true;
                
                console.log('[KAIRO] Stop event received');
                console.log('[KAIRO] Initial chunks:', initialChunkCount, 'Current chunks:', window.audioCapture.completeChunks.length);
                
                // Remove the data handler if it hasn't fired
                try {
                  window.audioCapture.completeRecorder.removeEventListener('dataavailable', dataHandler);
                } catch (e) { }
                
                // Wait longer to ensure all data is written
                // Use multiple delays to check if chunks are still arriving
                const checkAndProcess = (attempt = 0) => {
                  const currentChunkCount = window.audioCapture.completeChunks.length;
                  console.log('[KAIRO] Check attempt', attempt, 'chunks:', currentChunkCount);
                  
                  if (attempt === 0 && !finalDataReceived) {
                    // First check: wait for final data event (up to 500ms)
                    setTimeout(() => checkAndProcess(1), 500);
                  } else if (attempt < 3) {
                    // Additional checks: wait to see if more chunks arrive
                    setTimeout(() => {
                      const newChunkCount = window.audioCapture.completeChunks.length;
                      if (newChunkCount > currentChunkCount) {
                        console.log('[KAIRO] More chunks arrived, waiting again...');
                        checkAndProcess(attempt + 1);
                      } else {
                        console.log('[KAIRO] No new chunks, processing...');
                        processChunks();
                      }
                    }, 200);
                  } else {
                    // Final attempt: process what we have
                    console.log('[KAIRO] Final check, processing...');
                    processChunks();
                  }
                };
                
                checkAndProcess(0);
              };

              window.audioCapture.completeRecorder.onstop = stopHandler;
              
              // Request final data before stopping (this triggers final dataavailable)
              try {
                console.log('[KAIRO] Requesting final data...');
                window.audioCapture.completeRecorder.requestData();
              } catch (e) {
                console.log('[KAIRO] Could not request final data:', e);
              }
              
              // Wait a moment for requestData to be processed, then stop
              setTimeout(() => {
                try {
                  console.log('[KAIRO] Calling stop()...');
                  window.audioCapture.completeRecorder.stop();
                } catch (e) {
                  console.error('[KAIRO] Error stopping recorder:', e);
                  // If stop fails, process what we have
                  processChunks();
                }
              }, 100); // Small delay to let requestData finish
              
            } else if (window.audioCapture.completeRecorder.state === 'paused') {
              console.log('[KAIRO] Recorder is paused, processing existing chunks');
              // If paused, just process existing chunks
              processChunks();
            } else {
              console.log('[KAIRO] Recorder already stopped, processing existing chunks');
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

    // Initialize transcription service
    this.transcriptionService = new TranscriptionService(this.meetingDataDir, this.transcriptFilepath);

    if (this.chunkFlushInterval) clearInterval(this.chunkFlushInterval);

    // Interval runs every 3000ms (3 seconds) to match the 3-second timeslice
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

        // Get new audio segment (not cumulative)
        const chunkData = await this.page.evaluate(() => {
          return window.getAndClearChunks ? window.getAndClearChunks() : null;
        }).catch(() => null);

        if (!chunkData || !chunkData.audio || chunkData.size < 1000) return; // Minimum 1KB

        const ts = chunkData.ts || Date.now();
        const idx = this.chunkSequence++;
        const chunkFilename = `chunk_${ts}_${idx}.webm`;
        const chunkPath = path.join(this.chunksDir, chunkFilename);
        
        // Special case: First chunk (startIndex = 0) - this IS the new audio, no extraction needed
        if (chunkData.startIndex === 0) {
          fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
          
          // Convert to MP3 and transcribe
          const mp3Path = chunkPath.replace(/\.webm$/i, '.mp3');
          const ok = await this.convertToMp3(chunkPath, mp3Path);
          const mp3Status = ok ? path.basename(mp3Path) : 'MP3 conversion failed';
          console.log(`💾 Received chunk ${chunkData.startIndex} → ${chunkData.endIndex} (${(chunkData.size / 1024).toFixed(1)} KB) \n- Saved: ${path.basename(chunkPath)} and ${mp3Status}`);
          
          if (ok && this.transcriptionService) {
            try {
              const result = await this.transcriptionService.transcribe(mp3Path, idx);
              if (!result || !result.success) {
                console.warn(`   ⚠️  Transcription failed: ${result?.error || 'Unknown error'}`);
              }
            } catch (transcribeError) {
              console.error(`   ❌ Transcription error:`, transcribeError.message);
            }
          } else if (this.transcriptionService) {
            try {
              const result = await this.transcriptionService.transcribe(chunkPath, idx);
              if (!result || !result.success) {
                console.warn(`   ⚠️  Transcription failed: ${result?.error || 'Unknown error'}`);
              }
            } catch (transcribeError) {
              console.error(`   ❌ Transcription error:`, transcribeError.message);
            }
          }
        } else {
          // Subsequent chunks: Extract only the new portion from the end
          // First, remux the cumulative blob to ensure it's a valid WebM file
          const tempCumulativePath = path.join(this.chunksDir, `temp_cumulative_${ts}.webm`);
          const tempRemuxedPath = path.join(this.chunksDir, `temp_remuxed_${ts}.webm`);
          
          fs.writeFileSync(tempCumulativePath, Buffer.from(chunkData.audio, 'base64'));
          
          // Remux the file first to ensure it's valid WebM structure
          const remuxSuccess = await new Promise((resolve) => {
            const ffmpegPath = ffmpeg.path;
            const remuxCommand = `"${ffmpegPath}" -i "${tempCumulativePath}" -c copy "${tempRemuxedPath}" -y 2>&1`;
            
            exec(remuxCommand, { maxBuffer: 1024 * 1024 }, (remuxError, remuxStdout, remuxStderr) => {
              if (remuxError || !fs.existsSync(tempRemuxedPath) || fs.statSync(tempRemuxedPath).size < 1000) {
                resolve(false);
              } else {
                resolve(true);
              }
            });
          });
          
          const fileToExtract = remuxSuccess ? tempRemuxedPath : tempCumulativePath;
          
          const extractSuccess = await this.extractLastNSeconds(
            fileToExtract,
            chunkPath,
            3.5 // Extract last 3.5 seconds to ensure we capture all new audio
          );

          // Always delete the temporary files
          try {
            fs.unlinkSync(tempCumulativePath);
            if (fs.existsSync(tempRemuxedPath)) fs.unlinkSync(tempRemuxedPath);
          } catch (e) {
            // Silent cleanup
          }

          if (extractSuccess) {
            // Convert to MP3 and transcribe (now only ~3 seconds of NEW audio!)
            const mp3Path = chunkPath.replace(/\.webm$/i, '.mp3');
            const ok = await this.convertToMp3(chunkPath, mp3Path);
            const mp3Status = ok ? path.basename(mp3Path) : 'MP3 conversion failed';
            console.log(`💾 Received chunk ${chunkData.startIndex} → ${chunkData.endIndex} (extracting ~3s) - Saved: ${path.basename(chunkPath)} and ${mp3Status}`);
            
            if (ok && this.transcriptionService) {
              try {
                const result = await this.transcriptionService.transcribe(mp3Path, idx);
                if (!result || !result.success) {
                  console.warn(`   ⚠️  Transcription failed: ${result?.error || 'Unknown error'}`);
                }
              } catch (transcribeError) {
                console.error(`   ❌ Transcription error:`, transcribeError.message);
              }
            } else if (this.transcriptionService) {
              try {
                const result = await this.transcriptionService.transcribe(chunkPath, idx);
                if (!result || !result.success) {
                  console.warn(`   ⚠️  Transcription failed: ${result?.error || 'Unknown error'}`);
                }
              } catch (transcribeError) {
                console.error(`   ❌ Transcription error:`, transcribeError.message);
              }
            }
          } else {
            console.error(`💾 Received chunk ${chunkData.startIndex} → ${chunkData.endIndex} - ❌ Failed to extract segment, skipping`);
          }
        }
      } catch (err) {
        // Log errors so we can debug extraction issues
        console.error('⚠️ Realtime chunk loop error:', err.message || err);
        if (err.stack) {
          console.error('   Stack:', err.stack);
        }
      }
    }, 3000); // 3 second interval to match timeslice
  }

  /**
   * Flush any pending chunks before stopping
   */
  async flushPendingChunks() {
    try {
      if (!this.page || this.page.isClosed()) {
        return;
      }

      // Request final data from streamRecorder
      await this.page.evaluate(() => {
        try {
          if (window.audioCapture?.streamRecorder?.state === 'recording') {
            window.audioCapture.streamRecorder.requestData();
            console.log('[KAIRO] Requested final data from streamRecorder');
          }
        } catch (e) {
          console.error('[KAIRO] Error requesting final data:', e);
        }
      }).catch(() => {});

      // Wait a moment for data to be available
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get any remaining cumulative chunk
      const chunkData = await this.page.evaluate(() => {
        try {
          return window.getAndClearChunks ? window.getAndClearChunks() : null;
        } catch (e) {
          console.error('[KAIRO] Error in getAndClearChunks:', e);
          return null;
        }
      }).catch(() => null);

      if (!chunkData || !chunkData.audio || chunkData.size < 1000) {
        return;
      }

      const ts = chunkData.ts || Date.now();
      const idx = this.chunkSequence++;
      const chunkFilename = `chunk_${ts}_${idx}.webm`;
      const chunkPath = path.join(this.chunksDir, chunkFilename);
      
      // Extract only the new portion (last ~3 seconds) if this isn't the first chunk
      if (chunkData.startIndex > 0) {
        const tempCumulativePath = path.join(this.chunksDir, `temp_final_${ts}.webm`);
        const tempRemuxedPath = path.join(this.chunksDir, `temp_final_remuxed_${ts}.webm`);
        
        fs.writeFileSync(tempCumulativePath, Buffer.from(chunkData.audio, 'base64'));
        
        // Remux the file first to ensure it's valid WebM structure
        const remuxSuccess = await new Promise((resolve) => {
          const ffmpegPath = ffmpeg.path;
          const remuxCommand = `"${ffmpegPath}" -i "${tempCumulativePath}" -c copy "${tempRemuxedPath}" -y 2>&1`;
          
          exec(remuxCommand, { maxBuffer: 1024 * 1024 }, (remuxError, remuxStdout, remuxStderr) => {
            if (remuxError || !fs.existsSync(tempRemuxedPath) || fs.statSync(tempRemuxedPath).size < 1000) {
              resolve(false);
            } else {
              resolve(true);
            }
          });
        });
        
        const fileToExtract = remuxSuccess ? tempRemuxedPath : tempCumulativePath;
        
        const extractSuccess = await this.extractLastNSeconds(
          fileToExtract,
          chunkPath,
          3.5
        );

        // Clean up temp files
        try {
          fs.unlinkSync(tempCumulativePath);
          if (fs.existsSync(tempRemuxedPath)) fs.unlinkSync(tempRemuxedPath);
        } catch (e) {
          // Silent cleanup
        }

        if (!extractSuccess) {
          fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
        }
      } else {
        // First chunk - save as-is
        fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
      }

      const mp3Path = chunkPath.replace(/\.webm$/i, '.mp3');
      
      // CRITICAL FIX: Don't wait for transcription - do it in background
      // The transcription might hang and we need to proceed to save the complete recording
      if (this.transcriptionService) {
        const finalChunkIdx = idx; // Capture idx for use in promise
        this.convertToMp3(chunkPath, mp3Path)
          .then((ok) => {
            const mp3Status = ok ? path.basename(mp3Path) : 'MP3 conversion failed';
            console.log(`💾 FINAL chunk ${chunkData.startIndex} → ${chunkData.endIndex} (extracting ~3s) - Saved: ${path.basename(chunkPath)} and ${mp3Status}`);
            if (ok) {
              return this.transcriptionService.transcribe(mp3Path, finalChunkIdx);
            } else {
              return this.transcriptionService.transcribe(chunkPath, finalChunkIdx);
            }
          })
          .catch((err) => {
            console.error('   ❌ Background transcription error:', err.message);
          });
      } else {
        const mp3Status = 'MP3 conversion skipped (no transcription service)';
        console.log(`💾 FINAL chunk ${chunkData.startIndex} → ${chunkData.endIndex} (extracting ~3s) - Saved: ${path.basename(chunkPath)} and ${mp3Status}`);
      }
      
    } catch (err) {
      console.error('[AudioRecorder.flushPendingChunks] Error:', err);
      // Don't throw - we need to proceed
    }
  }

  /**
   * Save complete recording from completeRecorder
   * NOTE: This will stop the completeRecorder as part of getting the audio
   */
  async saveCompleteRecording(baseName) {
    try {
      if (!this.page || this.page.isClosed()) {
        console.log('❌ Cannot retrieve complete recording: page is closed');
        return null;
      }

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.error('⏰ Timeout waiting for complete recording (30s)');
          resolve(null);
        }, 30000); // 30 second timeout
      });

      // stopAndGetAudio will stop the completeRecorder and return all chunks
      const evaluatePromise = this.page.evaluate(() => {
        try {
          if (!window.stopAndGetAudio) {
            return null;
          }
          return window.stopAndGetAudio();
        } catch (e) {
          return null;
        }
      }).catch(() => null);

      const audioData = await Promise.race([evaluatePromise, timeoutPromise]);
      
      if (!audioData || !audioData.audio) {
        console.log('❌ No complete recording available');
        return null;
      }

      // Save the complete WebM
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
      const webmFilename = baseName ? `${baseName}_complete.webm` : `recording_${timestamp}.webm`;
      const webmPath = path.join(this.meetingDataDir, webmFilename);

      fs.writeFileSync(webmPath, Buffer.from(audioData.audio, 'base64'));

      // Convert to MP3
      const mp3Filename = baseName ? `${baseName}_complete.mp3` : `recording_${timestamp}.mp3`;
      const mp3Path = path.join(this.meetingDataDir, mp3Filename);

      const conversionSuccess = await this.convertToMp3(webmPath, mp3Path);
      
      if (conversionSuccess) {
        console.log(`✅ Complete recording saved: ${webmFilename} and ${mp3Filename} (${(audioData.size / 1024 / 1024).toFixed(2)} MB)`);
      } else {
        console.log(`✅ Complete recording saved: ${webmFilename} (MP3 conversion failed)`);
      }

      return { mp3Path, webmPath, size: audioData.size };
    } catch (error) {
      console.error('❌ Save complete recording failed:', error && error.message ? error.message : error);
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

    // Flush pending chunks from streamRecorder with timeout
    const flushPromise = this.flushPendingChunks();
    const flushTimeout = new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 5000); // 5 second timeout
    });
    
    await Promise.race([flushPromise, flushTimeout]);

    // Stop streamRecorder only (completeRecorder is stopped by saveCompleteRecording)
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.evaluate(() => {
          try {
            // Only stop streamRecorder here - completeRecorder is stopped by stopAndGetAudio
            if (window.audioCapture?.streamRecorder && window.audioCapture.streamRecorder.state !== 'inactive') {
              window.audioCapture.streamRecorder.stop();
              console.log('[KAIRO] StreamRecorder stopped');
            }
            // Don't close audioContext yet - completeRecorder might still need it
          } catch (e) {
            console.error('[KAIRO] Error stopping streamRecorder:', e);
          }
        });
      }
    } catch (err) {
      console.error('Error stopping streamRecorder:', err.message);
    }

    // Note: saveCompleteRecording() and transcription finalization are called separately in MeetingBot.js
    // We do NOT finalize or cleanup transcription here - that happens in MeetingBot.stop() after
    // the complete audio is saved, so diarization can run with the full audio file.
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
   * Extract the last N seconds from an audio file
   * More reliable than calculating positions from chunk indices
   * @param {string} inputPath - Path to cumulative WebM file
   * @param {string} outputPath - Path to extracted segment
   * @param {number} seconds - Number of seconds to extract from the end
   * @returns {Promise<boolean>} - Success status
   */
  async extractLastNSeconds(inputPath, outputPath, seconds) {
    return new Promise((resolve) => {
      if (!fs.existsSync(inputPath)) {
        return resolve(false);
      }

      // Wait a moment to ensure file is fully written
      setTimeout(() => {
        const ffmpegPath = ffmpeg.path;
        const fileSize = fs.statSync(inputPath).size;
        
        if (fileSize < 1000) {
          return resolve(false);
        }
        
        // Step 1: Get total duration - try multiple methods
        // Method 1: JSON output (most reliable)
        const ffprobeJsonCommand = `"${ffmpegPath}" -v error -show_entries format=duration -of json "${inputPath}"`;
        
        exec(ffprobeJsonCommand, { maxBuffer: 1024 * 1024 }, (jsonError, jsonStdout, jsonStderr) => {
          let totalDuration = null;
          
          // Try parsing JSON output first
          if (jsonStdout) {
            try {
              const json = JSON.parse(jsonStdout);
              if (json.format && json.format.duration) {
                totalDuration = parseFloat(json.format.duration);
              }
            } catch (e) {
              // JSON parse failed, continue to other methods
            }
          }
          
          // Method 2: Default format output
          if (!totalDuration) {
            const ffprobeCommand = `"${ffmpegPath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;
            
            exec(ffprobeCommand, { maxBuffer: 1024 * 1024 }, (probeError, probeStdout, probeStderr) => {
              if (!totalDuration && probeStdout && probeStdout.trim()) {
                const durationStr = probeStdout.trim();
                const parsed = parseFloat(durationStr);
                if (!isNaN(parsed) && parsed > 0) {
                  totalDuration = parsed;
                }
              }
              
              // Method 3: Full ffmpeg -i command (last resort)
              if (!totalDuration) {
                const fallbackCommand = `"${ffmpegPath}" -i "${inputPath}" 2>&1`;
                exec(fallbackCommand, { maxBuffer: 1024 * 1024 }, (fallbackError, fallbackStdout, fallbackStderr) => {
                  const output = (fallbackStdout || '') + (fallbackStderr || '');
                  
                  // Look for duration in multiple formats
                  let durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                  
                  // Also try format without leading zeros
                  if (!durationMatch) {
                    durationMatch = output.match(/Duration: (\d{1,2}):(\d{2}):(\d{2}\.\d{1,3})/);
                  }
                  
                  if (durationMatch) {
                    const hours = parseInt(durationMatch[1]);
                    const minutes = parseInt(durationMatch[2]);
                    const secs = parseFloat(durationMatch[3]);
                    totalDuration = hours * 3600 + minutes * 60 + secs;
                  }
                  
                  if (!totalDuration) {
                    // Try to fix/remux the file first, then get duration
                    const fixedPath = inputPath.replace('.webm', '_fixed.webm');
                    const fixCommand = `"${ffmpegPath}" -i "${inputPath}" -c copy "${fixedPath}" -y 2>&1`;
                    
                    exec(fixCommand, { maxBuffer: 1024 * 1024 }, (fixError, fixStdout, fixStderr) => {
                      if (!fixError && fs.existsSync(fixedPath) && fs.statSync(fixedPath).size > 1000) {
                        // Try getting duration from fixed file
                        const fixedProbeCommand = `"${ffmpegPath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fixedPath}"`;
                        exec(fixedProbeCommand, { maxBuffer: 1024 * 1024 }, (fixedProbeError, fixedProbeStdout) => {
                          if (fixedProbeStdout && fixedProbeStdout.trim()) {
                            const parsed = parseFloat(fixedProbeStdout.trim());
                            if (!isNaN(parsed) && parsed > 0) {
                              totalDuration = parsed;
                              // Use fixed file for extraction
                              const originalInput = inputPath;
                              inputPath = fixedPath;
                              proceedWithExtraction(totalDuration);
                              // Clean up fixed file after extraction
                              setTimeout(() => {
                                try { if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath); } catch (e) {}
                              }, 5000);
                              return;
                            }
                          }
                          // If fixed file also doesn't work, give up
                          try { if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath); } catch (e) {}
                          return resolve(false);
                        });
                        return;
                      }
                      
                      // Fixing failed, give up
                      try { if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath); } catch (e) {}
                      return resolve(false);
                    });
                    return;
                  }
                  
                  proceedWithExtraction(totalDuration);
                });
                return;
              }
              
              proceedWithExtraction(totalDuration);
            });
            return;
          }
          
          proceedWithExtraction(totalDuration);
        });
        
        function proceedWithExtraction(totalDuration) {
          // Calculate start time for extraction (total - N seconds)
          const startTime = Math.max(0, totalDuration - seconds);
          const extractDuration = Math.min(seconds, totalDuration);
          
          // If file is shorter than requested seconds, extract from start
          if (totalDuration <= seconds) {
            const extractCommand = `"${ffmpegPath}" -i "${inputPath}" -c copy "${outputPath}" -y`;
            
            exec(extractCommand, { maxBuffer: 1024 * 1024 }, (extractError) => {
              if (extractError) {
                return resolve(false);
              }
              
              if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
                resolve(true);
              } else {
                resolve(false);
              }
            });
            return;
          }
          
          // Step 2: Extract the segment
          // -ss AFTER -i for accurate extraction (especially important for end of file)
          // -c copy first (fast), fallback to re-encode if it fails
          const extractCommand = `"${ffmpegPath}" -i "${inputPath}" -ss ${startTime} -t ${extractDuration} -c copy -avoid_negative_ts make_zero "${outputPath}" -y`;
          
          exec(extractCommand, { maxBuffer: 1024 * 1024 }, (extractError, extractStdout, extractStderr) => {
            if (extractError) {
              // Fallback: re-encode with Opus
              const reencodeCommand = `"${ffmpegPath}" -i "${inputPath}" -ss ${startTime} -t ${extractDuration} -c:a libopus -b:a 128k -f webm "${outputPath}" -y`;
              
              exec(reencodeCommand, { maxBuffer: 1024 * 1024 }, (reencodeError, reencodeStdout, reencodeStderr) => {
                if (reencodeError) {
                  return resolve(false);
                }
                
                if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
                  resolve(true);
                } else {
                  resolve(false);
                }
              });
              return;
            }
            
            // Check if extraction succeeded
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
              resolve(true);
            } else {
              resolve(false);
            }
          });
        }
      }, 100); // Small delay to ensure file is fully written
    });
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
          return resolve(false);
        }

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          resolve(true);
        } else {
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

}

module.exports = AudioRecorder;

