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
    console.log('\n\n🛑 [MeetingBot.stop] Starting stop process...');
    console.log(`   Meeting ID: ${this.config.meetingId}`);
    console.log(`   Has audioRecorder: ${!!this.audioRecorder}`);
    console.log(`   Has page: ${!!this.page}`);
    console.log(`   Has browser: ${!!this.browser}`);

    try {
      // Clear intervals and timeouts
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = null;
        console.log('   ✅ Cleared monitorInterval');
      }
      if (this.autoExitTimeout) {
        clearTimeout(this.autoExitTimeout);
        this.autoExitTimeout = null;
        console.log('   ✅ Cleared autoExitTimeout');
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

        console.log(`\n📹 [MeetingBot.stop] Step 1: Stopping streamRecorder and flushing chunks...`);
        // CRITICAL ORDER:
        // 1. Stop streamRecorder and flush pending chunks
        await this.audioRecorder.stopRecording();
        console.log(`   ✅ Step 1 complete: stopRecording() finished`);
        
        console.log(`\n💾 [MeetingBot.stop] Step 2: Saving complete recording...`);
        // 2. Get complete recording (this will stop completeRecorder)
        // Add timeout wrapper to ensure we don't hang forever
        const savePromise = this.audioRecorder.saveCompleteRecording(baseName);
        const saveTimeout = new Promise((resolve) => {
          setTimeout(() => {
            console.error(`   ⏰ [MeetingBot.stop] saveCompleteRecording() timed out after 35 seconds, proceeding anyway...`);
            resolve(null);
          }, 35000); // 35 second timeout (5s more than the internal timeout)
        });
        
        const saveResult = await Promise.race([savePromise, saveTimeout]);
        console.log(`   ✅ Step 2 complete: saveCompleteRecording() finished`);
        console.log(`   Save result: ${saveResult ? 'success' : 'no recording saved or timed out'}`);
        
        // Finalize transcription with complete audio file if available
        if (this.audioRecorder.transcriptionService && saveResult?.mp3Path) {
          try {
            console.log(`\n🎭 [MeetingBot.stop] Finalizing transcription with diarization...`);
            await this.audioRecorder.transcriptionService.finalize(saveResult.mp3Path);
            console.log(`   ✅ Transcription finalization complete`);
          } catch (error) {
            console.error(`   ⚠️  Transcription finalization failed: ${error.message}`);
          }
        }
        
        console.log(`\n🧹 [MeetingBot.stop] Step 3: Final audio cleanup...`);
        // 3. Final cleanup (close audio context)
        await this.audioRecorder.finalCleanup();
        console.log(`   ✅ Step 3 complete: finalCleanup() finished`);
      } else {
        console.log('   ⚠️ No audioRecorder to stop');
      }

      console.log(`\n🚪 [MeetingBot.stop] Step 4: Leaving meeting and closing browser...`);
      // Leave meeting and close browser
      await this.cleanup();
      console.log(`\n✅ [MeetingBot.stop] Stop process completed successfully!`);
    } catch (error) {
      console.error(`\n❌ [MeetingBot.stop] Error during stop process:`, error);
      console.error(`   Error stack:`, error.stack);
      // Still try to cleanup even if there was an error
      try {
        console.log(`\n🔄 [MeetingBot.stop] Attempting cleanup after error...`);
        await this.cleanup();
      } catch (cleanupError) {
        console.error(`❌ [MeetingBot.stop] Cleanup also failed:`, cleanupError);
      }
      throw error; // Re-throw to let caller know it failed
    }
  }

  /**
   * Cleanup - leave meeting, close browser
   */
  async cleanup() {
    console.log(`\n🧹 [MeetingBot.cleanup] Starting cleanup...`);
    console.log(`   Page exists: ${!!this.page}`);
    console.log(`   Page closed: ${this.page ? this.page.isClosed() : 'N/A'}`);
    console.log(`   Browser exists: ${!!this.browser}`);

    // Leave meeting
    try {
      if (this.page && !this.page.isClosed()) {
        console.log(`\n🚪 [MeetingBot.cleanup] Step 1: Leaving meeting...`);
        await leaveMeeting(this.page);
        // Give a moment for the leave action to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`   ✅ Step 1 complete: Left meeting`);
      } else {
        console.log(`   ⚠️ Skipping leave meeting - page is ${!this.page ? 'null' : 'closed'}`);
      }
    } catch (err) {
      console.error(`❌ [MeetingBot.cleanup] Error leaving meeting:`, err && err.message ? err.message : err);
      console.error(`   Error stack:`, err.stack);
    }

    // Close browser
    if (this.browser) {
      try {
        console.log(`\n🔒 [MeetingBot.cleanup] Step 2: Closing browser...`);
        // Close all pages first
        const pages = await this.browser.pages();
        console.log(`   Found ${pages.length} page(s) to close`);
        for (const page of pages) {
          try {
            if (!page.isClosed()) {
              await page.close();
              console.log(`   ✅ Closed page`);
            } else {
              console.log(`   ⚠️ Page already closed`);
            }
          } catch (e) {
            console.error(`   ⚠️ Error closing individual page:`, e.message);
          }
        }
        // Then close browser
        await this.browser.close();
        console.log(`   ✅ Step 2 complete: Browser closed`);
      } catch (err) {
        console.error(`❌ [MeetingBot.cleanup] Error closing browser:`, err && err.message ? err.message : err);
        console.error(`   Error stack:`, err.stack);
        // Force close if normal close fails
        try {
          if (this.browser.process()) {
            console.log(`   🔄 Attempting force kill...`);
            this.browser.process().kill('SIGKILL');
            console.log(`   ✅ Force kill sent`);
          }
        } catch (killErr) {
          console.error(`   ❌ Force kill also failed:`, killErr.message);
        }
      }
    } else {
      console.log(`   ⚠️ No browser to close`);
    }
    
    console.log(`\n✅ [MeetingBot.cleanup] Cleanup completed`);
  }
}

module.exports = MeetingBot;

