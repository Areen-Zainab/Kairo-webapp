// MeetingBot.js - High-level orchestrator for meeting lifecycle
require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const AudioRecorder = require('./AudioRecorder');
const { navigateToMeeting, enterBotName, disableCameraAndMic, clickJoinButton, leaveMeeting } = require('./joinMeeting');

puppeteer.use(StealthPlugin());

// Base directory for all meeting data
const MEETING_DATA_BASE_DIR = path.resolve(__dirname, '../../src/services/meeting_data');
if (!fs.existsSync(MEETING_DATA_BASE_DIR)) {
  fs.mkdirSync(MEETING_DATA_BASE_DIR, { recursive: true });
}

class MeetingBot {
  constructor(config) {
    this.config = config; // { meetUrl, botName, durationMinutes, meetingId, meetingTitle }
    this.browser = null;
    this.page = null;
    this.audioRecorder = null;
    this.meetingDataDir = null;
    this.chunksDir = null;
    this.monitorInterval = null;
    this.autoExitTimeout = null;
    // Expose meetingId for compatibility
    this.meetingId = config.meetingId;
    this.success = false;
  }

  /**
   * Initialize directories and browser
   */
  async initialize() {
    // Create meeting-specific directory structure
    const slugify = (str) => (str || '').toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    
    const meetingTimestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
    const meetingNameSlug = this.config.meetingTitle ? slugify(this.config.meetingTitle) : 'meeting';
    const meetingIdStr = this.config.meetingId ? String(this.config.meetingId) : 'unknown';
    
    // Create directory: {MeetingID}_{MeetingName}_{timestamp}
    const meetingDirName = `${meetingIdStr}_${meetingNameSlug}_${meetingTimestamp}`;
    this.meetingDataDir = path.join(MEETING_DATA_BASE_DIR, meetingDirName);
    this.chunksDir = path.join(this.meetingDataDir, 'chunks');
    
    // Create directories
    if (!fs.existsSync(this.meetingDataDir)) {
      fs.mkdirSync(this.meetingDataDir, { recursive: true });
    }
    if (!fs.existsSync(this.chunksDir)) {
      fs.mkdirSync(this.chunksDir, { recursive: true });
    }

    // Launch browser
    const SHOW_BROWSER = process.env.SHOW_BROWSER === 'true';
    this.browser = await puppeteer.launch({
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

    this.page = await this.browser.newPage();

    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions(this.config.meetUrl, [
      'camera',
      'microphone',
      'notifications'
    ]);

    console.log('\n🚀 Kairo Bot Starting...');
    console.log('📍 URL:', this.config.meetUrl);
    if (this.config.meetingId) {
      console.log('📋 Meeting ID:', this.config.meetingId);
    }
    console.log('📁 Meeting data directory:', path.resolve(this.meetingDataDir));
  }

  /**
   * Join the meeting using pure functions from joinMeeting.js
   */
  async joinMeeting() {
    console.log('\n⏳ Loading meeting...');
    await navigateToMeeting(this.page, this.config.meetUrl);
    console.log('✅ Page loaded');

    console.log('\n⏳ Entering name...');
    await enterBotName(this.page, this.config.botName || process.env.BOT_NAME || 'Kairo Bot');
    console.log('✅ Name entered');

    console.log('\n🔧 Disabling camera and microphone...');
    await disableCameraAndMic(this.page);
    console.log('✅ Camera and mic disabled');

    console.log('\n⏳ Joining meeting...');
    await clickJoinButton(this.page);
    console.log('✅ Join clicked');

    // Wait for meeting to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check recording status
    let recordingStatus = { isRecording: false, hasTrack: false, chunks: 0 };
    try {
      if (this.page && !this.page.isClosed()) {
        recordingStatus = await this.page.evaluate(() => {
          return {
            isRecording: window.audioCapture?.isRecording || false,
            hasTrack: !!(window.audioCapture?.trackToRecord),
            chunks: window.audioCapture?.streamChunks?.length || 0
          };
        });
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
        if (this.page && !this.page.isClosed()) {
          await this.page.evaluate(() => {
            try { window.startAudioRecording(); } catch (e) { console.error(e); }
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error('❌ Error starting recording:', error.message);
      }
    }

    console.log('\n✅ Bot joined successfully!');
    console.log('🎤 Recording meeting audio...');
  }

  /**
   * Setup monitoring interval
   */
  async setupMonitoring() {
    const DURATION_MINUTES = this.config.durationMinutes || 0;
    let lastChunkCount = 0;

    this.monitorInterval = setInterval(async () => {
      try {
        if (!this.page || this.page.isClosed()) {
          clearInterval(this.monitorInterval);
          this.monitorInterval = null;
          return;
        }

        let status;
        try {
          status = await this.page.evaluate(() => ({
            chunks: window.audioCapture?.streamChunks?.length || 0,
            isRecording: window.audioCapture?.isRecording || false
          }));
        } catch (evalError) {
          if (evalError && evalError.message &&
            (evalError.message.includes('Requesting main frame too early') ||
              evalError.message.includes('Page is closed') ||
              this.page.isClosed())) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            return;
          }
          throw evalError;
        }

        if (status.chunks > lastChunkCount) {
          const timeStr = DURATION_MINUTES > 0
            ? `(auto: ~${Math.max(0, DURATION_MINUTES * 60 - status.chunks)}s remaining)`
            : '(running)';
          process.stdout.write(`\r🔴 Recording... ${status.chunks} chunks | ${(status.chunks * 2).toFixed(0)}s  ${timeStr}  `);
          lastChunkCount = status.chunks;
        }
      } catch (e) {
        // Swallow errors
      }
    }, 1000);
  }

  /**
   * Start the bot - initialize, join meeting, start recording
   */
  async start() {
    await this.initialize();

    // Create AudioRecorder instance
    this.audioRecorder = new AudioRecorder(
      this.page,
      this.meetingDataDir,
      this.chunksDir
    );

    // Inject audio capture BEFORE navigating to meeting
    await this.audioRecorder.injectAudioCapture();

    // Join the meeting
    await this.joinMeeting();

    // Start audio recording
    await this.audioRecorder.startRealtimeTranscription();

    // Setup monitoring
    await this.setupMonitoring();

    // Setup auto-exit if duration specified
    if (this.config.durationMinutes > 0) {
      console.log(`\n⏰ Auto mode: Will record for ${this.config.durationMinutes} minutes`);
      this.autoExitTimeout = setTimeout(() => {
        console.log('\n\n⏰ Duration reached, stopping recording...');
        this.stop();
      }, this.config.durationMinutes * 60 * 1000);
    } else {
      console.log('\n💡 Recording in progress. Use stop() method to save recording.\n');
    }

    this.success = true;
    return this;
  }

  /**
   * Stop the bot - stop recording, leave meeting, cleanup
   */
  async stop() {
    console.log('\n\n🛑 Stopping recording...');

    // Clear intervals and timeouts
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    if (this.autoExitTimeout) {
      clearTimeout(this.autoExitTimeout);
      this.autoExitTimeout = null;
    }

    // Stop audio recording and save complete recording
    if (this.audioRecorder) {
      const baseName = (() => {
        const slugify = (str) => (str || '').toString()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 80);
        const titleSlug = slugify(this.config.meetingTitle);
        const idPart = this.config.meetingId ? String(this.config.meetingId) : null;
        if (titleSlug && idPart) return `${titleSlug}_${idPart}`;
        if (idPart) return `meeting_${idPart}`;
        return null;
      })();

      // CRITICAL ORDER:
      // 1. Stop streamRecorder and flush pending chunks
      await this.audioRecorder.stopRecording();
      
      // 2. Get complete recording (this will stop completeRecorder)
      await this.audioRecorder.saveCompleteRecording(baseName);
      
      // 3. Final cleanup (close audio context)
      await this.audioRecorder.finalCleanup();
    }

    // Leave meeting and close browser
    await this.cleanup();
  }

  /**
   * Cleanup - leave meeting, close browser
   */
  async cleanup() {
    // Leave meeting
    try {
      if (this.page && !this.page.isClosed()) {
        console.log('Leaving meeting...');
        await leaveMeeting(this.page);
        // Give a moment for the leave action to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error('❌ Error leaving meeting:', err && err.message ? err.message : err);
    }

    // Close browser
    if (this.browser) {
      try {
        console.log('Closing browser...');
        // Close all pages first
        const pages = await this.browser.pages();
        for (const page of pages) {
          try {
            if (!page.isClosed()) {
              await page.close();
            }
          } catch (e) {
            // Ignore individual page close errors
          }
        }
        // Then close browser
        await this.browser.close();
        console.log('✅ Browser closed');
      } catch (err) {
        console.error('❌ Error closing browser:', err && err.message ? err.message : err);
        // Force close if normal close fails
        try {
          if (this.browser.process()) {
            this.browser.process().kill('SIGKILL');
          }
        } catch (killErr) {
          // Ignore
        }
      }
    }
  }
}

module.exports = MeetingBot;

