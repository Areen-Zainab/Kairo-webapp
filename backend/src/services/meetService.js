// bot-join.js - FIXED FOR WINDOWS
require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');
const { spawn } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');

puppeteer.use(StealthPlugin());

const MEET_URL = process.env.MEET_URL || 'https://meet.google.com/hpr-rjtn-koe';
const MEET_ORIGIN = (() => { try { return new URL(MEET_URL).origin; } catch { return 'https://meet.google.com'; } })();
const BOT_NAME = process.env.BOT_NAME || 'Kairo Bot';
const SHOW_BROWSER = process.env.SHOW_BROWSER === 'true';
const USER_DATA_DIR = process.env.USER_DATA_DIR || path.join(__dirname, 'puppeteer_profile');
const AUTO_MODE = process.env.AUTO_MODE === 'true' || process.env.MEETING_ID !== undefined;
const DURATION_MINUTES = parseInt(process.env.DURATION_MINUTES || '60', 10);

console.log('⚙️  Environment:');
console.log('   NODE_ENV       =', process.env.NODE_ENV || 'development');
console.log('   BOT_NAME       =', BOT_NAME);
console.log('   SHOW_BROWSER   =', SHOW_BROWSER);
console.log('   MEET_URL       =', MEET_URL);
console.log('   MEETING_ID     =', process.env.MEETING_ID || 'N/A');
console.log('   MEETING_TITLE  =', process.env.MEETING_TITLE || '');
console.log('   USER_DATA_DIR  =', USER_DATA_DIR);
console.log('   AUTO_MODE      =', AUTO_MODE);
if (AUTO_MODE) {
  console.log('   DURATION       =', DURATION_MINUTES, 'minutes');
}

const RECORDINGS_DIR = path.join(__dirname, 'recordings');
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}
if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

// Ensure USER_DATA_DIR path is absolute and properly escaped for Windows
const normalizedUserDataDir = path.resolve(USER_DATA_DIR);

console.log('📁 Recordings folder:', path.resolve(RECORDINGS_DIR));

let globalPage = null;
let globalBrowser = null;
let monitorInterval = null;
let autoExitTimeout = null;
let chunkFlushInterval = null;
let chunkSequence = 0;
let transcriptFilepath = null;
let pythonProc = null;
let pythonStdoutBuffer = '';
let pythonResolvers = [];
let isFinalizing = false;

// Additional paths for realtime transcription
const CHUNKS_DIR = path.join(RECORDINGS_DIR, 'chunks');
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}
const PY_SCRIPT_PATH = path.resolve(__dirname, '../../..', 'ai-layer', 'whisperX', 'transcribe-whisper.py');

// Cleanup function
async function cleanup() {
  try {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
    if (chunkFlushInterval) {
      clearInterval(chunkFlushInterval);
      chunkFlushInterval = null;
    }
    if (autoExitTimeout) {
      clearTimeout(autoExitTimeout);
      autoExitTimeout = null;
    }
    if (rl) {
      rl.close();
      rl = null;
    }
    if (globalBrowser) {
      await globalBrowser.close().catch(() => {});
      globalBrowser = null;
    }
    try {
      if (pythonProc && !pythonProc.killed) {
        pythonProc.stdin?.write('EXIT\n');
        pythonProc.kill();
      }
    } catch (_) {}
  } catch (err) {
    console.error('⚠️  Error during cleanup:', err.message);
  }
}

// Simple sleep helper for Puppeteer v24+
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper for fragile DOM operations (handles frame detach and context loss)
async function withRetry(label, fn, attempts = 3, delayMs = 1500) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const result = await fn();
      if (i > 1) console.log(`✅ ${label} succeeded on attempt ${i}`);
      return result;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const transient = msg.includes('detached') || msg.includes('Execution context was destroyed') || msg.includes('Cannot find context with specified id');
      console.warn(`⚠️  ${label} failed on attempt ${i}: ${msg}`);
      if (i < attempts && transient) {
        console.log(`🔄 Retrying ${label} after ${delayMs}ms...`);
        await sleep(delayMs);
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

// Setup readline interface for Windows (only if stdin is available)
let rl = null;
const isStdinAvailable = process.stdin.isTTY && !AUTO_MODE;
if (isStdinAvailable) {
  try {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  } catch (err) {
    console.warn('⚠️  Could not initialize readline (stdin not available), running in auto mode');
    rl = null;
  }
}

async function joinGoogleMeet() {
  console.log('\n🚀 Kairo Bot Starting...');
  console.log('📍 URL:', MEET_URL);
  
  try {
    console.log('\n🧭 Launching Chromium... (headless:', !SHOW_BROWSER ? 'true' : 'false', ')');
    globalBrowser = await puppeteer.launch({
      headless: !SHOW_BROWSER,
      slowMo: SHOW_BROWSER ? 50 : 0,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--no-first-run',
        '--no-default-browser-check',
        '--autoplay-policy=no-user-gesture-required',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--user-data-dir=${normalizedUserDataDir}`,
        '--lang=en-US,en'
      ],
      defaultViewport: { width: 1280, height: 720 }
    });
    console.log('✅ Chromium launched');

    globalPage = await globalBrowser.newPage();
    console.log('🗂️  New page created');
    try { await globalPage.bringToFront(); } catch (_) {}
    try { globalPage.setDefaultTimeout?.(30000); } catch (_) {}
    try { globalPage.setDefaultNavigationTimeout?.(120000); } catch (_) {}
  try { await globalPage.setBypassCSP?.(true); } catch (_) {}
    try { await globalPage.setExtraHTTPHeaders?.({ 'Accept-Language': 'en-US,en;q=0.9' }); } catch (_) {}

  // Basic diagnostics to catch unexpected issues
  globalPage.on('error', (err) => console.error('❌ [page error]', err));
  globalPage.on('pageerror', (err) => console.error('❌ [console pageerror]', err));
  globalPage.on('close', () => console.log('⚠️  Page closed'));
  globalPage.on('framenavigated', (frame) => {
    if (frame === globalPage.mainFrame()) {
      console.log('🔎 Main frame navigated to:', frame.url());
    }
  });
  globalPage.on('dialog', async (dialog) => {
    try { console.log('🔔 Dismissing dialog:', dialog.message()); await dialog.dismiss(); } catch (_) {}
  });
    
    await globalPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Grant permissions
    const context = globalBrowser.defaultBrowserContext();
    await context.overridePermissions(MEET_ORIGIN, [
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
    let navSuccess = false, navAttempts = 0;
    for (navAttempts = 0; navAttempts < 3; navAttempts++) {
      try {
        const res = await globalPage.goto(MEET_URL, { waitUntil: 'load', timeout: 120000 });
        console.log('🌐 Navigation response:', res ? `${res.status()} ${res.url()}` : 'no response');
        // Additional waits until fully ready
        try { await globalPage.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 }); } catch (_) {}
        try { await globalPage.waitForNetworkIdle?.({ idleTime: 2000, timeout: 45000 }); } catch (_) {}
        navSuccess = true;
        await sleep(1500);
        console.log('✅ Page loaded on attempt', navAttempts + 1);
        break;
      } catch (err) {
        console.error(`❌ Navigation error on attempt ${navAttempts + 1}:`, err.message);
        try {
          if (globalBrowser && globalBrowser.process) {
            const browserProcess = globalBrowser.process();
            if (browserProcess && browserProcess.exitCode != null) {
              console.error('❌ Chromium process has exited. Exiting.');
              if (globalBrowser) await globalBrowser.close().catch(() => {});
              process.exit(2);
            }
          }
        } catch (_) {}
        
        try {
          if (globalPage && await globalPage.isClosed?.()) {
            console.error('❌ Puppeteer page was closed unexpectedly. Exiting.');
            if (globalBrowser) await globalBrowser.close().catch(() => {});
            process.exit(2);
          }
        } catch (_) {}
        
        if (navAttempts < 2) {
          console.log('🔄 Retrying navigation...');
          await sleep(3000);
        }
      }
    }
    // Handle cookie/consent and blocked states early
    try {
      await withRetry('dismiss cookie/consent', async () => {
        await globalPage.evaluate(() => {
          const clickByText = (txts) => {
            const all = Array.from(document.querySelectorAll('button, div[role="button"], span'));
            for (const el of all) {
              const t = (el.textContent || '').toLowerCase();
              if (txts.some(s => t.includes(s))) { el.click(); return true; }
            }
            return false;
          };
          clickByText(['accept all', 'i agree', 'got it', 'allow all']);
        });
      }, 2, 1000);
    } catch (_) {}

    // Detect blocking text that indicates account requirement
    try {
      const blocked = await globalPage.evaluate(() => {
        const bodyText = (document.body?.innerText || '').toLowerCase();
        return bodyText.includes("you can't join this meeting") || bodyText.includes('you cannot join this meeting');
      });
      if (blocked) {
        console.error("🚫 Detected 'You can't join this meeting' page – Google often requires a signed-in account for this meeting.");
        console.error('👉 Fix: Launch once with SHOW_BROWSER=true and USER_DATA_DIR set, sign into Google in the opened browser. The session will persist for auto-join.');
        console.error('   USER_DATA_DIR currently:', USER_DATA_DIR);
        if (globalBrowser) await globalBrowser.close();
        process.exit(3);
      }
    } catch (_) {}
    if (!navSuccess) {
      console.error('❌ Could not load Google Meet page after 2 attempts. Please check the meet link, your internet, and Google authentication/CAPTCHA.');
      if (globalBrowser) await globalBrowser.close();
      process.exit(2);
    }

    // ... [Code for entering name, disabling mic/cam, joining meeting is unchanged] ...
    
    // Enter bot name
    console.log('\n⏳ Entering name...');
    try {
      await withRetry('wait for body', async () => {
        await globalPage.waitForSelector('body', { timeout: 10000 });
      });
      await withRetry('enter name', async () => {
        await globalPage.evaluate((name) => {
          const tryFill = () => {
            const inputs = Array.from(document.querySelectorAll('input'));
            const textboxes = inputs.filter(i => (i.type || '').toLowerCase() === 'text');
            const candidates = [...textboxes, ...inputs];
            for (const input of candidates) {
              const placeholder = (input.placeholder || '').toLowerCase();
              const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
              if (placeholder.includes('name') || ariaLabel.includes('name') || input.type === 'text') {
                input.value = name;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
            }
            return false;
          };
          tryFill();
        }, BOT_NAME);
      });
      console.log('✅ Name entered (if applicable)');
    } catch (e) {
      console.log('⚠️ Name field not found or already filled');
    }
    
    await sleep(2000);

    // Turn OFF camera and microphone
    console.log('\n🔧 Disabling camera and microphone...');
    await withRetry('disable cam/mic', async () => {
      // Try keyboard shortcuts first for reliability
      try { await globalPage.keyboard.down('Control'); await globalPage.keyboard.press('KeyD'); await globalPage.keyboard.up('Control'); } catch (_) {}
      await sleep(500);
      try { await globalPage.keyboard.down('Control'); await globalPage.keyboard.press('KeyE'); await globalPage.keyboard.up('Control'); } catch (_) {}
      // Fallback to UI buttons
      await globalPage.evaluate(() => {
        const buttons = document.querySelectorAll('button, div[role="button"][aria-label]');
        buttons.forEach(btn => {
          const label = (btn.getAttribute('aria-label') || '').toLowerCase();
          if (label.includes('turn off camera') || label.includes('camera off') || label.includes('camera is on') || label.includes('camera')) {
            btn.click();
          }
          if (label.includes('turn off microphone') || label.includes('mute') || label.includes('microphone is on') || label.includes('microphone')) {
            btn.click();
          }
        });
      });
    });
    
    await sleep(2000);
    console.log('✅ Camera and mic disabled');

    // Click "Join now"
    console.log('\n⏳ Joining meeting...');
    try {
      await withRetry('wait for join controls', async () => {
        await globalPage.waitForSelector('button, div[role="button"]', { timeout: 20000 });
      });
      await withRetry('click join', async () => {
        await globalPage.evaluate(() => {
          function tryClickByText(substrs) {
            const candidates = Array.from(document.querySelectorAll('button, div[role="button"]'));
            for (const btn of candidates) {
              const txt = (btn.textContent || '').toLowerCase();
              if (substrs.some(s => txt.includes(s))) { btn.click(); return true; }
            }
            return false;
          }
          if (!tryClickByText(['join now', 'ask to join', 'continue', 'join'])) {
            // Some flows use different controls (e.g., "Continue without audio")
            tryClickByText(['continue without', 'got it', 'allow']);
          }
        });
      });
    } catch (e) {
      console.log('⚠️ Join controls not found immediately, proceeding to next step');
    }
    
    await sleep(8000);
    console.log('✅ Join clicked');

    await sleep(5000);

    // Check recording status (MODIFIED)
    const recordingStatus = await globalPage.evaluate(() => {
      return {
        isRecording: window.audioCapture?.isRecording || false,
        hasTrack: window.audioCapture?.trackToRecord !== null, // Check if we found a track
        chunks: window.audioCapture?.recordedChunks?.length || 0
      };
    });

    console.log('\n📊 Recording Status:');
    console.log('  🎵 Audio track found:', recordingStatus.hasTrack ? 'YES' : 'NO'); // MODIFIED
    console.log('  🔴 Recording:', recordingStatus.isRecording ? 'YES' : 'NO');
    console.log('  📦 Chunks:', recordingStatus.chunks);

    if (!recordingStatus.isRecording && recordingStatus.hasTrack) { // MODIFIED
      console.log('\n⚠️ Recording not started automatically, forcing start...');
      await globalPage.evaluate(() => window.startAudioRecording());
      await sleep(2000);
    }

    console.log('\n✅ Bot joined successfully!');
    console.log('🎤 Recording meeting audio...');
    // Prepare transcript file and start realtime transcription
    const transcriptTimestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
    const transcriptFilename = `transcript_${transcriptTimestamp}.txt`;
    transcriptFilepath = path.join(RECORDINGS_DIR, transcriptFilename);
    try { fs.writeFileSync(transcriptFilepath, `Kairo Transcript (${new Date().toISOString()})\n\n`); } catch (_) {}
    console.log('📝 Live transcript file:', path.resolve(transcriptFilepath));
    await startRealtimeTranscription();
    // Watchdog: if no chunks arrive in 20s, try to force-start recording and log status
    setTimeout(async () => {
      try {
        const status = await globalPage.evaluate(() => ({
          hasTrack: !!(window.audioCapture?.trackToRecord),
          isRecording: !!(window.audioCapture?.isRecording),
          chunks: window.audioCapture?.recordedChunks?.length || 0
        }));
        if (status.chunks === 0) {
          console.log('⚠️  No chunks after 20s. hasTrack:', status.hasTrack, 'isRecording:', status.isRecording);
          try { await globalPage.evaluate(() => window.startAudioRecording && window.startAudioRecording()); } catch (_) {}
        }
      } catch (_) {}
    }, 20000);
    
    if (AUTO_MODE) {
      console.log(`\n⏰ Auto mode: Will record for ${DURATION_MINUTES} minutes`);
      autoExitTimeout = setTimeout(async () => {
        console.log('\n\n⏰ Duration reached, stopping recording...');
        await saveRecording();
        await cleanup();
        process.exit(0);
      }, DURATION_MINUTES * 60 * 1000);
    } else {
      console.log('\n💡 TYPE "stop" OR "save" AND PRESS ENTER TO SAVE RECORDING\n');
    }

    // Monitor recording
    let lastChunkCount = 0;
    let lastChunkTime = Date.now();
    monitorInterval = setInterval(async () => {
      try {
        if (!globalPage || await globalPage.isClosed?.()) {
          clearInterval(monitorInterval);
          monitorInterval = null;
          return;
        }
        const status = await globalPage.evaluate(() => ({
          chunks: window.audioCapture?.recordedChunks?.length || 0,
          isRecording: window.audioCapture?.isRecording || false,
          bodyText: (document.body?.innerText || '').toLowerCase()
        }));
        
        if (status.chunks > lastChunkCount) {
          let timeStr = '';
          if (AUTO_MODE && autoExitTimeout) {
            // Calculate remaining time (approximate)
            const remainingSec = Math.max(0, DURATION_MINUTES * 60 - status.chunks);
            timeStr = `(auto: ~${remainingSec}s remaining)`;
          } else {
            timeStr = '(type "stop" to save)';
          }
          process.stdout.write(`\r🔴 Recording... ${status.chunks} chunks | ${(status.chunks * 1).toFixed(0)}s  ${timeStr}  `);
          lastChunkCount = status.chunks;
          lastChunkTime = Date.now();
        }

        // Heuristic meeting-end detection
        const idleMs = Date.now() - lastChunkTime;
        const idleTooLong = idleMs > 90000; // 90s without audio
        const endedText = status.bodyText.includes('meeting has ended') ||
                          status.bodyText.includes('you left the meeting') ||
                          status.bodyText.includes('has ended') ||
                          status.bodyText.includes('return to home') ||
                          status.bodyText.includes('call ended');
        if (!isFinalizing && (idleTooLong || endedText)) {
          isFinalizing = true;
          console.log('\n\n🛑 Meeting appears to have ended. Finalizing...');
          try {
            await saveRecording();
          } catch (_) {}
          await cleanup();
          process.exit(0);
        }
      } catch (e) {
        // Ignore - page might be closing
      }
    }, 1000);

    // Listen for user input (only if readline is available)
    if (rl) {
      rl.on('line', async (input) => {
        const cmd = input.toLowerCase().trim();
        if (cmd === 'stop' || cmd === 'save' || cmd === 'exit' || cmd === 'quit') {
          console.log('\n\n🛑 Stopping recording...');
          await saveRecording();
          await cleanup();
          process.exit(0);
        }
      });
    }

    // Handle Ctrl+C and other termination signals
    const handleExit = async (signal) => {
      console.log(`\n\n🛑 Received ${signal}, stopping recording...`);
      await saveRecording();
      await cleanup();
      process.exit(0);
    };
    
    process.on('SIGINT', () => handleExit('SIGINT'));
    process.on('SIGTERM', () => handleExit('SIGTERM'));
    process.on('beforeExit', async () => {
      await cleanup();
    });

    // Keep running until exit signal or timeout
    // For auto mode, timeout will handle exit
    // For manual mode, wait for user input or signal
    // For spawned/detached processes without readline, keep running indefinitely
    if (!AUTO_MODE && rl) {
      // Manual mode with readline - wait forever until user types stop or signal
      await new Promise(() => {});
    } else {
      // Auto mode or spawned without readline - wait until timeout or browser closes
      await new Promise((resolve) => {
        // Check periodically if browser is still connected
        const checkInterval = setInterval(() => {
          if (!globalBrowser || !globalBrowser.isConnected()) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 5000);
        
        // For auto mode, timeout will exit before this resolves
        // For detached/spawned processes, this keeps the process alive
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await cleanup();
    process.exit(1);
  }
}

async function saveRecording() {
  try {
    if (!globalPage) {
      console.log('❌ Page is not available');
      return;
    }
    
    let isPageClosed = false;
    try {
      isPageClosed = await globalPage.isClosed?.() || false;
    } catch (_) {
      isPageClosed = true;
    }
    
    if (isPageClosed) {
      console.log('❌ Page is closed');
      return;
    }

    	console.log('⏳ Retrieving audio data...');
    
    // Flush any remaining incremental chunks before final save
    await flushPendingChunks();
    
    const audioData = await globalPage.evaluate(() => {
      return window.stopAndGetAudio();
    }).catch(err => {
      console.error('❌ Error:', err.message);
      return null;
    });

    if (!audioData || !audioData.audio) {
      console.log('\n❌ No audio recorded!');
      
      const debugInfo = await globalPage.evaluate(() => {
        return {
          hasTrack: window.audioCapture?.trackToRecord !== null, // MODIFIED
          chunks: window.audioCapture?.recordedChunks?.length || 0,
          isRecording: window.audioCapture?.isRecording || false
        };
      }).catch(() => null);
      
      if (debugInfo) {
        console.log('Debug: Track Found:', debugInfo.hasTrack, '| Chunks:', debugInfo.chunks); // MODIFIED
      }
      
      return;
    }

    console.log('✅ Audio retrieved:', (audioData.size / 1024).toFixed(1), 'KB');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
    const webmFilename = `recording_${timestamp}.webm`;
    const webmFilepath = path.join(RECORDINGS_DIR, webmFilename);
    
    console.log('⏳ Saving WebM file...');
    const buffer = Buffer.from(audioData.audio, 'base64');
    fs.writeFileSync(webmFilepath, buffer);
    
    console.log('✅ WebM saved');
    
    // Convert to MP3
    console.log('⏳ Converting to MP3...');
    const mp3Filename = `recording_${timestamp}.mp3`;
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
    console.log('⏱️  Duration: ~', audioData.chunks, 'seconds');
    console.log('\n💡 Play the MP3 file - it works everywhere!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    if (transcriptFilepath) {
      console.log('📝 Transcript path:', path.resolve(transcriptFilepath));
    }

  } catch (error) {
    console.error('\n❌ Save failed:', error.message);
  }
}

// ... [convertToMp3 function is unchanged] ...
function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = ffmpeg.path;
    const command = `"${ffmpegPath}" -i "${inputPath}" -vn -ar 44100 -ac 2 -b:a 192k "${outputPath}" -y`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log('⚠️  FFmpeg conversion failed:', error.message);
        console.log('   WebM file still available');
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

// =========================
// Realtime Transcription Helpers
// =========================

async function startRealtimeTranscription() {
  // Inject a helper to get and clear current chunks without stopping the recorder
  try {
    await withRetry('inject getAndClearChunks', async () => {
      await globalPage.evaluate(() => {
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
          } catch (_) {
            return null;
          }
        };
      });
    });
  } catch (_) {}

  if (chunkFlushInterval) clearInterval(chunkFlushInterval);
  chunkFlushInterval = setInterval(async () => {
    try {
      if (!globalPage || await globalPage.isClosed?.()) return;
      const data = await globalPage.evaluate(() => {
        if (window.getAndClearChunks) return window.getAndClearChunks();
        return null;
      });
      const chunkData = data && data.then ? await data : data;
      if (!chunkData || !chunkData.audio || !chunkData.size) return;

      const ts = Date.now();
      const idx = chunkSequence++;
      const chunkFilename = `chunk_${ts}_${idx}.webm`;
      const chunkPath = path.join(CHUNKS_DIR, chunkFilename);
      fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
      console.log(`\n💾 Chunk saved: ${path.resolve(chunkPath)} (${(chunkData.size/1024).toFixed(1)} KB)`);
      // Convert to MP3 for better compatibility with your player
      const mp3Path = chunkPath.replace(/\.webm$/i, '.mp3');
      try { await convertToMp3(chunkPath, mp3Path); console.log(`🎧 Chunk MP3: ${path.resolve(mp3Path)}`); } catch (_) {}
      const sendPath = fs.existsSync(mp3Path) ? mp3Path : chunkPath;
      // Fire and forget transcription
      transcribeChunk(sendPath).catch(() => {});
    } catch (_) {
      // ignore transient errors
    }
  }, 4000);
}

async function flushPendingChunks() {
  try {
    if (!globalPage || await globalPage.isClosed?.()) return;
    const data = await globalPage.evaluate(() => {
      if (window.getAndClearChunks) return window.getAndClearChunks();
      return null;
    });
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
    const sendPath = fs.existsSync(mp3Path) ? mp3Path : chunkPath;
    await transcribeChunk(sendPath);
  } catch (_) {}
}

function runPythonTranscriber(audioPath) {
  // Prefer streaming persistent process; fallback to one-shot
  return sendToPython(audioPath).catch(() => runPythonOneShot(audioPath));
}

async function transcribeChunk(chunkPath) {
  try {
    const text = await runPythonTranscriber(chunkPath);
    if (text && text.trim()) {
      const line = `[${new Date().toISOString()}] ${text}\n`;
      if (transcriptFilepath) fs.appendFileSync(transcriptFilepath, line);
      process.stdout.write(`\r📝 Transcribed: ${text.substring(0, 80)}${text.length > 80 ? '…' : ''}        \n`);
    }
  } catch (_) {
    // ignore per-chunk transcription errors
  }
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
        // If an error line arrives and no resolver waiting, ignore
        const resolver = pythonResolvers.shift();
        if (resolver) resolver.reject(new Error(data.toString()));
      });
      proc.on('close', () => {
        // Reject all pending
        while (pythonResolvers.length) {
          const r = pythonResolvers.shift();
          r.reject(new Error('Python process closed'));
        }
      });
      started = true;
      break;
    } catch (_) {
      // try next
    }
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
    const pythonCandidates = ['python', 'py'];
    let attempt = 0;
    const tryOne = () => {
      if (attempt >= pythonCandidates.length) return reject(new Error('Python not found'));
      const cmd = pythonCandidates[attempt++];
      const proc = spawn(cmd, [PY_SCRIPT_PATH, audioPath], { shell: process.platform === 'win32' });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('error', () => tryOne());
      proc.on('close', (code) => {
        if (code === 0) return resolve(stdout.trim());
        if (attempt < pythonCandidates.length) return tryOne();
        return reject(new Error(stderr || `Python exited with code ${code}`));
      });
    };
    tryOne();
  });
}

joinGoogleMeet();