const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');

// =========================
// CONFIG
// =========================
const MEET_URL = process.env.MEET_URL;
const BOT_NAME = process.env.BOT_NAME || 'Kairo Bot';
const RECORDINGS_DIR = path.resolve(process.env.RECORDINGS_DIR || './recordings');
const CHUNKS_DIR = path.resolve(process.env.CHUNKS_DIR || './chunks');
const USER_DATA_DIR = process.env.USER_DATA_DIR;
const AUTO_MODE = !!process.env.AUTO_MODE;
const DURATION_MINUTES = parseInt(process.env.DURATION_MINUTES || '30');

// Adjust this path to where your Python WhisperX script is located
const PY_SCRIPT_PATH = path.resolve(__dirname, '../../../ai-layer/transcribe-whisper.py');

let globalBrowser, globalPage, transcriptFilepath;
let monitorInterval, autoExitTimeout, chunkFlushInterval, chunkSequence = 0;
let isFinalizing = false;

fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
fs.mkdirSync(CHUNKS_DIR, { recursive: true });

// =========================
// UTILS
// =========================
const sleep = ms => new Promise(res => setTimeout(res, ms));

async function withRetry(desc, fn, attempts = 3, delay = 1000) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) { if (i === attempts - 1) throw e; await sleep(delay); }
  }
}

// =========================
// JOIN MEET
// =========================
async function joinGoogleMeet() {
  try {
    globalBrowser = await puppeteer.launch({
      headless: false,
      args: ['--use-fake-ui-for-media-stream', '--no-sandbox'],
      userDataDir: USER_DATA_DIR
    });
    globalPage = await globalBrowser.newPage();

    console.log('⏳ Loading meeting...');
    let navSuccess = false;
    for (let navAttempts = 0; navAttempts < 3; navAttempts++) {
      try {
        await globalPage.goto(MEET_URL, { waitUntil: 'load', timeout: 120000 });
        try { await globalPage.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 }); } catch (_) { }
        navSuccess = true;
        await sleep(1500);
        console.log('✅ Page loaded');
        break;
      } catch (err) {
        console.error('❌ Navigation error:', err.message);
        await sleep(3000);
      }
    }
    if (!navSuccess) { console.error('❌ Could not load page'); process.exit(2); }

    // Dismiss cookies/consent
    try {
      await withRetry('dismiss cookie', async () => {
        await globalPage.evaluate(() => {
          const clickByText = txts => {
            for (const el of document.querySelectorAll('button, div[role="button"], span')) {
              const t = (el.textContent || '').toLowerCase();
              if (txts.some(s => t.includes(s))) { el.click(); return true; }
            }
            return false;
          };
          clickByText(['accept all', 'i agree', 'got it', 'allow all']);
        });
      }, 2, 1000);
    } catch (_) { }

    // Enter bot name
    console.log('⏳ Entering name...');
    await withRetry('enter name', async () => {
      await globalPage.evaluate(name => {
        const tryFill = () => {
          const inputs = Array.from(document.querySelectorAll('input'));
          for (const input of inputs) {
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

    await sleep(2000);
    // Disable cam/mic
    await withRetry('disable cam/mic', async () => {
      try { await globalPage.keyboard.down('Control'); await globalPage.keyboard.press('KeyD'); await globalPage.keyboard.up('Control'); } catch (_) { }
      await sleep(500);
      try { await globalPage.keyboard.down('Control'); await globalPage.keyboard.press('KeyE'); await globalPage.keyboard.up('Control'); } catch (_) { }
      await globalPage.evaluate(() => {
        document.querySelectorAll('button, div[role="button"][aria-label]').forEach(btn => {
          const label = (btn.getAttribute('aria-label') || '').toLowerCase();
          if (label.includes('camera')) btn.click();
          if (label.includes('microphone')) btn.click();
        });
      });
    });

    await sleep(2000);
    // Click Join
    await withRetry('click join', async () => {
      await globalPage.evaluate(() => {
        const tryClickByText = substrs => {
          for (const btn of document.querySelectorAll('button, div[role="button"]')) {
            const txt = (btn.textContent || '').toLowerCase();
            if (substrs.some(s => txt.includes(s))) { btn.click(); return true; }
          }
          return false;
        };
        tryClickByText(['join now', 'ask to join', 'continue', 'join', 'continue without']);
      });
    });

    await sleep(5000);
    console.log('✅ Bot joined! Recording audio...');

    // Setup transcript
    const transcriptTimestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
    transcriptFilepath = path.join(RECORDINGS_DIR, `transcript_${transcriptTimestamp}.txt`);
    fs.writeFileSync(transcriptFilepath, `Kairo Transcript (${new Date().toISOString()})\n\n`);

    await startRealtimeTranscription();

    // Auto exit if enabled
    if (AUTO_MODE) {
      autoExitTimeout = setTimeout(async () => {
        console.log('⏰ Auto duration reached. Stopping...');
        await saveRecording();
        await cleanup();
        process.exit(0);
      }, DURATION_MINUTES * 60 * 1000);
    }

    // Monitor meeting end
    let lastChunkCount = 0, lastChunkTime = Date.now();
    monitorInterval = setInterval(async () => {
      try {
        const status = await globalPage.evaluate(() => ({
          chunks: window.audioCapture?.recordedChunks?.length || 0,
          isRecording: window.audioCapture?.isRecording || false,
          bodyText: (document.body?.innerText || '').toLowerCase()
        }));
        if (status.chunks > lastChunkCount) { lastChunkCount = status.chunks; lastChunkTime = Date.now(); }
        const idleTooLong = Date.now() - lastChunkTime > 90000;
        const endedText = status.bodyText.includes('meeting has ended') || status.bodyText.includes('you left the meeting');
        if (!isFinalizing && (idleTooLong || endedText)) {
          isFinalizing = true;
          console.log('🛑 Meeting ended, finalizing...');
          await saveRecording();
          await cleanup();
          process.exit(0);
        }
      } catch (_) { }
    }, 1000);

    process.on('SIGINT', () => handleExit('SIGINT'));
    process.on('SIGTERM', () => handleExit('SIGTERM'));

  } catch (error) {
    console.error('❌ Error:', error.message);
    await cleanup();
    process.exit(1);
  }
}

// =========================
// RECORDING & CHUNKS
// =========================
async function saveRecording() {
  if (!globalPage) return;
  try {
    await flushPendingChunks();
    const audioData = await globalPage.evaluate(() => window.stopAndGetAudio()).catch(() => null);
    if (!audioData?.audio) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
    const webmFile = path.join(RECORDINGS_DIR, `recording_${timestamp}.webm`);
    fs.writeFileSync(webmFile, Buffer.from(audioData.audio, 'base64'));
    const mp3File = webmFile.replace(/.webm$/i, '.mp3');
    await convertToMp3(webmFile, mp3File);
  } catch (e) { console.error('❌ Save failed:', e.message); }
}

async function startRealtimeTranscription() {
  await withRetry('inject getAndClearChunks', async () => {
    await globalPage.evaluate(() => {
      if (!window.audioCapture || window.getAndClearChunks) return;
      window.getAndClearChunks = function () {
        const chunks = window.audioCapture.recordedChunks || [];
        if (!chunks.length) return null;
        const current = chunks.splice(0, chunks.length);
        const blob = new Blob(current, { type: 'audio/webm' });
        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ audio: reader.result.split(',')[1], size: blob.size, chunks: current.length });
          reader.readAsDataURL(blob);
        });
      };
    });
  });

  if (chunkFlushInterval) clearInterval(chunkFlushInterval);
  chunkFlushInterval = setInterval(async () => {
    const data = await globalPage.evaluate(() => window.getAndClearChunks && window.getAndClearChunks());
    const chunkData = data && data.then ? await data : data;
    if (!chunkData?.audio) return;
    const ts = Date.now();
    const idx = chunkSequence++;
    const chunkPath = path.join(CHUNKS_DIR, `chunk_${ts}_${idx}.webm`);
    fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
    const mp3Path = chunkPath.replace(/.webm$/i, '.mp3');
    await convertToMp3(chunkPath, mp3Path);
    await transcribeChunk(fs.existsSync(mp3Path) ? mp3Path : chunkPath);
  }, 4000);
}

async function flushPendingChunks() {
  if (!globalPage) return;
  const data = await globalPage.evaluate(() => window.getAndClearChunks && window.getAndClearChunks());
  const chunkData = data && data.then ? await data : data;
  if (!chunkData?.audio) return;
  const ts = Date.now();
  const idx = chunkSequence++;
  const chunkPath = path.join(CHUNKS_DIR, `chunk_${ts}_${idx}.webm`);
  fs.writeFileSync(chunkPath, Buffer.from(chunkData.audio, 'base64'));
  const mp3Path = chunkPath.replace(/.webm$/i, '.mp3');
  await convertToMp3(chunkPath, mp3Path);
  await transcribeChunk(fs.existsSync(mp3Path) ? mp3Path : chunkPath);
}

function convertToMp3(inputPath, outputPath) {
  return new Promise(resolve => {
    const cmd = `"${ffmpeg}" -i "${inputPath}" -vn -ar 44100 -ac 2 -b:a 192k "${outputPath}" -y`;
    exec(cmd, () => { resolve(); });
  });
}

// =========================
// TRANSCRIPTION
// =========================
async function transcribeChunk(chunkPath) {
  try {
    const text = await runPythonTranscriber(chunkPath);
    if (text?.trim()) {
      fs.appendFileSync(transcriptFilepath, `[${new Date().toISOString()}] ${text}\n`);
      process.stdout.write(`📝 Transcribed: ${text.substring(0, 80)}\n`);
    }
  } catch (err) {
    console.error('❌ Transcription error:', err.message);
  }
}

function runPythonTranscriber(audioPath) {
  return new Promise((resolve, reject) => {
    const py = spawn('py', ['-3.10', PY_SCRIPT_PATH, audioPath], { shell: true });
    let output = '';
    let errorOutput = '';

    py.stdout.on('data', data => output += data.toString());
    py.stderr.on('data', data => errorOutput += data.toString());

    py.on('close', code => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(errorOutput || `Python exited with code ${code}`));
    });
  });
}

// =========================
// CLEANUP
// =========================
async function cleanup() {
  clearInterval(monitorInterval);
  clearInterval(chunkFlushInterval);
  if (globalBrowser) await globalBrowser.close().catch(() => { });
}

async function handleExit(signal) {
  console.log(`Received ${signal}, stopping...`);
  await saveRecording();
  await cleanup();
  process.exit(0);
}

// =========================
// START
// =========================
joinGoogleMeet();
