// MeetingBot.js - High-level orchestrator for meeting lifecycle
require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const AudioRecorder = require('./AudioRecorder');
const PostMeetingProcessor = require('./PostMeetingProcessor');

// Platform-specific handlers (modularized under bot-join)
const meetPlatform = require('./bot-join/meetService');
const zoomPlatform = require('./bot-join/zoomService');

puppeteer.use(StealthPlugin());

// Base directory for all meeting data
const MEETING_DATA_BASE_DIR = path.resolve(__dirname, '../../data/meetings');
if (!fs.existsSync(MEETING_DATA_BASE_DIR)) {
  fs.mkdirSync(MEETING_DATA_BASE_DIR, { recursive: true });
}

class MeetingBot {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
    this.audioRecorder = null;
    this.meetingDataDir = null;
    this.chunksDir = null;
    this.monitorInterval = null;
    this.autoExitTimeout = null;
    this.meetingId = config.meetingId;
    this.actionItemsInterval = null;
    this.actionItemsRunning = false;
    this.actionItemsExtractionEnabled = true;

    // Track meeting timing for duration calculation
    this.joinTime = null;
    this.stopTime = null;

    // Detect platform and set handlers
    this.platform = this.detectPlatform(config.meetUrl);
    this.platformHandlers = this.platform === 'zoom' ? zoomPlatform : meetPlatform;

    console.log(`🎯 Detected platform: ${this.platform.toUpperCase()}`);
  }

  /**
   * Detect meeting platform from URL
   */
  detectPlatform(url) {
    if (url.includes('zoom.us')) {
      return 'zoom';
    } else if (url.includes('meet.google.com')) {
      return 'meet';
    }
    throw new Error('Unsupported meeting platform. Only Google Meet and Zoom are supported.');
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
    console.log(`\n⏳ Loading ${this.platform} meeting...`);

    const botName = this.config.botName || process.env.BOT_NAME || 'Kairo Bot';

    await this.platformHandlers.navigateToMeeting(this.page, this.config.meetUrl, botName);
    console.log('✅ Page loaded');

    console.log('\n⏳ Entering name...');
    await this.platformHandlers.enterBotName(this.page, botName);
    console.log('✅ Name entered');

    console.log('\n🔧 Disabling camera and microphone...');
    await this.platformHandlers.disableCameraAndMic(this.page);
    console.log('✅ Camera and mic disabled');

    console.log('\n⏳ Joining meeting...');
    await this.platformHandlers.clickJoinButton(this.page);
    console.log('✅ Join clicked');

    // Wait 2 seconds for meeting to load before proceeding
    console.log('\n⏳ Waiting for meeting to load...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for join error screen (Google Meet specific) - check immediately
    if (this.platform === 'meet' && this.platformHandlers.detectJoinError) {
      const hasError = await this.platformHandlers.detectJoinError(this.page);
      if (hasError) {
        console.error('\n❌ [MeetingBot.joinMeeting] Detected "You can\'t join this video call" error screen');
        throw new Error('Failed to join meeting: "You can\'t join this video call" error detected');
      }
    }

    // Wait a bit more and check again (error screen might appear with delay)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Second check for error screen after delay
    if (this.platform === 'meet' && this.platformHandlers.detectJoinError) {
      const hasError = await this.platformHandlers.detectJoinError(this.page);
      if (hasError) {
        console.error('\n❌ [MeetingBot.joinMeeting] Detected "You can\'t join this video call" error screen (delayed check)');
        throw new Error('Failed to join meeting: "You can\'t join this video call" error detected');
      }
    }

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

    // Track join time for duration calculation
    this.joinTime = new Date();
    console.log(`⏰ Join time recorded: ${this.joinTime.toISOString()}`);
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
    const MAX_RETRY_ATTEMPTS = 3;
    let attempt = 0;
    let lastError = null;

    while (attempt < MAX_RETRY_ATTEMPTS) {
      attempt++;

      try {
        // Initialize browser and page
        if (attempt === 1) {
          await this.initialize();
        } else {
          // For retries, re-initialize (creates new browser instance)
          console.log(`\n🔄 [MeetingBot.start] Retry attempt ${attempt}/${MAX_RETRY_ATTEMPTS}...`);
          // Clean up previous browser if it exists
          if (this.browser) {
            try {
              await this.cleanup();
            } catch (cleanupErr) {
              console.error(`⚠️ Error cleaning up before retry:`, cleanupErr.message);
            }
          }
          await this.initialize();
        }

        // Create AudioRecorder instance
        this.audioRecorder = new AudioRecorder(
          this.page,
          this.meetingDataDir,
          this.chunksDir,
          this.meetingId
        );

        // Inject audio capture BEFORE navigating to meeting
        await this.audioRecorder.injectAudioCapture();

        // Join the meeting (waits 2 seconds after clicking join)
        await this.joinMeeting();

        // If we get here, join was successful - start transcription immediately
        // This prevents chunk accumulation before processing begins
        await this.audioRecorder.startRealtimeTranscription();

        break; // Exit retry loop

      } catch (error) {
        lastError = error;
        console.error(`❌ [MeetingBot.start] Attempt ${attempt}/${MAX_RETRY_ATTEMPTS} failed: ${error.message}`);

        // Close browser before retry
        try {
          await this.cleanup();
        } catch (cleanupError) {
          console.error(`⚠️ [MeetingBot.start] Error during cleanup after join failure:`, cleanupError.message);
        }

        // If this was the last attempt, throw the error
        if (attempt >= MAX_RETRY_ATTEMPTS) {
          console.error(`❌ [MeetingBot.start] All ${MAX_RETRY_ATTEMPTS} attempts failed. Giving up.`);
          throw lastError;
        }

        // Wait a bit before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 1s, 2s, 4s max
        console.log(`⏳ [MeetingBot.start] Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // If we get here, join was successful - continue with setup
    // Note: startRealtimeTranscription() is now called immediately after joinMeeting() 
    // to prevent chunk accumulation (moved above)

    // Start action item extraction
    await this.startActionItemExtraction();

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

    // Track stop time for duration calculation
    this.stopTime = new Date();
    if (this.joinTime) {
      const durationMs = this.stopTime.getTime() - this.joinTime.getTime();
      const durationMinutes = durationMs / (1000 * 60);
      console.log(`⏰ Stop time recorded: ${this.stopTime.toISOString()}`);
      console.log(`⏰ Meeting duration: ${durationMinutes.toFixed(2)} minutes`);
    } else {
      console.log(`⚠️  No join time recorded, cannot calculate duration`);
    }

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

      if (this.actionItemsInterval) {
        clearInterval(this.actionItemsInterval);
        this.actionItemsInterval = null;
        console.log('   ✅ Cleared actionItemsInterval');
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

        // Update meeting recording URL and duration in database
        if (this.meetingId) {
          try {


            // Update recording URL and duration with complete system path
            if (saveResult) {
              // Prefer MP3 path, fallback to WebM path
              const recordingPath = saveResult.mp3Path || saveResult.webmPath;
              if (recordingPath) {
                console.log(`\n💾 [MeetingBot.stop] Updating recording URL in database...`);
                await PostMeetingProcessor.updateRecordingUrl(
                  parseInt(this.meetingId),
                  recordingPath
                );

                // Update meeting duration with actual audio file duration
                console.log(`\n⏰ [MeetingBot.stop] Updating meeting duration from audio file...`);
                await PostMeetingProcessor.updateMeetingDuration(
                  parseInt(this.meetingId),
                  recordingPath
                );
              } else {
                console.log(`   ⚠️  No recording path available to update`);
              }
            } else {
              console.log(`   ⚠️  Recording not saved, skipping recording URL and duration update`);
            }
          } catch (dbUpdateError) {
            console.error(`   ⚠️  Error updating meeting in database:`, dbUpdateError.message);
            console.error(`   Error stack:`, dbUpdateError.stack);
            // Don't throw - continue with cleanup even if DB update fails
          }
        } else {
          console.log(`   ⚠️  No meeting ID available, skipping database updates`);
        }

        // Finalize transcription with complete audio file if available
        // NOTE: This runs in the background (non-blocking) so bot can leave meeting immediately
        // Diarization will complete asynchronously and update files when done
        if (this.audioRecorder.transcriptionService) {
          const transcriptionService = this.audioRecorder.transcriptionService;
          const audioPath = saveResult?.mp3Path || null;

          if (audioPath) {
            console.log(`\n🎭 [MeetingBot.stop] Starting transcription finalization with diarization (background)...`);
            console.log(`   Audio file: ${path.basename(audioPath)}`);
            console.log(`   Bot will leave meeting while diarization runs in background`);
          } else {
            console.log(`\n🎭 [MeetingBot.stop] Starting transcription finalization without diarization (background)...`);
            console.log(`   Bot will leave meeting while finalization runs in background`);
          }

          // Run finalization in background (don't await - non-blocking)
          transcriptionService.finalize(audioPath)
            .then(() => {
              console.log(`✅ [Background] Transcription finalization complete`);
            })
            .catch((error) => {
              console.error(`⚠️  [Background] Transcription finalization failed: ${error.message}`);
              console.error(`   Error stack:`, error.stack);
            })
            .finally(() => {
              // Cleanup transcription service after finalization (whether it succeeded or failed)
              if (transcriptionService) {
                transcriptionService.cleanup();
              }
            });

          // Clear reference immediately (cleanup happens in background promise)
          this.audioRecorder.transcriptionService = null;
        } else {
          console.log(`   ⚚️  No transcription service available to finalize`);
        }

        // Process pending action items post-meeting
        try {
          const PostMeetingProcessor = require('./PostMeetingProcessor');
          const postMeetingResult = await PostMeetingProcessor.processPendingActionItems(this.meetingId);
          if (postMeetingResult.requiresConfirmation) {
            console.log(`📋 ${postMeetingResult.pendingCount} pending action items require confirmation`);
          }
        } catch (postMeetingError) {
          console.error('⚠️ Error processing pending action items:', postMeetingError.message);
        }

        console.log(`\n🧹 [MeetingBot.stop] Step 3: Final audio cleanup...`);
        // 3. Final cleanup (close audio context)
        await this.audioRecorder.finalCleanup();
        console.log(`   ✅ Step 3 complete: finalCleanup() finished`);
      } else {
        console.log('   ⚠️ No audioRecorder to stop');
      }

      console.log(`\n🚪 [MeetingBot.stop] Step 4: Leaving meeting and closing browser...`);

      // Close WebSocket connections for this meeting
      if (this.meetingId) {
        try {
          const { closeMeetingConnections } = require('./WebSocketServer');
          const meetingIdNum = typeof this.meetingId === 'string'
            ? parseInt(this.meetingId, 10)
            : this.meetingId;
          if (!isNaN(meetingIdNum)) {
            closeMeetingConnections(meetingIdNum);
          }
        } catch (wsError) {
          console.warn(`⚠️  Error closing WebSocket connections: ${wsError.message}`);
        }
      }

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

    // Leave meeting using platform-specific handler
    try {
      if (this.page && !this.page.isClosed()) {
        console.log(`\n🚪 [MeetingBot.cleanup] Step 1: Leaving ${this.platform} meeting...`);
        await this.platformHandlers.leaveMeeting(this.page);
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
        await this.browser.close();
        console.log(`   ✅ Step 2 complete: Browser closed`);
      } catch (err) {
        console.error(`❌ [MeetingBot.cleanup] Error closing browser:`, err && err.message ? err.message : err);
        console.error(`   Error stack:`, err.stack);
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

  // Periodically extract action items from transcript
  async startActionItemExtraction() {
    if (!this.actionItemsExtractionEnabled) {
      console.log('⚠️ Action item extraction disabled');
      return;
    }

    const ActionItemService = require('./ActionItemService');
    const transcriptPath = path.join(this.meetingDataDir, 'transcript_complete.txt');
    const EXTRACTION_INTERVAL = parseInt(process.env.ACTION_ITEMS_INTERVAL || '90000', 10);

    console.log('📋 Starting periodic action item extraction...');

    this.actionItemsInterval = setInterval(async () => {
      if (this.actionItemsRunning || !this.page || this.page.isClosed()) {
        return;
      }

      this.actionItemsRunning = true;

      try {
        if (!fs.existsSync(transcriptPath)) {
          return;
        }

        const transcriptText = fs.readFileSync(transcriptPath, 'utf8');
        if (!transcriptText || transcriptText.trim().length < 50) {
          return;
        }

        const currentChunk = this.audioRecorder?.chunkSequence || null;

        const result = await ActionItemService.extractAndUpdateActionItems(
          this.meetingId,
          transcriptText,
          currentChunk
        );

        if (result.added > 0 || result.updated > 0) {
          console.log(`📋 Action items: ${result.added} added, ${result.updated} updated`);
        }
      } catch (error) {
        console.error('❌ Error in action item extraction:', error.message);
      } finally {
        this.actionItemsRunning = false;
      }
    }, EXTRACTION_INTERVAL);
  }
}

module.exports = MeetingBot;