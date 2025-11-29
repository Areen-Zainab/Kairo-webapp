// joinMeeting.js - FIXED FOR WINDOWS - INTEGRATED AS MODULE
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

const PY_SCRIPT_PATH = path.resolve(__dirname, '../../../ai-layer/whisperX/transcribe-whisper.py');


console.log('📁 Recordings folder:', path.resolve(RECORDINGS_DIR));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert WebM to MP3
 */
function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Input file not found: ${inputPath}`);
      return resolve(false);
    }
    const ffmpegPath = ffmpeg.path;
    // Using exec is fine but ensure quoting; keep same behavior
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

/**
 * Concatenate all chunk MP3s into one final MP3
 */
function concatenateChunksToMp3(baseName) {
  return new Promise((resolve, reject) => {
    try {
      // Get all chunk MP3 files sorted by name
      const chunkFiles = fs.readdirSync(CHUNKS_DIR)
        .filter(f => f.startsWith('chunk_') && f.endsWith('.mp3'))
        .sort((a, b) => {
          const aMatch = a.match(/chunk_(\d+)_(\d+)\.mp3/);
          const bMatch = b.match(/chunk_(\d+)_(\d+)\.mp3/);
          if (!aMatch || !bMatch) return 0;
          const aTime = parseInt(aMatch[1]);
          const bTime = parseInt(bMatch[1]);
          const aSeq = parseInt(aMatch[2]);
          const bSeq = parseInt(bMatch[2]);
          return aTime !== bTime ? aTime - bTime : aSeq - bSeq;
        });

      if (chunkFiles.length === 0) {
        console.log('⚠️  No chunk MP3 files found to concatenate');
        return resolve(null);
      }

      console.log(`\n🔗 Concatenating ${chunkFiles.length} chunks into final MP3...`);

      const concatFilePath = path.join(CHUNKS_DIR, 'concat_list.txt');
      const concatContent = chunkFiles
        .map(f => `file '${path.join(CHUNKS_DIR, f).replace(/\\/g, '/')}'`)
        .join('\n');

      fs.writeFileSync(concatFilePath, concatContent);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
      const outputFilename = baseName ? `${baseName}_complete.mp3` : `recording_complete_${timestamp}.mp3`;
      const outputPath = path.join(RECORDINGS_DIR, outputFilename);

      const ffmpegPath = ffmpeg.path;
      const command = `"${ffmpegPath}" -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputPath}" -y`;

      exec(command, (error, stdout, stderr) => {
        try { fs.unlinkSync(concatFilePath); } catch (_) { }

        if (error) {
          console.log('⚠️  FFmpeg concatenation failed:', error.message);
          return resolve(null);
        }

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          const stats = fs.statSync(outputPath);
          console.log(`\n✅ COMPLETE RECORDING CREATED!`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📁 Complete MP3:', outputFilename);
          console.log('📂 Path:', path.resolve(outputPath));
          console.log('📊 Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
          console.log('🎵 Chunks merged:', chunkFiles.length);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          resolve(outputPath);
        } else {
          console.log('⚠️  Complete MP3 file not created');
          resolve(null);
        }
      });
    } catch (error) {
      console.error('❌ Error concatenating chunks:', error.message);
      resolve(null);
    }
  });
}

function ensurePythonProc() {
  if (pythonProc && !pythonProc.killed) return;
  const candidates = ['py -3.10', 'python3.10', 'python', 'py'];
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
    } catch (_) { }
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

function transcribeChunk(chunkPath) {
  return sendToPython(chunkPath).catch(() => runPythonOneShot(chunkPath)).then((text) => {
    if (text && text.trim()) {
      const line = `[${new Date().toISOString()}] ${text}\n`;
      if (transcriptFilepath) fs.appendFileSync(transcriptFilepath, line);
      process.stdout.write(`\n📝 Transcribed: ${text.substring(0, 100)}${text.length > 100 ? '…' : ''}\n`);
    }
  }).catch((e) => {
    // If transcription fails, log but don't crash
    console.error('⚠️ Transcription failed for', chunkPath, e && e.message ? e.message : e);
  });
}

/**
 * Inject chunk getter helper directly at page creation (more robust)
 * NOTE: This is intentionally part of evaluateOnNewDocument in joinMeeting below.
 */
async function injectChunkGetter(page) {
  // keep this for compatibility; in the fixed injection getAndClearChunks already exists
  await page.evaluate(() => {
    // no-op if already present
    if (window.getAndClearChunks) return;
    if (!window.audioCapture) {
      window.audioCapture = {
        recordedChunks: [],
        lastProcessedIndex: 0
      };
    } else {
      window.audioCapture.lastProcessedIndex = window.audioCapture.lastProcessedIndex || 0;
      window.audioCapture.recordedChunks = window.audioCapture.recordedChunks || [];
    }

    window.getAndClearChunks = function () {
      return new Promise((resolve) => {
        try {
          const last = window.audioCapture.lastProcessedIndex || 0;
          const all = window.audioCapture.recordedChunks || [];
          if (last >= all.length) return resolve(null);
          const slice = all.slice(last);
          window.audioCapture.lastProcessedIndex = all.length;
          const blob = new Blob(slice, { type: 'audio/webm;codecs=opus' });
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              audio: reader.result.split(',')[1],
              size: blob.size,
              chunks: slice.length,
              totalChunks: all.length,
              ts: Date.now()
            });
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        } catch (err) {
          resolve(null);
        }
      });
    };
  });
}

async function startRealtimeTranscription(page) {
  try {
    // This will define getAndClearChunks if not present (defensive)
    await injectChunkGetter(page);
  } catch (e) {
    // ignore
  }

  if (chunkFlushInterval) clearInterval(chunkFlushInterval);
  chunkFlushInterval = setInterval(async () => {
    try {
      if (!page || page.isClosed()) return;
      // evaluate may return a Promise or the final object
      const res = await page.evaluate(() => {
        try {
          // getAndClearChunks returns a Promise in the page
          return window.getAndClearChunks ? window.getAndClearChunks() : null;
        } catch (e) {
          return null;
        }
      }).catch(() => null);

      // If page returned a Promise shape, await it (some versions return a promise wrapper)
      const chunkData = res && res.then ? await res : res;

      if (!chunkData || !chunkData.audio || !chunkData.size) return;

      const ts = chunkData.ts || Date.now();
      const idx = chunkSequence++;
      const chunkFilename = `chunk_${ts}_${idx}.webm`;
      const chunkPath = path.join(CHUNKS_DIR, chunkFilename);
      // write Base64 to file
      fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
      console.log(`\n💾 Chunk saved: ${path.resolve(chunkPath)} (${(chunkData.size / 1024).toFixed(1)} KB)`);

      const mp3Path = chunkPath.replace(/\.webm$/i, '.mp3');
      try {
        const ok = await convertToMp3(chunkPath, mp3Path);
        if (ok) console.log(`🎧 Chunk MP3: ${path.resolve(mp3Path)}`);
      } catch (e) {
        console.warn('⚠️ convertToMp3 failed for chunk', e && e.message ? e.message : e);
      }

      // send to whisper (mp3 preferred)
      await transcribeChunk(fs.existsSync(mp3Path) ? mp3Path : chunkPath);
    } catch (err) {
      // don't crash the interval
      // log minimal info
      // console.error('⚠️ Realtime chunk loop error:', err.message || err);
    }
  }, 1000);
}

async function flushPendingChunks(page) {
  try {
    if (!page || page.isClosed()) return;
    // try to get any remaining chunks
    const res = await page.evaluate(() => {
      try {
        return window.getAndClearChunks ? window.getAndClearChunks() : null;
      } catch (e) { return null; }
    }).catch(() => null);
    const chunkData = res && res.then ? await res : res;
    if (!chunkData || !chunkData.audio || !chunkData.size) return;
    const ts = chunkData.ts || Date.now();
    const idx = chunkSequence++;
    const chunkFilename = `chunk_${ts}_${idx}.webm`;
    const chunkPath = path.join(CHUNKS_DIR, chunkFilename);
    fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
    console.log(`\n💾 Final chunk saved: ${path.resolve(chunkPath)} (${(chunkData.size / 1024).toFixed(1)} KB)`);
    const mp3Path = chunkPath.replace(/\.webm$/i, '.mp3');
    try { await convertToMp3(chunkPath, mp3Path); console.log(`🎧 Final chunk MP3: ${path.resolve(mp3Path)}`); } catch (_) { }
    await transcribeChunk(fs.existsSync(mp3Path) ? mp3Path : chunkPath);
  } catch (err) {
    // ignore flush errors
  }
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
      try {
        return window.stopAndGetAudio ? window.stopAndGetAudio() : null;
      } catch (e) {
        return null;
      }
    }).catch(err => {
      console.error('❌ Error:', err && err.message ? err.message : err);
      return null;
    });

    if (!audioData || !audioData.audio) {
      console.log('\n❌ No audio recorded!');

      const debugInfo = await page.evaluate(() => {
        return {
          hasTrack: !!(window.audioCapture && window.audioCapture.trackToRecord),
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

    // Create complete recording from all chunks
    console.log('🔗 Creating complete recording from all chunks...');
    await concatenateChunksToMp3(baseName);

    return {
      mp3Path: mp3Filepath,
      webmPath: webmFilepath,
      size: audioData.size,
      chunks: audioData.chunks
    };
  } catch (error) {
    console.error('\n❌ Save failed:', error && error.message ? error.message : error);
    return null;
  }
}

/**
 * Join a Google Meet meeting
 * 
 * @param {Object} options - Meeting options
 */
async function joinMeeting({ meetUrl, botName, durationMinutes, meetingId, meetingTitle }) {
  const MEET_URL = meetUrl;
  const BOT_NAME = botName || process.env.BOT_NAME || 'Kairo Bot';
  const SHOW_BROWSER = process.env.SHOW_BROWSER === 'true';
  const DURATION_MINUTES = durationMinutes || 0;

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

    const context = globalBrowser.defaultBrowserContext();
    await context.overridePermissions(MEET_URL, [
      'camera',
      'microphone',
      'notifications'
    ]);

    // =================================================================
    // FIXED AUDIO INJECTION - Records complete audio and provides chunk getter
    // =================================================================
    await globalPage.evaluateOnNewDocument(() => {
      // core state
      window.audioCapture = {
        audioContext: null,
        mediaRecorder: null,
        recordedChunks: [],
        isRecording: false,
        trackToRecord: null,
        lastProcessedIndex: 0
      };

      // expose getAndClearChunks so the Node side can retrieve playable blobs
      window.getAndClearChunks = function () {
        return new Promise((resolve) => {
          try {
            const last = window.audioCapture.lastProcessedIndex || 0;
            const all = window.audioCapture.recordedChunks || [];
            if (last >= all.length) return resolve(null);
            const current = all.slice(last);
            window.audioCapture.lastProcessedIndex = all.length;

            const blob = new Blob(current, { type: 'audio/webm;codecs=opus' });
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                audio: reader.result.split(',')[1],
                size: blob.size,
                chunks: current.length,
                totalChunks: all.length,
                ts: Date.now()
              });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          } catch (e) {
            resolve(null);
          }
        });
      };

      // utility to safely resume audio context
      async function resumeAudioContextIfNeeded(ctx) {
        try {
          if (!ctx) return;
          if (typeof ctx.state !== 'undefined' && ctx.state === 'suspended') {
            await ctx.resume().catch(() => { });
          }
        } catch (e) { }
      }

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

            // assign track and attempt to start recording
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
            // create stream from the remote track
            const stream = new MediaStream([window.audioCapture.trackToRecord]);
            const audioSource = window.audioCapture.audioContext.createMediaStreamSource(stream);
            audioSource.connect(dest);
            // store dest.stream if needed later
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
            window.audioCapture.mediaRecorder = new MediaRecorder(window.audioCapture._destStream, {
              mimeType: mimeType,
              audioBitsPerSecond: 128000
            });
          } catch (err) {
            console.error('[KAIRO] ❌ MediaRecorder creation failed:', err);
            return;
          }

          window.audioCapture.mediaRecorder.ondataavailable = (event) => {
            try {
              if (event.data && event.data.size > 0) {
                window.audioCapture.recordedChunks.push(event.data);
              }
            } catch (e) { }
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

          // chunk every 1s to keep files small and transcribable
          try {
            window.audioCapture.mediaRecorder.start(1000);
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
            if (!window.audioCapture.mediaRecorder || window.audioCapture.recordedChunks.length === 0) {
              console.log('[KAIRO] No recording to save');
              resolve(null);
              return;
            }

            const currentChunks = [...window.audioCapture.recordedChunks];

            const processChunks = () => {
              try {
                const blob = new Blob(currentChunks, { type: 'audio/webm;codecs=opus' });
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
              } catch (e) {
                resolve(null);
              }
            };

            if (window.audioCapture.mediaRecorder && window.audioCapture.mediaRecorder.state !== 'inactive') {
              window.audioCapture.mediaRecorder.onstop = processChunks;
              try { window.audioCapture.mediaRecorder.stop(); } catch (_) { }
              if (window.audioCapture.audioContext) {
                try { window.audioCapture.audioContext.close(); } catch (_) { }
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
    // END OF AUDIO INJECTION
    // =================================================================

    console.log('✅ Audio capture system injected');

    console.log('\n⏳ Loading meeting...');
    await globalPage.goto(MEET_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await sleep(5000);
    console.log('✅ Page loaded');

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

    console.log('\n🔧 Disabling camera and microphone...');
    try {
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
    }

    console.log('\n⏳ Joining meeting...');
    try {
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
      throw error;
    }

    await sleep(5000);

    let recordingStatus = { isRecording: false, hasTrack: false, chunks: 0 };
    try {
      if (globalPage && !globalPage.isClosed()) {
        recordingStatus = await globalPage.evaluate(() => {
          return {
            isRecording: window.audioCapture?.isRecording || false,
            hasTrack: !!(window.audioCapture?.trackToRecord),
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
          await globalPage.evaluate(() => {
            try { window.startAudioRecording(); } catch (e) { console.error(e); }
          });
          await sleep(2000);
        }
      } catch (error) {
        console.error('❌ Error starting recording:', error.message);
      }
    }

    console.log('\n✅ Bot joined successfully!');
    console.log('🎤 Recording meeting audio...');

    const transcriptTimestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
    const transcriptFilename = `transcript_${transcriptTimestamp}.txt`;
    transcriptFilepath = path.join(RECORDINGS_DIR, transcriptFilename);
    try { fs.writeFileSync(transcriptFilepath, `Kairo Transcript (${new Date().toISOString()})\n\n`); } catch (_) { }
    console.log('📝 Live transcript file:', path.resolve(transcriptFilepath));
    await startRealtimeTranscription(globalPage);

    if (DURATION_MINUTES > 0) {
      console.log(`\n⏰ Auto mode: Will record for ${DURATION_MINUTES} minutes`);
      autoExitTimeout = setTimeout(async () => {
        console.log('\n\n⏰ Duration reached, stopping recording...');
        await flushPendingChunks(globalPage);
        await saveRecording(globalPage, baseName);
        if (globalBrowser) await globalBrowser.close();
      }, DURATION_MINUTES * 60 * 1000);
    } else {
      console.log('\n💡 Recording in progress. Use stop() method to save recording.\n');
    }

    let lastChunkCount = 0;
    monitorInterval = setInterval(async () => {
      try {
        if (!globalPage || globalPage.isClosed()) {
          clearInterval(monitorInterval);
          monitorInterval = null;
          return;
        }

        let status;
        try {
          status = await globalPage.evaluate(() => ({
            chunks: window.audioCapture?.recordedChunks?.length || 0,
            isRecording: window.audioCapture?.isRecording || false
          }));
        } catch (evalError) {
          if (evalError && evalError.message &&
            (evalError.message.includes('Requesting main frame too early') ||
              evalError.message.includes('Page is closed') ||
              globalPage.isClosed())) {
            clearInterval(monitorInterval);
            monitorInterval = null;
            return;
          }
          throw evalError;
        }

        if (status.chunks > lastChunkCount) {
          const timeStr = DURATION_MINUTES > 0
            ? `(auto: ~${Math.max(0, DURATION_MINUTES * 60 - status.chunks)}s remaining)`
            : '(running)';
          process.stdout.write(`\r🔴 Recording... ${status.chunks} chunks | ${(status.chunks * 1).toFixed(0)}s  ${timeStr}  `);
          lastChunkCount = status.chunks;
        }
      } catch (e) {
        // swallow
      }
    }, 1000);

    return {
      success: true,
      meetingId: meetingId,
      page: globalPage,
      browser: globalBrowser,
      stop: async () => {
        console.log('\n\n🛑 Stopping recording...');

        // Stop intervals first
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

        // Flush and save BEFORE closing browser
        try {
          if (globalPage && !globalPage.isClosed?.()) {
            await flushPendingChunks(globalPage);
            await saveRecording(globalPage, baseName);
          } else {
            console.log('⚠️ Page already closed, creating complete recording from chunks...');
            await concatenateChunksToMp3(baseName);
          }
        } catch (err) {
          console.error('❌ Error saving recording:', err && err.message ? err.message : err);
          try {
            await concatenateChunksToMp3(baseName);
          } catch (_) { }
        }

        // Now close browser
        if (globalBrowser) {
          try {
            console.log('Closing browser...');
            await globalBrowser.close();
            console.log('✅ Browser closed');
          } catch (err) {
            console.error('❌ Error closing browser:', err && err.message ? err.message : err);
          }
        }

        // Kill Python process
        try {
          if (pythonProc && !pythonProc.killed) {
            pythonProc.stdin?.write('EXIT\n');
            pythonProc.kill();
          }
        } catch (err) {
          console.error('❌ Error killing Python process:', err && err.message ? err.message : err);
        }
      }
    };

  } catch (error) {
    console.error('\n❌ Error:', error && error.message ? error.message : error);

    if (monitorInterval) {
      clearInterval(monitorInterval);
    }
    if (autoExitTimeout) {
      clearTimeout(autoExitTimeout);
    }
    if (chunkFlushInterval) {
      clearInterval(chunkFlushInterval);
    }

    try {
      await flushPendingChunks(globalPage);
      await saveRecording(globalPage, baseName);
    } catch (_) {
      try { await concatenateChunksToMp3(baseName); } catch (_) { }
    }

    if (globalBrowser) {
      await globalBrowser.close();
    }

    throw error;
  }
}

module.exports = { joinMeeting, saveRecording };
