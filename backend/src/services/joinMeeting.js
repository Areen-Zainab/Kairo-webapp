// joinMeeting.js - Pure functions for Google Meet interactions only
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
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, div[role="button"]');
      buttons.forEach(btn => {
        const text = (btn.textContent || '').toLowerCase();
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        
        if (text.includes('leave') || text.includes('leave call') || 
            label.includes('leave') || label.includes('leave call')) {
          btn.click();
        }
      });
    });
    
    await sleep(2000);
    console.log('✅ Left meeting');
  } catch (error) {
    console.error('❌ Error leaving meeting:', error.message);
  }
}

module.exports = {
  navigateToMeeting,
  enterBotName,
  disableCameraAndMic,
  clickJoinButton,
  leaveMeeting
};
