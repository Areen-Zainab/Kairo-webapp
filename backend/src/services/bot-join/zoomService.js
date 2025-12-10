// zoomService.js - Core logic for joining Zoom meetings via web client using Puppeteer
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract meeting ID and password from Zoom URL
 */
function extractZoomInfo(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/");
    let meetingId = null;
    const jIndex = parts.indexOf("j");
    const wIndex = parts.indexOf("w");
    if (jIndex !== -1) meetingId = parts[jIndex + 1];
    if (wIndex !== -1) meetingId = parts[wIndex + 1];
    const password = parsed.searchParams.get("pwd") || null;
    return { meetingId, password };
  } catch {
    return { meetingId: null, password: null };
  }
}

/**
 * Build Zoom web client join URL
 */
function buildBrowserJoinURL(meetingId, password, botName) {
  const base64Name = Buffer.from(botName).toString("base64");
  let url = `https://zoom.us/wc/join/${meetingId}?prefer=1&un=${base64Name}`;
  if (password) url += `&pwd=${password}`;
  return url;
}

/**
 * Ensure microphone is muted
 */
async function ensureMicMuted(page, maxAttempts = 8) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(1000);

    const result = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, div[role="button"]');
      for (const btn of buttons) {
        const ariaLabel = (btn.getAttribute('aria-label') || '').trim();
        const text = (btn.textContent || '').trim();

        // Check if button is disabled or loading
        if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
          return { clicked: false, state: 'loading' };
        }

        // If button says "Mute" - mic is ON, click to mute
        if (ariaLabel === 'Mute' || text === 'Mute') {
          btn.click();
          return { clicked: true, state: 'muted' };
        }

        // If button says "Unmute" - mic is already OFF
        if (ariaLabel === 'Unmute' || text === 'Unmute') {
          return { clicked: false, state: 'already_muted' };
        }
      }
      return { clicked: false, state: 'not_found' };
    });

    if (result.state === 'loading') {
      continue;
    }

    if (result.state === 'muted' || result.state === 'already_muted') {
      return true;
    }
  }

  return false;
}

/**
 * Ensure video is off
 */
async function ensureVideoOff(page, maxAttempts = 8) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(1000);

    const result = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, div[role="button"]');
      for (const btn of buttons) {
        const ariaLabel = (btn.getAttribute('aria-label') || '').trim();
        const text = (btn.textContent || '').trim();

        // Check if button is disabled or loading
        if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
          return { clicked: false, state: 'loading' };
        }

        // If button says "Stop Video" - camera is ON, click to stop
        if (ariaLabel === 'Stop Video' || text === 'Stop Video') {
          btn.click();
          return { clicked: true, state: 'stopped' };
        }

        // If button says "Start Video" - camera is already OFF
        if (ariaLabel === 'Start Video' || text === 'Start Video') {
          return { clicked: false, state: 'already_off' };
        }
      }
      return { clicked: false, state: 'not_found' };
    });

    if (result.state === 'loading') {
      continue;
    }

    if (result.state === 'stopped' || result.state === 'already_off') {
      return true;
    }
  }

  return false;
}

/**
 * Navigate to Zoom meeting URL
 * @param {Page} page - Puppeteer page object
 * @param {string} meetUrl - Zoom meeting URL
 * @param {string} botName - Name to join with
 */
async function navigateToMeeting(page, meetUrl, botName) {
  if (!page || page.isClosed()) {
    throw new Error('Page is closed, cannot navigate');
  }

  const { meetingId, password } = extractZoomInfo(meetUrl);

  if (!meetingId) {
    throw new Error('Invalid Zoom meeting URL');
  }

  const joinUrl = buildBrowserJoinURL(meetingId, password, botName);
  console.log('🔗 Zoom Join URL:', joinUrl);

  await page.goto(joinUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await sleep(4000);
}

/**
 * Enter bot name (for Zoom, name is pre-filled in URL, but we verify/update if needed)
 * @param {Page} page - Puppeteer page object
 * @param {string} botName - Name to enter
 */
async function enterBotName(page, botName) {
  if (!page || page.isClosed()) {
    throw new Error('Page is closed, cannot enter name');
  }

  try {
    const nameSelectors = [
      '#inputname',
      'input[name="username"]',
      'input[placeholder*="name" i]',
      'input[aria-label*="name" i]',
      'input[type="text"]'
    ];

    let nameInput = null;
    for (const selector of nameSelectors) {
      try {
        nameInput = await page.$(selector);
        if (nameInput) {
          break;
        }
      } catch { }
    }

    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.type(botName, { delay: 50 });
      console.log(`✍️ Filled name: ${botName}`);
    }
  } catch (e) {
    console.log('⚠️ Name field not found or already filled');
  }

  await sleep(1000);
}

/**
 * Disable camera and microphone
 * @param {Page} page - Puppeteer page object
 */
async function disableCameraAndMic(page) {
  if (!page || page.isClosed()) {
    console.log('⚠️ Page is closed, skipping camera/mic disable');
    return;
  }

  console.log('🎛️ Waiting for controls to finish loading...');
  await sleep(3000);

  let micMuted = await ensureMicMuted(page);
  let videoOff = await ensureVideoOff(page);

  if (!micMuted || !videoOff) {
    console.log('⚠️ WARNING: Could not confirm mic/video are off!');
    console.log('   Will keep trying...');

    let retries = 0;
    while ((!micMuted || !videoOff) && retries < 3) {
      console.log(`🔄 Retry ${retries + 1}/3: Waiting 3 more seconds...`);
      await sleep(3000);

      if (!micMuted) {
        const newMicResult = await ensureMicMuted(page, 5);
        if (newMicResult) micMuted = true;
      }
      if (!videoOff) {
        const newVideoResult = await ensureVideoOff(page, 5);
        if (newVideoResult) videoOff = true;
      }

      retries++;
    }

    if (!micMuted || !videoOff) {
      throw new Error('Could not disable mic/camera after multiple attempts');
    }
  }

  console.log('✅ All controls ready - mic muted and video off!');
  await sleep(1000);
}

/**
 * Click the join button
 * @param {Page} page - Puppeteer page object
 */

async function clickJoinButton(page) {
  if (!page || page.isClosed()) {
    throw new Error('Page is closed, cannot join meeting');
  }

  console.log('🚪 Clicking Join button...');
  await sleep(1000);

  const joinClicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (text === 'join' || text === 'join meeting' || ariaLabel.includes('join')) {
        btn.click();
        return true;
      }
    }
    return false;
  });

  if (!joinClicked) {
    throw new Error('Join button not found');
  }

  await sleep(5000);

  // Handle "Join Audio by Computer" dialog
  console.log('🔊 Checking for audio dialog...');
  await sleep(2000);

  const audioJoined = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (text.includes('join audio') || text.includes('computer audio') ||
        ariaLabel.includes('join audio')) {
        btn.click();
        return true;
      }
    }
    return false;
  });

  if (audioJoined) {
    console.log('✅ Clicked "Join Audio by Computer"');
    console.log('⚠️ NOTE: Joining audio auto-unmutes mic - will mute again...');

    // CRITICAL: Mute mic again after joining audio
    await sleep(2000);
    await ensureMicMuted(page, 5);

    // NEW: Wait for audio to fully initialize
    console.log('⏳ Waiting for audio to initialize...');
    await sleep(5000);

    // CRITICAL: Ensure audio capture is active after Zoom audio initialization
    const audioCaptureActive = await ensureAudioCaptureActive(page);
    if (!audioCaptureActive) {
      console.log('⚠️ WARNING: Audio capture may not be working properly!');
      console.log('   Transcription and recording may be affected.');
    }
  } else {
    console.log('⚠️ Audio dialog not found - audio may not be joined!');
  }


  // Debug audio capture for final verification
  const audioDebug = await debugAudioCapture(page);

  // If audio capture still isn't working, try one more aggressive approach
  if (!audioDebug.hasAudioCapture || !audioDebug.audioCaptureDetails?.hasTrack) {
    console.log('\n⚠️ Audio capture verification failed - trying aggressive fallback...');
    
    // Try to manually trigger audio capture by looking for any available audio tracks
    const fallbackResult = await page.evaluate(() => {
      try {
        // Look for any audio tracks in the page
        const allAudioTracks = [];
        
        // Check all video elements
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          if (video.srcObject && video.srcObject.getAudioTracks) {
            const tracks = video.srcObject.getAudioTracks();
            tracks.forEach(track => {
              if (track.readyState === 'live') {
                allAudioTracks.push({
                  source: 'video_element',
                  track: track,
                  id: track.id,
                  label: track.label
                });
              }
            });
          }
        });

        // If we found any tracks, try to use the first one
        if (allAudioTracks.length > 0) {
          const bestTrack = allAudioTracks[0];
          console.log('[KAIRO-FALLBACK] Found audio track:', bestTrack.id, bestTrack.label);
          
          // Initialize audio capture if needed
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
          
          // Set the track and try to start recording
          window.audioCapture.trackToRecord = bestTrack.track;
          
          if (window.startAudioRecording) {
            window.startAudioRecording();
            return { success: true, trackId: bestTrack.id, trackLabel: bestTrack.label };
          }
        }
        
        return { success: false, tracksFound: allAudioTracks.length };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    
    if (fallbackResult.success) {
      console.log(`✅ Fallback successful - using track: ${fallbackResult.trackLabel || fallbackResult.trackId}`);
    } else {
      console.log(`❌ Fallback failed - tracks found: ${fallbackResult.tracksFound || 0}`);
      if (fallbackResult.error) {
        console.log(`   Error: ${fallbackResult.error}`);
      }
      console.log('   Recording and transcription will likely not work correctly.');
    }
  }

  // Final verification
  await sleep(2000);
  const finalState = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, div[role="button"]');
    let micState = 'unknown';
    let videoState = 'unknown';

    for (const btn of buttons) {
      const ariaLabel = (btn.getAttribute('aria-label') || '').trim();
      const text = (btn.textContent || '').trim();

      if (ariaLabel === 'Unmute' || text === 'Unmute') micState = 'muted';
      if (ariaLabel === 'Mute' || text === 'Mute') micState = 'unmuted';
      if (ariaLabel === 'Start Video' || text === 'Start Video') videoState = 'off';
      if (ariaLabel === 'Stop Video' || text === 'Stop Video') videoState = 'on';
    }

    return { micState, videoState };
  });

  console.log(`   Mic: ${finalState.micState === 'muted' ? '✅ MUTED' : '⚠️ ' + finalState.micState.toUpperCase()}`);
  console.log(`   Camera: ${finalState.videoState === 'off' ? '✅ OFF' : '⚠️ ' + finalState.videoState.toUpperCase()}`);
}

/**
 * Debug audio capture after joining
 * Simplified to check actual recording state
 */
async function debugAudioCapture(page) {
  console.log('\n🔍 DEBUG: Checking audio capture status...');

  await sleep(2000);

  const audioDebug = await page.evaluate(() => {
    const hasAudioCapture = typeof window.audioCapture !== 'undefined';

    return {
      hasAudioCapture: hasAudioCapture,
      hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
      hasAudioContext: !!window.AudioContext || !!window.webkitAudioContext,

      // Check if audioCapture was initialized
      audioCaptureDetails: hasAudioCapture ? {
        isRecording: window.audioCapture.isRecording || false,
        hasTrack: !!window.audioCapture.trackToRecord,
        trackState: window.audioCapture.trackToRecord?.readyState || 'none',
        hasContext: !!window.audioCapture.audioContext,
        hasRecorder: !!window.audioCapture.completeRecorder,
        streamChunks: window.audioCapture.streamChunks?.length || 0,
      } : null,

      // Check for audio/video elements on page
      videoElements: document.querySelectorAll('video').length,

      // Check for media streams with audio
      videoStreamsWithAudio: (function () {
        const videos = document.querySelectorAll('video');
        let count = 0;
        videos.forEach(v => {
          if (v.srcObject && v.srcObject.getAudioTracks) {
            const audioTracks = v.srcObject.getAudioTracks();
            if (audioTracks.length > 0) count++;
          }
        });
        return count;
      })()
    };
  });

  console.log('📊 Audio Capture Status:');
  console.log(`  ✓ getUserMedia API: ${audioDebug.hasGetUserMedia ? 'Available' : 'Missing'}`);
  console.log(`  ✓ AudioContext API: ${audioDebug.hasAudioContext ? 'Available' : 'Missing'}`);
  console.log(`  ✓ Audio Capture System: ${audioDebug.hasAudioCapture ? 'Initialized' : 'Not Initialized'}`);

  if (audioDebug.audioCaptureDetails) {
    const details = audioDebug.audioCaptureDetails;
    console.log(`  ✓ Recording Active: ${details.isRecording ? 'YES ✅' : 'NO ⚠️'}`);
    console.log(`  ✓ Audio Track: ${details.hasTrack ? `YES (${details.trackState})` : 'NO ⚠️'}`);
    console.log(`  ✓ Chunks Recorded: ${details.streamChunks}`);
  } else {
    console.log('  ⚠️ Audio capture not initialized - recording will not work!');
  }

  console.log(`  ✓ Video Elements: ${audioDebug.videoElements}`);
  console.log(`  ✓ Streams with Audio: ${audioDebug.videoStreamsWithAudio}`);

  return audioDebug;
}

/**
 * Verify audio capture is active after joining Zoom audio
 * Audio capture should start automatically via getUserMedia override
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<boolean>} - True if audio capture is active, false otherwise
 */
async function ensureAudioCaptureActive(page) {
  console.log('\n🔍 [Zoom] Verifying audio capture status...');

  const maxAttempts = 5;
  const delayBetweenAttempts = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`   Check ${attempt}/${maxAttempts}...`);

    // Wait for audio to initialize
    await sleep(delayBetweenAttempts);

    // Check current audio capture status
    const status = await page.evaluate(() => {
      return {
        hasAudioCapture: !!window.audioCapture,
        isRecording: window.audioCapture?.isRecording || false,
        hasTrack: !!window.audioCapture?.trackToRecord,
        trackState: window.audioCapture?.trackToRecord?.readyState || 'none',
        streamChunks: window.audioCapture?.streamChunks?.length || 0
      };
    });

    console.log(`   Status: recording=${status.isRecording}, hasTrack=${status.hasTrack}, trackState=${status.trackState}, chunks=${status.streamChunks}`);

    // If audio capture is working, we're done
    if (status.isRecording && status.hasTrack && status.trackState === 'live') {
      console.log('✅ [Zoom] Audio capture is active and working!');
      return true;
    }

    // If we have chunks, recording is working even if other checks fail
    if (status.streamChunks > 0) {
      console.log('✅ [Zoom] Audio capture is working (chunks detected)!');
      return true;
    }

    // If this is not the last attempt, wait before retrying
    if (attempt < maxAttempts) {
      console.log(`   ⏳ Audio not ready yet, waiting...`);
    }
  }

  console.log('⚠️ [Zoom] Audio capture verification timed out - recording may not work correctly');
  return false;
}

/**
 * Leave the Zoom meeting
 * @param {Page} page - Puppeteer page object
 */
async function leaveMeeting(page) {
  if (!page || page.isClosed()) {
    console.log('⚠️ Page is closed, cannot leave meeting');
    return;
  }

  console.log('🔍 Searching for leave button...');

  const leftMeeting = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));

    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase().trim();
      const label = (btn.getAttribute('aria-label') || '').toLowerCase().trim();

      // Look for "Leave" or "End" button
      if (label.includes('leave') || text.includes('leave') ||
        label.includes('end') || text.includes('end')) {
        const rect = btn.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;

        if (isVisible) {
          btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          btn.click();
          return true;
        }
      }
    }

    return false;
  });

  if (leftMeeting) {
    console.log('✅ Clicked leave button');
  } else {
    console.log('⚠️ Leave button not found');
  }

  await sleep(2000);
}

module.exports = {
  navigateToMeeting,
  enterBotName,
  disableCameraAndMic,
  clickJoinButton,
  leaveMeeting,
  debugAudioCapture,  // Export for testing
  ensureAudioCaptureActive  // Export for MeetingBot integration
};

