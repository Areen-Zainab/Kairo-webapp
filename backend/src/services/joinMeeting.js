// bot-join.js - FIXED FOR WINDOWS - INTEGRATED AS MODULE
require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const { spawn } = require('child_process');

puppeteer.use(StealthPlugin());

const RECORDINGS_DIR = path.join(__dirname, 'recordings');
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}
const CHUNKS_DIR = path.join(RECORDINGS_DIR, 'chunks');
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

let pythonProc = null;
let pythonStdoutBuffer = '';
let pythonResolvers = [];
let transcriptFilepath = null;
let chunkFlushInterval = null;
let chunkSequence = 0;
const PY_SCRIPT_PATH = path.resolve(__dirname, '../../ai-layer/whisperX/transcribe-whisper.py');

console.log('📁 Recordings folder:', path.resolve(RECORDINGS_DIR));

// Convert waitForTimeout to sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert WebM to MP3
 */
function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = ffmpeg.path;
    const command = `"${ffmpegPath}" -i "${inputPath}" -vn -ar 44100 -ac 2 -b:a 192k "${outputPath}" -y`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log('⚠️  FFmpeg conversion failed:', error.message);
        console.log('   WebM file still available');
        resolve(); // Don't reject, just continue
      } else {
        console.log('✅ MP3 conversion complete');
        resolve();
      }
    });
  });
}

function convertToWav(inputPath, outputPath) {
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

function ensurePythonProc() {
  if (pythonProc && !pythonProc.killed) return;
  const candidates = ['python', 'py'];
  let started = false;
  for (const cmd of candidates) {
    try {
      const proc = spawn(cmd, [PY_SCRIPT_PATH], { shell: process.platform === 'win32' });
      pythonProc = proc;
      pythonStdoutBuffer = '';
      pythonResolvers = [];
      proc.stdout.on('data', (data) => {
        pythonStdoutBuffer += data.toString();
        let idx;
        while ((idx = pythonStdoutBuffer.indexOf('\n')) !== -1) {
          const line = pythonStdoutBuffer.slice(0, idx).trim();
          pythonStdoutBuffer = pythonStdoutBuffer.slice(idx + 1);
          const resolver = pythonResolvers.shift();
          if (resolver) resolver.resolve(line);
        }
      });
      proc.stderr.on('data', (data) => {
        const resolver = pythonResolvers.shift();
        if (resolver) resolver.reject(new Error(data.toString()));
      });
      proc.on('close', () => {
        while (pythonResolvers.length) {
          const r = pythonResolvers.shift();
          r.reject(new Error('Python process closed'));
        }
      });
      started = true;
      break;
    } catch (_) {}
  }
  if (!started) throw new Error('Failed to start Python');
}

function sendToPython(audioPath) {
  return new Promise((resolve, reject) => {
    try {
      ensurePythonProc();
    } catch (e) {
      return reject(e);
    }
    pythonResolvers.push({ resolve, reject });
    try {
      pythonProc.stdin.write(audioPath + '\n');
    } catch (e) {
      const r = pythonResolvers.pop();
      if (r) r.reject(e);
    }
  });
}

function runPythonOneShot(audioPath) {
  return new Promise((resolve, reject) => {
    const candidates = ['python', 'py'];
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

function transcribeChunk(chunkPath) {
  return sendToPython(chunkPath).catch(() => runPythonOneShot(chunkPath)).then((text) => {
    if (text && text.trim()) {
      const line = `[${new Date().toISOString()}] ${text}\n`;
      if (transcriptFilepath) fs.appendFileSync(transcriptFilepath, line);
      process.stdout.write(`\n📝 Transcribed: ${text.substring(0, 100)}${text.length>100?'…':''}\n`);
    }
  }).catch(() => {});
}

async function injectChunkGetter(page) {
  await page.evaluate(() => {
    if (!window.audioCapture) return;
    if (window.getAndClearChunks) return;
    window.getAndClearChunks = function() {
      try {
        const chunks = window.audioCapture?.recordedChunks || [];
        if (!chunks.length) return null;
        const current = chunks.splice(0, chunks.length);
        const blob = new Blob(current, { type: 'audio/webm' });
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              audio: reader.result.split(',')[1],
              size: blob.size,
              chunks: current.length
            });
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch (_) { return null; }
    };
  });
}

async function startRealtimeTranscription(page) {
  try { await injectChunkGetter(page); } catch (_) {}
  if (chunkFlushInterval) clearInterval(chunkFlushInterval);
  chunkFlushInterval = setInterval(async () => {
    try {
      if (!page || page.isClosed()) return;
      const data = await page.evaluate(() => window.getAndClearChunks ? window.getAndClearChunks() : null);
      const chunkData = data && data.then ? await data : data;
      if (!chunkData || !chunkData.audio || !chunkData.size) return;
      const ts = Date.now();
      const idx = chunkSequence++;
      const chunkFilename = `chunk_${ts}_${idx}.webm`;
      const chunkPath = path.join(CHUNKS_DIR, chunkFilename);
      fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
      console.log(`\n💾 Chunk saved: ${path.resolve(chunkPath)} (${(chunkData.size/1024).toFixed(1)} KB)`);
      const mp3Path = chunkPath.replace(/\.webm$/i, '.mp3');
      try { await convertToMp3(chunkPath, mp3Path); console.log(`🎧 Chunk MP3: ${path.resolve(mp3Path)}`); } catch (_) {}
      await transcribeChunk(fs.existsSync(mp3Path) ? mp3Path : chunkPath);
    } catch (_) {}
  }, 4000);
}

async function flushPendingChunks(page) {
  try {
    if (!page || page.isClosed()) return;
    const data = await page.evaluate(() => window.getAndClearChunks ? window.getAndClearChunks() : null);
    const chunkData = data && data.then ? await data : data;
    if (!chunkData || !chunkData.audio || !chunkData.size) return;
    const ts = Date.now();
    const idx = chunkSequence++;
    const chunkFilename = `chunk_${ts}_${idx}.webm`;
    const chunkPath = path.join(CHUNKS_DIR, chunkFilename);
    fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
    console.log(`\n💾 Final chunk saved: ${path.resolve(chunkPath)} (${(chunkData.size/1024).toFixed(1)} KB)`);
    const mp3Path = chunkPath.replace(/\.webm$/i, '.mp3');
    try { await convertToMp3(chunkPath, mp3Path); console.log(`🎧 Final chunk MP3: ${path.resolve(mp3Path)}`); } catch (_) {}
    await transcribeChunk(fs.existsSync(mp3Path) ? mp3Path : chunkPath);
  } catch (_) {}
}

/**
 * Save recording to file
 */
async function saveRecording(page, baseName) {
  try {
    if (!page || page.isClosed()) {
      console.log('❌ Page is closed');
      return null;
    }

    console.log('⏳ Retrieving audio data...');
    
    const audioData = await page.evaluate(() => {
      return window.stopAndGetAudio();
    }).catch(err => {
      console.error('❌ Error:', err.message);
      return null;
    });

    if (!audioData || !audioData.audio) {
      console.log('\n❌ No audio recorded!');
      
      const debugInfo = await page.evaluate(() => {
        return {
          hasTrack: window.audioCapture?.trackToRecord !== null,
          chunks: window.audioCapture?.recordedChunks?.length || 0,
          isRecording: window.audioCapture?.isRecording || false
        };
      }).catch(() => null);
      
      if (debugInfo) {
        console.log('Debug: Track Found:', debugInfo.hasTrack, '| Chunks:', debugInfo.chunks);
      }
      
      return null;
    }

    console.log('✅ Audio retrieved:', (audioData.size / 1024).toFixed(1), 'KB');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
    const webmFilename = baseName ? `${baseName}.webm` : `recording_${timestamp}.webm`;
    const webmFilepath = path.join(RECORDINGS_DIR, webmFilename);
    
    console.log('⏳ Saving WebM file...');
    const buffer = Buffer.from(audioData.audio, 'base64');
    fs.writeFileSync(webmFilepath, buffer);
    
    console.log('✅ WebM saved');
    
    // Convert to MP3
    console.log('⏳ Converting to MP3...');
    const mp3Filename = baseName ? `${baseName}.mp3` : `recording_${timestamp}.mp3`;
    const mp3Filepath = path.join(RECORDINGS_DIR, mp3Filename);
    
    await convertToMp3(webmFilepath, mp3Filepath);
    
    console.log('\n✅ RECORDING SAVED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📁 MP3 File:', mp3Filename);
    console.log('📂 MP3 Path:', path.resolve(mp3Filepath));
    console.log('📁 WebM File:', webmFilename);
    console.log('📂 WebM Path:', path.resolve(webmFilepath));
    console.log('📊 Size:', (audioData.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('📦 Chunks:', audioData.chunks);
    console.log('⏱️  Duration: ~', audioData.chunks, 'seconds');
    console.log('\n💡 Play the MP3 file - it works everywhere!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return {
      mp3Path: mp3Filepath,
      webmPath: webmFilepath,
      size: audioData.size,
      chunks: audioData.chunks
    };
  } catch (error) {
    console.error('\n❌ Save failed:', error.message);
    return null;
  }
}

/**
 * Join a Google Meet meeting
 * 
 * @param {Object} options - Meeting options
 * @param {string} options.meetUrl - The Google Meet URL (required)
 * @param {string} [options.botName] - Bot display name
 * @param {number} [options.durationMinutes] - Duration in minutes (for auto-exit)
 * @param {string} [options.meetingId] - Meeting ID for tracking
 * @returns {Promise<Object>} Meeting session information
 */
async function joinMeeting({ meetUrl, botName, durationMinutes, meetingId, meetingTitle }) {
  const MEET_URL = meetUrl; // Use provided meetUrl parameter
  const BOT_NAME = botName || process.env.BOT_NAME || 'Kairo Bot';
  const SHOW_BROWSER = process.env.SHOW_BROWSER === 'true';
  const DURATION_MINUTES = durationMinutes || 0; // 0 means no auto-exit

  let globalPage = null;
  let globalBrowser = null;
  let monitorInterval = null;
  let autoExitTimeout = null;
  const slugify = (str) => (str || '').toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  const baseName = (() => {
    const titleSlug = slugify(meetingTitle);
    const idPart = meetingId ? String(meetingId) : null;
    if (titleSlug && idPart) return `${titleSlug}_${idPart}`;
    if (idPart) return `meeting_${idPart}`;
    return null;
  })();

  console.log('\n🚀 Kairo Bot Starting...');
  console.log('📍 URL:', MEET_URL);
  if (meetingId) {
    console.log('📋 Meeting ID:', meetingId);
  }

  try {
    globalBrowser = await puppeteer.launch({
      headless: !SHOW_BROWSER,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
      defaultViewport: { width: 1280, height: 720 }
    });

    globalPage = await globalBrowser.newPage();
    
    await globalPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Get origin from URL
    const MEET_ORIGIN = (() => {
      try {
        return new URL(MEET_URL).origin;
      } catch {
        return 'https://meet.google.com';
      }
    })();

    // Grant permissions
    const context = globalBrowser.defaultBrowserContext();
    await context.overridePermissions(MEET_URL, [
      'camera', 
      'microphone',
      'notifications'
    ]);

    // =================================================================
    // START OF FIXED AUDIO INJECTION
    // =================================================================
    await globalPage.evaluateOnNewDocument(() => {
      window.audioCapture = {
        audioContext: null,
        mediaRecorder: null,
        recordedChunks: [],
        isRecording: false,
        trackToRecord: null // We will only store ONE track
      };

      // Intercept RTCPeerConnection
      const OriginalRTCPeerConnection = window.RTCPeerConnection;
      
      window.RTCPeerConnection = function(config) {
        const pc = new OriginalRTCPeerConnection(config);
        
        pc.addEventListener('track', async (event) => {
          // If we already have a track or are already recording, ignore new tracks
          if (window.audioCapture.trackToRecord || window.audioCapture.isRecording) {
            return;
          }

          if (event.track.kind === 'audio' && event.streams && event.streams.length > 0) {
            
            // Heuristic: Check for 'event.receiver'. This usually means it's an INCOMING track.
            // This avoids recording the bot's own (silent) outgoing microphone track.
            if (!event.receiver) {
                console.log('[KAIRO] ⓘ Skipping non-receiver audio track (likely local).');
                return;
            }
            
            console.log('[KAIRO] ✅ Found suitable remote audio track:', event.track.id);
            
            // Store this ONE track
            window.audioCapture.trackToRecord = event.track;
            
            // Start recording immediately (no 3-second wait)
            window.startAudioRecording();
          }
        });
        
        return pc;
      };

      window.startAudioRecording = function() {
        try {
          // Check if we have our single track
          if (!window.audioCapture.trackToRecord) {
            console.log('[KAIRO] ⚠️ No track to record');
            return;
          }

          // Check if we're already recording (shouldn't happen, but good to check)
          if (window.audioCapture.isRecording) {
            return;
          }

          console.log('[KAIRO] 🎬 Starting recording with 1 unique track');
          
          // Create AudioContext
          window.audioCapture.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const dest = window.audioCapture.audioContext.createMediaStreamDestination();
          
          // Connect ONLY our one chosen track
          try {
            const stream = new MediaStream([window.audioCapture.trackToRecord]);
            const audioSource = window.audioCapture.audioContext.createMediaStreamSource(stream);
            audioSource.connect(dest);
            console.log('[KAIRO] 🔗 Connected single track');
          } catch (err) {
            console.log('[KAIRO] ⚠️ Error connecting track:', err.message);
            return; // Exit if we can't connect
          }
          
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
            ? 'audio/webm;codecs=opus' 
            : 'audio/webm';
          
          window.audioCapture.mediaRecorder = new MediaRecorder(dest.stream, {
            mimeType: mimeType,
            audioBitsPerSecond: 128000
          });
          
          // Simple recording - save all chunks
          window.audioCapture.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              window.audioCapture.recordedChunks.push(event.data);
            }
          };
          
          window.audioCapture.mediaRecorder.onstart = () => {
            window.audioCapture.isRecording = true;
            console.log('[KAIRO] 🔴 RECORDING ACTIVE');
          };
          
          window.audioCapture.mediaRecorder.onstop = () => {
            window.audioCapture.isRecording = false;
            console.log('[KAIRO] ⏹️ Recording stopped');
            console.log('[KAIRO] 📦 Total chunks:', window.audioCapture.recordedChunks.length);
          };
          
          window.audioCapture.mediaRecorder.onerror = (error) => {
            console.error('[KAIRO] ❌ Recorder error:', error);
          };
          
          // Start with 1 second intervals
          window.audioCapture.mediaRecorder.start(1000);
          
        } catch (error) {
          console.error('[KAIRO] ❌ Failed to start recording:', error);
        }
      };

      // stopAndGetAudio remains unchanged. It correctly processes the final chunk list.
      window.stopAndGetAudio = function() {
        return new Promise((resolve) => {
          try {
            if (!window.audioCapture.mediaRecorder || window.audioCapture.recordedChunks.length === 0) {
              console.log('[KAIRO] No recording to save');
              resolve(null);
              return;
            }

            const currentChunks = [...window.audioCapture.recordedChunks];
            
            const processChunks = () => {
              const blob = new Blob(currentChunks, { type: 'audio/webm' });
              const reader = new FileReader();
              
              reader.onloadend = () => {
                resolve({
                  audio: reader.result.split(',')[1],
                  size: blob.size,
                  chunks: currentChunks.length
                });
              };
              
              reader.onerror = () => {
                resolve(null);
              };
              
              reader.readAsDataURL(blob);
            };

            if (window.audioCapture.mediaRecorder.state !== 'inactive') {
              window.audioCapture.mediaRecorder.onstop = processChunks;
              window.audioCapture.mediaRecorder.stop();
              
              if (window.audioCapture.audioContext) {
                window.audioCapture.audioContext.close();
              }
            } else {
              processChunks();
            }
            
          } catch (error) {
            console.error('[KAIRO] Error:', error);
            resolve(null);
          }
        });
      };
    });
    // =================================================================
    // END OF FIXED AUDIO INJECTION
    // =================================================================

    console.log('✅ Audio capture system injected');

    // Navigate to meeting
    console.log('\n⏳ Loading meeting...');
    await globalPage.goto(MEET_URL, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });
    
    await sleep(5000);
    console.log('✅ Page loaded');

    // Enter bot name
    console.log('\n⏳ Entering name...');
    try {
      await globalPage.waitForSelector('input[type="text"]', { timeout: 10000 });
      await globalPage.evaluate((name) => {
        const inputs = document.querySelectorAll('input');
        for (const input of inputs) {
          const placeholder = (input.placeholder || '').toLowerCase();
          const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
          
          if (placeholder.includes('name') || ariaLabel.includes('name') || input.type === 'text') {
            input.value = name;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('Name entered:', name);
            break;
          }
        }
      }, BOT_NAME);
      console.log('✅ Name entered');
    } catch (e) {
      console.log('⚠️ Name field not found or already filled');
    }
    
    await sleep(2000);

    // Turn OFF camera and microphone
    console.log('\n🔧 Disabling camera and microphone...');
    try {
      // Check if page is still open before attempting to evaluate
      if (!globalPage || globalPage.isClosed()) {
        console.log('⚠️ Page is closed, skipping camera/mic disable');
      } else {
        await globalPage.evaluate(() => {
          const buttons = document.querySelectorAll('button, div[role="button"]');
          
          buttons.forEach(btn => {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            
            if (label.includes('turn off camera') || label.includes('camera off')) {
              btn.click();
            }
            
            if (label.includes('turn off microphone') || label.includes('mute')) {
              btn.click();
            }
          });
        });
        await sleep(2000);
        console.log('✅ Camera and mic disabled');
      }
    } catch (error) {
      console.error('❌ Error disabling camera/mic:', error.message);
      // Continue execution even if this fails
    }

    // Click "Join now"
    console.log('\n⏳ Joining meeting...');
    try {
      // Check if page is still open before attempting to evaluate
      if (!globalPage || globalPage.isClosed()) {
        throw new Error('Page is closed, cannot join meeting');
      }
      
      await globalPage.evaluate(() => {
        const buttons = document.querySelectorAll('button, div[role="button"]');
        buttons.forEach(btn => {
          const text = (btn.textContent || '').toLowerCase();
          if (text.includes('join now') || text.includes('ask to join')) {
            btn.click();
          }
        });
      });
      
      await sleep(8000);
      console.log('✅ Join clicked');
    } catch (error) {
      console.error('❌ Error joining meeting:', error.message);
      throw error; // Re-throw as this is critical
    }

    await sleep(5000);

    // Check recording status
    let recordingStatus = { isRecording: false, hasTrack: false, chunks: 0 };
    try {
      if (globalPage && !globalPage.isClosed()) {
        recordingStatus = await globalPage.evaluate(() => {
          return {
            isRecording: window.audioCapture?.isRecording || false,
            hasTrack: window.audioCapture?.trackToRecord !== null,
            chunks: window.audioCapture?.recordedChunks?.length || 0
          };
        });
      } else {
        console.log('⚠️ Page is closed, skipping recording status check');
      }
    } catch (error) {
      console.error('❌ Error checking recording status:', error.message);
    }

    console.log('\n📊 Recording Status:');
    console.log('  🎵 Audio track found:', recordingStatus.hasTrack ? 'YES' : 'NO');
    console.log('  🔴 Recording:', recordingStatus.isRecording ? 'YES' : 'NO');
    console.log('  📦 Chunks:', recordingStatus.chunks);

    if (!recordingStatus.isRecording && recordingStatus.hasTrack) {
      console.log('\n⚠️ Recording not started automatically, forcing start...');
      try {
        if (globalPage && !globalPage.isClosed()) {
          await globalPage.evaluate(() => window.startAudioRecording());
          await sleep(2000);
        }
      } catch (error) {
        console.error('❌ Error starting recording:', error.message);
      }
    }

    console.log('\n✅ Bot joined successfully!');
    console.log('🎤 Recording meeting audio...');
    // Prepare transcript and start realtime transcription
    const transcriptTimestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
    const transcriptFilename = `transcript_${transcriptTimestamp}.txt`;
    transcriptFilepath = path.join(RECORDINGS_DIR, transcriptFilename);
    try { fs.writeFileSync(transcriptFilepath, `Kairo Transcript (${new Date().toISOString()})\n\n`); } catch (_) {}
    console.log('📝 Live transcript file:', path.resolve(transcriptFilepath));
    await startRealtimeTranscription(globalPage);

    // Set up auto-exit if duration specified
    if (DURATION_MINUTES > 0) {
      console.log(`\n⏰ Auto mode: Will record for ${DURATION_MINUTES} minutes`);
      autoExitTimeout = setTimeout(async () => {
        console.log('\n\n⏰ Duration reached, stopping recording...');
        await saveRecording(globalPage, baseName);
        if (globalBrowser) await globalBrowser.close();
      }, DURATION_MINUTES * 60 * 1000);
    } else {
      console.log('\n💡 Recording in progress. Use stop() method to save recording.\n');
    }

    // Monitor recording
    let lastChunkCount = 0;
    monitorInterval = setInterval(async () => {
      try {
        if (!globalPage || globalPage.isClosed()) {
          clearInterval(monitorInterval);
          monitorInterval = null;
          return;
        }
        
        // Wrap evaluate in try-catch to handle "Requesting main frame too early" errors
        let status;
        try {
          status = await globalPage.evaluate(() => ({
            chunks: window.audioCapture?.recordedChunks?.length || 0,
            isRecording: window.audioCapture?.isRecording || false
          }));
        } catch (evalError) {
          // Page might have closed/navigated during evaluate
          if (evalError.message.includes('Requesting main frame too early') || 
              evalError.message.includes('Page is closed') ||
              globalPage.isClosed()) {
            clearInterval(monitorInterval);
            monitorInterval = null;
            return;
          }
          throw evalError; // Re-throw unexpected errors
        }
        
        if (status.chunks > lastChunkCount) {
          const timeStr = DURATION_MINUTES > 0 
            ? `(auto: ~${Math.max(0, DURATION_MINUTES * 60 - status.chunks)}s remaining)`
            : '(running)';
          process.stdout.write(`\r🔴 Recording... ${status.chunks} chunks | ${(status.chunks * 1).toFixed(0)}s  ${timeStr}  `);
          lastChunkCount = status.chunks;
        }
      } catch (e) {
        // Ignore - page might be closing or other transient errors
        if (globalPage && !globalPage.isClosed()) {
          // Only log if page is still open (might be a real error)
          // console.error('Monitor error:', e.message);
        }
      }
    }, 1000);

    // Return session object with stop method
    return {
      success: true,
      meetingId: meetingId,
      page: globalPage,
      browser: globalBrowser,
      stop: async () => {
        console.log('\n\n🛑 Stopping recording...');
        
        // Close browser FIRST
        if (globalBrowser) {
          try {
            console.log('Closing browser...');
            await globalBrowser.close();
            console.log('✅ Browser closed');
          } catch (err) {
            console.error('❌ Error closing browser:', err.message);
          }
        }
        
        // Then stop intervals and clean up
        if (monitorInterval) {
          clearInterval(monitorInterval);
          monitorInterval = null;
        }
        if (autoExitTimeout) {
          clearTimeout(autoExitTimeout);
          autoExitTimeout = null;
        }
        if (chunkFlushInterval) {
          clearInterval(chunkFlushInterval);
          chunkFlushInterval = null;
        }
        
        // Try to save recording if page is still available (may fail if browser already closed)
        try { 
          if (globalPage && !globalPage.isClosed?.()) {
            await flushPendingChunks(globalPage); 
            await saveRecording(globalPage, baseName);
          } else {
            console.log('⚠️ Page already closed, skipping save');
          }
        } catch (err) {
          console.error('❌ Error saving recording:', err.message);
        }
        
        // Kill Python process
        try { 
          if (pythonProc && !pythonProc.killed) { 
            pythonProc.stdin?.write('EXIT\n'); 
            pythonProc.kill(); 
          }
        } catch (err) {
          console.error('❌ Error killing Python process:', err.message);
        }
      }
    };

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (monitorInterval) {
      clearInterval(monitorInterval);
    }
    if (autoExitTimeout) {
      clearTimeout(autoExitTimeout);
    }
    // Try to save before closing if possible
    try { await saveRecording(globalPage, baseName); } catch (_) {}
    if (globalBrowser) {
      await globalBrowser.close();
    }
    
    throw error;
  }
}

module.exports = { joinMeeting, saveRecording };