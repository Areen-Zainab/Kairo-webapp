// meetService.js - Pure functions for Google Meet interactions only
require('dotenv').config();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Navigate to Google Meet URL
 * @param {Page} page - Puppeteer page object
 * @param {string} meetUrl - Google Meet URL
 */
async function navigateToMeeting(page, meetUrl) {
  if (!page || page.isClosed()) {
    throw new Error('Page is closed, cannot navigate');
  }

  await page.goto(meetUrl, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await sleep(5000);
}

/**
 * Enter bot name into the name input field
 * @param {Page} page - Puppeteer page object
 * @param {string} botName - Name to enter
 */
async function enterBotName(page, botName) {
  if (!page || page.isClosed()) {
    throw new Error('Page is closed, cannot enter name');
  }

  try {
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await page.evaluate((name) => {
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
    }, botName);
  } catch (e) {
    console.log('⚠️ Name field not found or already filled');
  }

  await sleep(2000);
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

  try {
    await page.evaluate(() => {
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
  } catch (error) {
    console.error('❌ Error disabling camera/mic:', error.message);
  }
}

/**
 * Click the join button
 * @param {Page} page - Puppeteer page object
 */
async function clickJoinButton(page) {
  if (!page || page.isClosed()) {
    throw new Error('Page is closed, cannot join meeting');
  }

  try {
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, div[role="button"]');
      buttons.forEach(btn => {
        const text = (btn.textContent || '').toLowerCase();
        if (text.includes('join now') || text.includes('ask to join')) {
          btn.click();
        }
      });
    });

    await sleep(8000);
  } catch (error) {
    console.error('❌ Error joining meeting:', error.message);
    throw error;
  }
}

/**
 * Check if the "You can't join this video call" error screen is displayed
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<boolean>} - True if error screen is detected, false otherwise
 */
async function detectJoinError(page) {
  if (!page || page.isClosed()) {
    return false;
  }

  try {
    const hasError = await page.evaluate(() => {
      const bodyText = (document.body?.innerText || '').toLowerCase();
      const bodyHTML = (document.body?.innerHTML || '').toLowerCase();
      
      // Check for the error message text
      const hasErrorText = 
        bodyText.includes("you can't join this video call") ||
        bodyText.includes("can't join this video call") ||
        bodyText.includes("you can't join") ||
        bodyHTML.includes("you can't join this video call");
      
      // Check for "Return to home screen" button (indicator of error screen)
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const hasReturnButton = buttons.some(btn => {
        const text = (btn.textContent || '').toLowerCase();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        return text.includes('return to home screen') || 
               text.includes('return to home') ||
               label.includes('return to home screen');
      });
      
      // Check for "Submit feedback" link (also on error screen)
      const links = Array.from(document.querySelectorAll('a'));
      const hasFeedbackLink = links.some(link => {
        const text = (link.textContent || '').toLowerCase();
        return text.includes('submit feedback');
      });
      
      return hasErrorText || (hasReturnButton && hasFeedbackLink);
    });
    
    return hasError;
  } catch (error) {
    // If we can't check, assume no error (don't want false positives)
    return false;
  }
}

/**
 * Check if bot has entered the meeting (sees leave button or other indicators)
 * @param {Page} page - Puppeteer page object
 * @param {number} timeoutMs - Maximum time to wait (default: 30000ms = 30 seconds)
 * @returns {Promise<boolean>} - True if bot has entered, false otherwise
 */
async function waitForMeetingEntry(page, timeoutMs = 30000) {
  if (!page || page.isClosed()) {
    return false;
  }

  const startTime = Date.now();
  const checkInterval = 1000; // Check every second

  while (Date.now() - startTime < timeoutMs) {
    try {
      const hasEntered = await page.evaluate(() => {
        // Strategy 1: Look for leave button (most reliable indicator)
        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
        
        for (const btn of buttons) {
          const text = (btn.textContent || '').toLowerCase().trim();
          const label = (btn.getAttribute('aria-label') || '').toLowerCase().trim();
          const dataTestId = btn.getAttribute('data-testid') || '';
          
          // Check for leave button indicators
          if (
            label.includes('leave call') ||
            label === 'leave call' ||
            (text.includes('leave') && !text.includes('leave meeting')) ||
            dataTestId.includes('leave')
          ) {
            const rect = btn.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 && 
                             window.getComputedStyle(btn).display !== 'none' &&
                             window.getComputedStyle(btn).visibility !== 'hidden';
            
            if (isVisible) {
              return true;
            }
          }
        }

        // Strategy 2: Look for meeting controls (toolbar with multiple buttons)
        const toolbarButtons = Array.from(document.querySelectorAll('button[data-testid], div[role="button"][data-testid]'));
        const hasMultipleControls = toolbarButtons.length >= 3; // Usually has mic, camera, leave, etc.
        
        // Strategy 3: Look for participant count or meeting info
        const bodyText = (document.body?.innerText || '').toLowerCase();
        const hasMeetingIndicators = 
          bodyText.includes('participant') ||
          bodyText.includes('people') ||
          bodyText.includes('present') ||
          bodyText.includes('meeting');

        // Strategy 4: Check for video grid or meeting content area
        const videoElements = document.querySelectorAll('video, [data-self-name], [data-participant-id]');
        const hasVideoContent = videoElements.length > 0;

        // Entered if we have leave button OR (multiple controls AND meeting indicators)
        return hasMultipleControls && (hasMeetingIndicators || hasVideoContent);
      });

      if (hasEntered) {
        return true;
      }

      // Wait before next check
      await sleep(checkInterval);
    } catch (error) {
      // If page is closed or error occurs, return false
      if (page.isClosed()) {
        return false;
      }
      // Continue checking on other errors
      await sleep(checkInterval);
    }
  }

  // Timeout reached
  return false;
}

/**
 * Leave the meeting
 * @param {Page} page - Puppeteer page object
 */
async function leaveMeeting(page) {
  if (!page || page.isClosed()) {
    console.log('⚠️ Page is closed, cannot leave meeting');
    return;
  }

  try {
    console.log('🔍 Searching for leave button...');
    
    // Try multiple strategies to find and click the leave button
    const leftMeeting = await page.evaluate(() => {
      // Strategy 1: Look for button with "Leave call" or "Leave" in aria-label
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
      
      // First, try to find the most specific leave button
      let leaveButton = null;
      
      for (const btn of buttons) {
        const text = (btn.textContent || '').toLowerCase().trim();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase().trim();
        const dataTestId = btn.getAttribute('data-testid') || '';
        const className = btn.className || '';
        
        // Check for leave button indicators
        if (
          label.includes('leave call') ||
          label === 'leave call' ||
          (text.includes('leave') && !text.includes('leave meeting')) ||
          dataTestId.includes('leave') ||
          className.includes('leave')
        ) {
          // Make sure it's visible and clickable
          const rect = btn.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 && 
                           window.getComputedStyle(btn).display !== 'none' &&
                           window.getComputedStyle(btn).visibility !== 'hidden';
          
          if (isVisible) {
            leaveButton = btn;
            break; // Found the button, stop searching
          }
        }
      }
      
      if (leaveButton) {
        console.log('[KAIRO] Found leave button, clicking...');
        // Scroll into view if needed
        leaveButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Try multiple click methods
        try {
          leaveButton.click();
        } catch (e1) {
          try {
            leaveButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          } catch (e2) {
            try {
              const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
              const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
              leaveButton.dispatchEvent(mouseDown);
              leaveButton.dispatchEvent(mouseUp);
            } catch (e3) {
              console.error('[KAIRO] All click methods failed');
              return false;
            }
          }
        }
        return true;
      }
      
      // Strategy 2: Look for end call button (alternative)
      for (const btn of buttons) {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (label.includes('end call') || label.includes('hang up')) {
          const rect = btn.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          if (isVisible) {
            btn.click();
            return true;
          }
        }
      }
      
      console.log('[KAIRO] No leave button found');
      return false;
    });

    if (!leftMeeting) {
      console.log('⚠️ Could not find leave button, trying keyboard shortcut...');
      // Fallback: Try keyboard shortcut (Ctrl+E or Alt+Q)
      try {
        await page.keyboard.down('Control');
        await page.keyboard.press('e');
        await page.keyboard.up('Control');
        await sleep(500);
      } catch (kbErr) {
        console.log('⚠️ Keyboard shortcut failed, trying Alt+Q...');
        try {
          await page.keyboard.down('Alt');
          await page.keyboard.press('q');
          await page.keyboard.up('Alt');
        } catch (kbErr2) {
          console.log('⚠️ All leave methods failed');
        }
      }
    }
    
    // Wait for leave action to process
    await sleep(2000);
    
    // Check if we successfully left (look for confirmation dialog or "you left" message)
    const confirmLeave = await page.evaluate(() => {
      const bodyText = (document.body?.innerText || '').toLowerCase();
      const hasConfirmation = bodyText.includes('leave the call') || 
                             bodyText.includes('end call for everyone') ||
                             bodyText.includes('you left the meeting');
      
      // Look for confirmation button
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
      for (const btn of buttons) {
        const text = (btn.textContent || '').toLowerCase();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        if ((text.includes('leave') || label.includes('leave')) && 
            (text.includes('call') || label.includes('call'))) {
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            btn.click();
            return true;
          }
        }
      }
      
      return hasConfirmation;
    });
    
    if (confirmLeave) {
      await sleep(1000);
    }
    
    console.log('✅ Leave action completed');
  } catch (error) {
    console.error('❌ Error leaving meeting:', error && error.message ? error.message : error);
    // Even if leave fails, we'll still close the browser
  }
}

module.exports = {
  navigateToMeeting,
  enterBotName,
  disableCameraAndMic,
  clickJoinButton,
  waitForMeetingEntry,
  leaveMeeting,
  detectJoinError
};