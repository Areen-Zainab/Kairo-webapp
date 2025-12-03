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
  leaveMeeting
};