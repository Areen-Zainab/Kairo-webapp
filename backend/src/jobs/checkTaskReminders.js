const ReminderService = require('../services/ReminderService');

/**
 * Job to check for task deadlines and send reminder notifications
 * - Runs periodically (every 15 minutes)
 * - Checks all tasks with upcoming due dates
 * - Sends reminders based on user preferences (default: 24h and 1h before)
 * - Only sends reminders to workspace members
 */
async function checkTaskReminders() {
  const startTime = Date.now();
  console.log(`\n[${new Date().toISOString()}] 🔔 Starting task reminder check job...`);

  try {
    const result = await ReminderService.checkAndSendReminders();

    const duration = Date.now() - startTime;
    
    console.log(`[${new Date().toISOString()}] Task reminder check completed:`);
    console.log(`  - Reminders sent: ${result.remindersSent}`);
    console.log(`  - Duration: ${duration}ms`);

    return {
      success: true,
      remindersSent: result.remindersSent,
      duration
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Fatal error in task reminder job:`, error);
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = checkTaskReminders;

