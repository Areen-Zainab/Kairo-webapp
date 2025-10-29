// bot-join.js - FIXED FOR WINDOWS
require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');

puppeteer.use(StealthPlugin());

const MEET_URL = process.env.MEET_URL || 'https://meet.google.com/hpr-rjtn-koe';
const BOT_NAME = process.env.BOT_NAME || 'Kairo Bot';
const SHOW_BROWSER = process.env.SHOW_BROWSER === 'true';

const RECORDINGS_DIR = path.join(__dirname, 'recordings');
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

console.log('📁 Recordings folder:', path.resolve(RECORDINGS_DIR));

let globalPage = null;
let globalBrowser = null;

// Setup readline interface for Windows
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function joinGoogleMeet() {
  console.log('\n🚀 Kairo Bot Starting...');
  console.log('📍 URL:', MEET_URL);
  
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
    
    await globalPage.waitForTimeout(5000);
    console.log('✅ Page loaded');

    // ... [Code for entering name, disabling mic/cam, joining meeting is unchanged] ...
    
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
    
    await globalPage.waitForTimeout(2000);

    // Turn OFF camera and microphone
    console.log('\n🔧 Disabling camera and microphone...');
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
    
    await globalPage.waitForTimeout(2000);
    console.log('✅ Camera and mic disabled');

    // Click "Join now"
    console.log('\n⏳ Joining meeting...');
    await globalPage.evaluate(() => {
      const buttons = document.querySelectorAll('button, div[role="button"]');
      buttons.forEach(btn => {
        const text = (btn.textContent || '').toLowerCase();
        if (text.includes('join now') || text.includes('ask to join')) {
          btn.click();
        }
      });
    });
    
    await globalPage.waitForTimeout(8000);
    console.log('✅ Join clicked');

    await globalPage.waitForTimeout(5000);

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
      await globalPage.waitForTimeout(2000);
    }

    console.log('\n✅ Bot joined successfully!');
    console.log('🎤 Recording meeting audio...');
    console.log('\n💡 TYPE "stop" OR "save" AND PRESS ENTER TO SAVE RECORDING\n');

    // ... [Code for monitoring, readline, and SIGINT is unchanged] ...

    // Monitor recording
    let lastChunkCount = 0;
    const monitor = setInterval(async () => {
      try {
        const status = await globalPage.evaluate(() => ({
          chunks: window.audioCapture?.recordedChunks?.length || 0,
          isRecording: window.audioCapture?.isRecording || false
        }));
        
        if (status.chunks > lastChunkCount) {
          process.stdout.write(`\r🔴 Recording... ${status.chunks} chunks | ${(status.chunks * 1).toFixed(0)}s  (type "stop" to save)  `);
          lastChunkCount = status.chunks;
        }
      } catch (e) {
        // Ignore
      }
    }, 1000);

    // Listen for user input
    rl.on('line', async (input) => {
      const cmd = input.toLowerCase().trim();
      if (cmd === 'stop' || cmd === 'save' || cmd === 'exit' || cmd === 'quit') {
        console.log('\n\n🛑 Stopping recording...');
        clearInterval(monitor);
        rl.close();
        await saveRecording();
        if (globalBrowser) await globalBrowser.close();
        process.exit(0);
      }
    });

    // Also handle Ctrl+C (though it may not work on Windows batch)
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Stopping recording...');
      clearInterval(monitor);
      rl.close();
      await saveRecording();
      if (globalBrowser) await globalBrowser.close();
      process.exit(0);
    });

    // Keep running
    await new Promise(() => {});

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (globalBrowser) await globalBrowser.close();
    process.exit(1);
  }
}

async function saveRecording() {
  try {
    if (!globalPage || globalPage.isClosed()) {
      console.log('❌ Page is closed');
      return;
    }

    console.log('⏳ Retrieving audio data...');
    
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

joinGoogleMeet();