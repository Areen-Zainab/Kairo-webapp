// AudioRecorder.js - Handles all audio recording logic with two-recorder architecture
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const TranscriptionService = require('./TranscriptionService');

class AudioRecorder {
  constructor(page, meetingDataDir, chunksDir, meetingId, platform = 'zoom') {
    this.page = page;
    this.meetingDataDir = meetingDataDir;
    this.chunksDir = chunksDir;
    this.meetingId = meetingId;
    this.platform = platform; // 'zoom' or 'meet'
    this.chunkSequence = 0;
    this.chunkFlushInterval = null;
    this.transcriptFilepath = null;
    this.transcriptionService = null; // Will be initialized when transcript file is created
    this.isRecording = false; // Track recording state for graceful cancellation
  }

  /**
   * Inject Google Meet specific audio capture system
   * Uses the proven approach that works for Google Meet
   */
  async injectAudioCaptureForGoogleMeet() {
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

    console.log('✅ Audio capture system injected for Google Meet (two-recorder architecture)');
  }

  /**
   * Inject two-recorder audio capture system into the browser
   * CRITICAL: This must be called BEFORE navigating to the meeting
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
        trackToRecord: null,
        trackSource: null // 'local' | 'remote'
      };

      // Stop existing recorders (used when swapping from local -> remote track)
      window.stopRecorders = function () {
        try {
          if (window.audioCapture.completeRecorder && window.audioCapture.completeRecorder.state !== 'inactive') {
            window.audioCapture.completeRecorder.stop();
          }
        } catch (_) { }
        try {
          if (window.audioCapture.streamRecorder && window.audioCapture.streamRecorder.state !== 'inactive') {
            window.audioCapture.streamRecorder.stop();
          }
        } catch (_) { }
        window.audioCapture.isRecording = false;
      };

      // Switch the active track, preferring remote audio over local mic
      window.switchTrackForRecording = function (track, source) {
        if (!track || track.kind !== 'audio' || track.readyState !== 'live') return;

        const currentSource = window.audioCapture.trackSource;
        const currentTrack = window.audioCapture.trackToRecord;

        // If we already have a remote track, don't downgrade to local
        if (currentSource === 'remote' && source === 'local') return;

        // If the incoming track is the same as current, nothing to do
        if (currentTrack && currentTrack.id === track.id && currentSource === source) return;

        // Swap to the new track
        window.stopRecorders();
        window.audioCapture.trackToRecord = track;
        window.audioCapture.trackSource = source;

        // Restart recording on the new track
        try {
          if (window.startAudioRecording) {
            window.startAudioRecording();
          }
        } catch (_) { }
      };

      // EARLY INTERCEPTION: Override getUserMedia to capture audio streams
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function (constraints) {
        console.log('[KAIRO] getUserMedia called with constraints:', constraints);

        return originalGetUserMedia(constraints).then(stream => {
          // Check if this stream has audio
          const audioTracks = stream.getAudioTracks();
          if (audioTracks.length > 0) {
            // Mark as local microphone; will be replaced by remote when available
            console.log('[KAIRO] 🎤 Captured local mic track from getUserMedia');
            window.switchTrackForRecording(audioTracks[0], 'local');
          }

          return stream;
        });
      };

      // BACKUP METHOD: Monitor for video elements with audio tracks
      const videoMonitor = setInterval(() => {
        if (window.audioCapture.isRecording) {
          clearInterval(videoMonitor);
          return;
        }

        const videos = document.querySelectorAll('video');
        for (const video of videos) {
          if (video.srcObject && video.srcObject.getAudioTracks) {
            const audioTracks = video.srcObject.getAudioTracks();
            if (audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
              console.log('[KAIRO] 🎤 Found audio track in video element');
              window.switchTrackForRecording(audioTracks[0], 'remote');
              clearInterval(videoMonitor);
              break;
            }
          }
        }
      }, 500); // Check every 500ms

      // Stop monitoring after 30 seconds
      setTimeout(() => clearInterval(videoMonitor), 30000);

      // getAndClearChunks returns CUMULATIVE audio (all chunks from start) using the
      // completeRecorder chunks, which are more reliably muxed (Zoom-safe).
      window.getAndClearChunks = function () {
        return new Promise((resolve) => {
          try {
            const last = window.audioCapture.lastProcessedIndex || 0;
            const all = window.audioCapture.completeChunks || [];

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

            // Prefer remote tracks over any existing local mic track
            window.switchTrackForRecording(event.track, 'remote');
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

          // Reset buffers when (re)starting on a new track
          window.audioCapture.completeChunks = [];
          window.audioCapture.streamChunks = [];
          window.audioCapture.lastProcessedIndex = 0;

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
   * Reinject audio capture for Zoom meetings (called AFTER "Join Audio" button is clicked)
   * This handles the case where Zoom creates RTCPeerConnection instances after initial page load
   */
  async reinjectAudioCaptureForZoom() {
    console.log('🔄 [Zoom] Attempting to reinject audio capture...');

    try {
      if (!this.page || this.page.isClosed()) {
        console.log('⚠️ [Zoom] Page is closed, cannot reinject audio capture');
        return false;
      }

      const result = await this.page.evaluate(() => {
        // Check if audio capture is already working
        if (window.audioCapture?.isRecording && window.audioCapture?.trackToRecord) {
          return {
            success: true,
            alreadyWorking: true,
            message: 'Audio capture already active'
          };
        }

        console.log('[KAIRO-ZOOM] Searching for audio tracks...');

        // Strategy 1: Look for video elements with audio tracks
        const videos = document.querySelectorAll('video');
        let foundTrack = null;

        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          if (video.srcObject && video.srcObject.getTracks) {
            const tracks = video.srcObject.getTracks();
            const audioTrack = tracks.find(t => t.kind === 'audio' && t.readyState === 'live');

            if (audioTrack) {
              console.log(`[KAIRO-ZOOM] Found audio track in video element ${i}`);
              foundTrack = audioTrack;
              break;
            }
          }
        }

        // Strategy 2: If no track found in video elements, try to intercept new RTCPeerConnection
        if (!foundTrack) {
          console.log('[KAIRO-ZOOM] No audio track in video elements, setting up RTCPeerConnection hook...');

          // Store reference to original RTCPeerConnection
          const OriginalRTC = window.RTCPeerConnection;

          // Get all existing RTCPeerConnection instances (if browser exposes them)
          // This is a fallback - most browsers don't expose existing instances
          try {
            // Try to find existing peer connections through global objects
            const possiblePCs = [];

            // Check if Zoom stores peer connections in global scope
            for (const key in window) {
              try {
                if (window[key] && window[key].constructor &&
                  window[key].constructor.name === 'RTCPeerConnection') {
                  possiblePCs.push(window[key]);
                }
              } catch (e) {
                // Skip properties that throw errors
              }
            }

            // Try to get tracks from existing peer connections
            for (const pc of possiblePCs) {
              try {
                const receivers = pc.getReceivers ? pc.getReceivers() : [];
                for (const receiver of receivers) {
                  if (receiver.track && receiver.track.kind === 'audio' &&
                    receiver.track.readyState === 'live') {
                    console.log('[KAIRO-ZOOM] Found audio track in existing RTCPeerConnection');
                    foundTrack = receiver.track;
                    break;
                  }
                }
                if (foundTrack) break;
              } catch (e) {
                console.log('[KAIRO-ZOOM] Error checking peer connection:', e.message);
              }
            }
          } catch (e) {
            console.log('[KAIRO-ZOOM] Could not search existing peer connections:', e.message);
          }
        }

        // If we found a track, set it up for recording
        if (foundTrack) {
          console.log('[KAIRO-ZOOM] Setting up audio capture with found track...');

          // Initialize audio capture if not already initialized
          if (!window.audioCapture) {
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
          }

          // Set the track
          window.audioCapture.trackToRecord = foundTrack;

          // Try to start recording
          try {
            if (window.startAudioRecording) {
              window.startAudioRecording();
              return {
                success: true,
                alreadyWorking: false,
                message: 'Audio capture started with found track'
              };
            } else {
              return {
                success: false,
                message: 'startAudioRecording function not available'
              };
            }
          } catch (e) {
            return {
              success: false,
              message: 'Error starting audio recording: ' + e.message
            };
          }
        }

        return {
          success: false,
          message: 'No audio tracks found'
        };
      });

      if (result.success) {
        if (result.alreadyWorking) {
          console.log('✅ [Zoom] Audio capture already working');
        } else {
          console.log('✅ [Zoom] Audio capture reinjected successfully');
        }
        return true;
      } else {
        console.log(`⚠️ [Zoom] Failed to reinject audio capture: ${result.message}`);
        return false;
      }
    } catch (error) {
      console.error('❌ [Zoom] Error reinjecting audio capture:', error.message);
      return false;
    }
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
    this.transcriptionService = new TranscriptionService(this.meetingDataDir, this.transcriptFilepath, this.meetingId);
    this.isRecording = true; // Mark recording as active

    // Ensure chunk directory exists so each chunk can be written
    try {
      if (!fs.existsSync(this.chunksDir)) {
        fs.mkdirSync(this.chunksDir, { recursive: true });
      }
    } catch (e) {
      console.error('❌ Unable to create chunks directory:', e.message || e);
    }

    if (this.chunkFlushInterval) clearInterval(this.chunkFlushInterval);

    // Interval runs every 3000ms (3 seconds) to match the 3-second timeslice
    this.chunkFlushInterval = setInterval(async () => {
      try {
        if (!this.page || this.page.isClosed()) return;

        // Proactively flush current data so every timeslice is captured
        await this.page.evaluate(() => {
          try {
            if (window.audioCapture?.streamRecorder &&
              window.audioCapture.streamRecorder.state === 'recording') {
              window.audioCapture.streamRecorder.requestData();
            }
            // Also flush completeRecorder to keep cumulative data fresh/stable
            if (window.audioCapture?.completeRecorder &&
              window.audioCapture.completeRecorder.state === 'recording') {
              window.audioCapture.completeRecorder.requestData();
            }
          } catch (_) { }
        }).catch(() => { });

        // Give the recorder a brief moment to deliver the dataavailable event
        await new Promise(resolve => setTimeout(resolve, 250));

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
          // Always write the raw blob first so we never lose the first chunk
          try {
            fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
          } catch (e) {
            console.error(`💾 Failed to write raw chunk ${chunkData.startIndex}:`, e.message || e);
            return;
          }

          // Best-effort remux: if it succeeds, replace the raw with remuxed output
          const tempRemuxedPath = path.join(this.chunksDir, `temp_remux_first_${ts}.webm`);
          const remuxSuccess = await new Promise((resolve) => {
            const ffmpegPath = ffmpeg.path;
            const remuxCommand = `"${ffmpegPath}" -i "${chunkPath}" -c copy "${tempRemuxedPath}" -y 2>&1`;

            exec(remuxCommand, { maxBuffer: 1024 * 1024 }, (remuxError) => {
              if (remuxError || !fs.existsSync(tempRemuxedPath) || fs.statSync(tempRemuxedPath).size < 1000) {
                resolve(false);
              } else {
                resolve(true);
              }
            });
          });

          if (remuxSuccess) {
            try { fs.copyFileSync(tempRemuxedPath, chunkPath); } catch (_) { /* keep raw */ }
          }
          try { if (fs.existsSync(tempRemuxedPath)) fs.unlinkSync(tempRemuxedPath); } catch (_) { }

          // Use WebM directly for transcription (WhisperX supports WebM via load_audio)
          console.log(`💾 Received chunk ${chunkData.startIndex} → ${chunkData.endIndex} (${(chunkData.size / 1024).toFixed(1)} KB) - Saved: ${path.basename(chunkPath)}`);

          if (this.transcriptionService && this.isRecording) {
            // Check if request is already pending before creating new one
            const pendingPromise = this.transcriptionService.getPendingRequest(chunkPath, idx);
            if (pendingPromise) {
              // Request already pending, wait for it instead of creating duplicate
              try {
                const result = await pendingPromise;
                if (result && result.success) {
                  // Success from pending request
                } else {
                  console.warn(`   ⚠️  Pending transcription request failed: ${result?.error || 'Unknown error'}`);
                }
              } catch (error) {
                console.error(`   ❌ Pending transcription request error:`, error.message);
              }
            } else {
              // No pending request, proceed with transcription (with retry logic)
              let retries = 2;
              let result = null;
              while (retries >= 0 && this.isRecording) {
                try {
                  result = await this.transcriptionService.transcribe(chunkPath, idx);
                  if (result && result.success) {
                    break; // Success, exit retry loop
                  }
                } catch (transcribeError) {
                  // Check if recording stopped (graceful cancellation)
                  if (!this.isRecording) {
                    console.log(`   ⏹️  Recording stopped, cancelling transcription retry for chunk ${idx}`);
                    break;
                  }
                  console.error(`   ❌ Transcription error (${retries} retries left):`, transcribeError.message);
                }

                if (retries > 0 && (!result || !result.success) && this.isRecording) {
                  console.log(`   🔄 Retrying transcription for chunk ${idx}...`);
                  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                }
                retries--;
              }

              if (!result || !result.success) {
                if (this.isRecording) {
                  console.warn(`   ⚠️  Transcription failed after retries: ${result?.error || 'Unknown error'}`);
                } else {
                  console.log(`   ⏹️  Transcription cancelled (recording stopped)`);
                }
              }
            }
          }
        } else {
          // Subsequent chunks: Extract only the new portion from the end
          // Always write the raw cumulative blob first so we keep the chunk no matter what
          const rawCumulativePath = path.join(this.chunksDir, `raw_cumulative_${ts}_${idx}.webm`);
          try {
            fs.writeFileSync(rawCumulativePath, Buffer.from(chunkData.audio, 'base64'));
            // Also write the raw cumulative directly to chunkPath as a guaranteed fallback
            fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
          } catch (e) {
            console.error(`💾 Failed to write raw cumulative for chunk ${chunkData.startIndex} → ${chunkData.endIndex}:`, e.message || e);
            return;
          }

          // Attempt to remux the cumulative blob for better structure
          const tempRemuxedPath = path.join(this.chunksDir, `temp_remuxed_${ts}.webm`);
          const remuxSuccess = await new Promise((resolve) => {
            const ffmpegPath = ffmpeg.path;
            const remuxCommand = `"${ffmpegPath}" -i "${rawCumulativePath}" -c copy "${tempRemuxedPath}" -y 2>&1`;

            exec(remuxCommand, { maxBuffer: 1024 * 1024 }, (remuxError) => {
              if (remuxError || !fs.existsSync(tempRemuxedPath) || fs.statSync(tempRemuxedPath).size < 1000) {
                resolve(false);
              } else {
                resolve(true);
              }
            });
          });

          const fileToExtract = remuxSuccess ? tempRemuxedPath : rawCumulativePath;

          // Try to extract the last ~3.5s into the final chunk file
          let extractSuccess = false;
          try {
            extractSuccess = await this.extractLastNSeconds(
              fileToExtract,
              chunkPath,
              3.5 // Extract last 3.5 seconds to ensure we capture all new audio
            );
          } catch (_) {
            extractSuccess = false;
          }

          if (!extractSuccess) {
            // If extraction fails, fall back to copying the best available source into chunkPath
            try {
              fs.copyFileSync(fileToExtract, chunkPath);
            } catch (e) {
              try {
                fs.copyFileSync(rawCumulativePath, chunkPath);
              } catch (_) {
                console.error(`💾 Received chunk ${chunkData.startIndex} → ${chunkData.endIndex} - ❌ Failed to extract or save fallback, skipping`);
                return;
              }
            }
            console.error(`💾 Received chunk ${chunkData.startIndex} → ${chunkData.endIndex} - extraction failed, saved fallback blob instead`);
          }

          // Clean temp files (keep raw cumulative for debugging)
          try { if (fs.existsSync(tempRemuxedPath)) fs.unlinkSync(tempRemuxedPath); } catch (_) { }

          // Use WebM directly for transcription (WhisperX supports WebM via load_audio)
          console.log(`💾 Received chunk ${chunkData.startIndex} → ${chunkData.endIndex} - Saved: ${path.basename(chunkPath)}`);

          if (this.transcriptionService && this.isRecording) {
            // Check if request is already pending before creating new one
            const pendingPromise = this.transcriptionService.getPendingRequest(chunkPath, idx);
            if (pendingPromise) {
              // Request already pending, wait for it instead of creating duplicate
              try {
                const result = await pendingPromise;
                if (result && result.success) {
                  // Success from pending request
                } else {
                  console.warn(`   ⚠️  Pending transcription request failed: ${result?.error || 'Unknown error'}`);
                }
              } catch (error) {
                console.error(`   ❌ Pending transcription request error:`, error.message);
              }
            } else {
              // No pending request, proceed with transcription (with retry logic)
              let retries = 2;
              let result = null;
              while (retries >= 0 && this.isRecording) {
                try {
                  result = await this.transcriptionService.transcribe(chunkPath, idx);
                  if (result && result.success) {
                    break; // Success, exit retry loop
                  }
                } catch (transcribeError) {
                  // Check if recording stopped (graceful cancellation)
                  if (!this.isRecording) {
                    console.log(`   ⏹️  Recording stopped, cancelling transcription retry for chunk ${idx}`);
                    break;
                  }
                  console.error(`   ❌ Transcription error (${retries} retries left):`, transcribeError.message);
                }

                if (retries > 0 && (!result || !result.success) && this.isRecording) {
                  console.log(`   🔄 Retrying transcription for chunk ${idx}...`);
                  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                }
                retries--;
              }

              if (!result || !result.success) {
                if (this.isRecording) {
                  console.warn(`   ⚠️  Transcription failed after retries: ${result?.error || 'Unknown error'}`);
                } else {
                  console.log(`   ⏹️  Transcription cancelled (recording stopped)`);
                }
              }
            }
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

      // Request final data from streamRecorder and completeRecorder to maximize usable cumulative data
      await this.page.evaluate(() => {
        try {
          if (window.audioCapture?.streamRecorder?.state === 'recording') {
            window.audioCapture.streamRecorder.requestData();
            console.log('[KAIRO] Requested final data from streamRecorder');
          }
          if (window.audioCapture?.completeRecorder?.state === 'recording') {
            window.audioCapture.completeRecorder.requestData();
            console.log('[KAIRO] Requested final data from completeRecorder');
          }
        } catch (e) {
          console.error('[KAIRO] Error requesting final data:', e);
        }
      }).catch(() => { });

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

      // Use WebM directly for transcription (WhisperX supports WebM via load_audio)
      // CRITICAL FIX: Don't wait for transcription - do it in background
      // The transcription might hang and we need to proceed to save the complete recording
      if (this.transcriptionService) {
        const finalChunkIdx = idx; // Capture idx for use in promise
        console.log(`💾 FINAL chunk ${chunkData.startIndex} → ${chunkData.endIndex} (extracting ~3s) - Saved: ${path.basename(chunkPath)}`);
        // Transcribe WebM directly in background
        this.transcriptionService.transcribe(chunkPath, finalChunkIdx)
          .catch((err) => {
            console.error('   ❌ Background transcription error:', err.message);
          });
      } else {
        console.log(`💾 FINAL chunk ${chunkData.startIndex} → ${chunkData.endIndex} (extracting ~3s) - Saved: ${path.basename(chunkPath)}`);
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
    // Mark recording as stopped to cancel pending transcriptions gracefully
    this.isRecording = false;

    // Cancel all pending transcription requests gracefully
    if (this.transcriptionService) {
      this.transcriptionService.cancelPendingRequests();
    }

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
        // Use ffprobe instead of ffmpeg for duration extraction
        const ffprobePath = ffmpegPath.replace('ffmpeg.exe', 'ffprobe.exe').replace('ffmpeg', 'ffprobe');
        // Method 1: JSON output (most reliable)
        const ffprobeJsonCommand = `"${ffprobePath}" -v error -show_entries format=duration -of json "${inputPath}"`;

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
            const ffprobeCommand = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`;

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
                        const fixedProbeCommand = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fixedPath}"`;
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
                                try { if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath); } catch (e) { }
                              }, 5000);
                              return;
                            }
                          }
                          // If fixed file also doesn't work, give up
                          try { if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath); } catch (e) { }
                          return resolve(false);
                        });
                        return;
                      }

                      // Fixing failed, give up
                      try { if (fs.existsSync(fixedPath)) fs.unlinkSync(fixedPath); } catch (e) { }
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

