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
      } catch {}
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
  } else {
    console.log('⚠️ Audio dialog not found - audio may not be joined!');
  }

  // NEW: Debug audio capture
  const audioDebug = await debugAudioCapture(page);
  
  // NEW: If audio capture isn't working, try to find and capture audio
  if (!audioDebug.hasAudioCapture || !audioDebug.audioCaptureDetails?.hasTrack) {
    console.log('\n⚠️ Audio capture not working! Attempting to find audio streams...');
    
    await page.evaluate(() => {
      console.log('[ZOOM DEBUG] Looking for audio streams...');
      
      // Try to find video elements with audio
      const videos = document.querySelectorAll('video');
      console.log(`[ZOOM DEBUG] Found ${videos.length} video elements`);
      
      videos.forEach((video, idx) => {
        console.log(`[ZOOM DEBUG] Video ${idx}:`, {
          hasSrcObject: !!video.srcObject,
          muted: video.muted,
          paused: video.paused,
          readyState: video.readyState
        });
        
        if (video.srcObject) {
          const tracks = video.srcObject.getTracks();
          console.log(`[ZOOM DEBUG] Video ${idx} tracks:`, tracks.map(t => ({
            kind: t.kind,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
          })));
        }
      });
    });
    
    await sleep(2000);
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
 * Add this right after clickJoinButton in zoomService.js
 */
async function debugAudioCapture(page) {
  console.log('\n🔍 DEBUG: Checking audio capture status...');
  
  await sleep(3000);
  
  const audioDebug = await page.evaluate(() => {
    return {
      hasAudioCapture: !!window.audioCapture,
      hasGetDisplayMedia: !!navigator.mediaDevices?.getDisplayMedia,
      hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
      hasAudioContext: !!window.AudioContext || !!window.webkitAudioContext,
      
      // Check if audioCapture was initialized
      audioCaptureDetails: window.audioCapture ? {
        isRecording: window.audioCapture.isRecording,
        hasTrack: !!window.audioCapture.trackToRecord,
        hasContext: !!window.audioCapture.audioContext,
        hasRecorder: !!window.audioCapture.completeRecorder,
        streamChunks: window.audioCapture.streamChunks?.length || 0,
      } : null,
      
      // Check for audio/video elements on page
      audioElements: document.querySelectorAll('audio').length,
      videoElements: document.querySelectorAll('video').length,
      
      // Check for media streams
      hasMediaStream: (function() {
        const videos = document.querySelectorAll('video');
        let count = 0;
        videos.forEach(v => {
          if (v.srcObject) count++;
        });
        return count;
      })()
    };
  });
  
  console.log('📊 Audio Debug Info:');
  console.log('  Browser APIs Available:');
  console.log(`    - getDisplayMedia: ${audioDebug.hasGetDisplayMedia}`);
  console.log(`    - getUserMedia: ${audioDebug.hasGetUserMedia}`);
  console.log(`    - AudioContext: ${audioDebug.hasAudioContext}`);
  console.log('  Audio Capture:');
  console.log(`    - window.audioCapture exists: ${audioDebug.hasAudioCapture}`);
  
  if (audioDebug.audioCaptureDetails) {
    console.log(`    - isRecording: ${audioDebug.audioCaptureDetails.isRecording}`);
    console.log(`    - hasTrack: ${audioDebug.audioCaptureDetails.hasTrack}`);
    console.log(`    - hasContext: ${audioDebug.audioCaptureDetails.hasContext}`);
    console.log(`    - hasRecorder: ${audioDebug.audioCaptureDetails.hasRecorder}`);
    console.log(`    - streamChunks: ${audioDebug.audioCaptureDetails.streamChunks}`);
  } else {
    console.log('    - ⚠️ audioCapture not initialized!');
  }
  
  console.log('  Page Elements:');
  console.log(`    - <audio> elements: ${audioDebug.audioElements}`);
  console.log(`    - <video> elements: ${audioDebug.videoElements}`);
  console.log(`    - videos with streams: ${audioDebug.hasMediaStream}`);
  
  return audioDebug;
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
  debugAudioCapture  // Export for testing
};

