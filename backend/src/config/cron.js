const cron = require('node-cron');
const updateMeetingStatuses = require('../jobs/updateMeetingStatuses');
const autoJoinMeetings = require('../jobs/autoJoinMeetings');
const preloadModels = require('../jobs/preloadModels');
const checkTaskReminders = require('../jobs/checkTaskReminders');
const runWhisperMode = require('../jobs/runWhisperMode');

let meetingStatusCronJob = null;
let autoJoinCronJob = null;
let preloadModelsCronJob = null;
let taskRemindersCronJob = null;
let whisperModeCronJob = null;

/**
 * Initialize cron jobs
 * This function sets up all scheduled jobs for the application
 */
function initializeCronJobs() {
  console.log('\n⏰ Initializing cron jobs...');

  // Meeting status update job - runs every 15 minutes
  // Cron format: '*/15 * * * *'
  // This means: at every 15 minutes
  
  meetingStatusCronJob = cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await updateMeetingStatuses();
      
      if (result.success) {
        console.log(`✅ Meeting status update completed successfully`);
        console.log(`   - ${result.completedCount} meetings marked as completed`);
        console.log(`   - ${result.inProgressCount} meetings marked as in-progress`);
      } else {
        console.error(`❌ Meeting status update failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error in meeting status update job:`, error);
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  console.log('✅ Cron jobs initialized successfully');
  console.log('   - Meeting status update: every 15 minutes');
  
  // Auto-join job - runs every minute to ensure headless join at start time
  autoJoinCronJob = cron.schedule('* * * * *', async () => {
    try {
      const result = await autoJoinMeetings();
      if (!result.success) {
        console.error('❌ Auto-join job failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Error in auto-join job:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  console.log('   - Auto-join meetings: every minute');
  
  // Model preload job - runs every minute to preload models 3 minutes before meetings
  preloadModelsCronJob = cron.schedule('* * * * *', async () => {
    try {
      const result = await preloadModels();
      if (!result.success) {
        console.error('❌ Model preload job failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Error in model preload job:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  console.log('   - Model preload: every minute (3 minutes before meetings)');
  
  // Task reminders job - runs every 15 minutes to check for upcoming task deadlines
  taskRemindersCronJob = cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await checkTaskReminders();
      
      if (result.success) {
        if (result.remindersSent > 0) {
          console.log(`✅ Task reminders sent: ${result.remindersSent}`);
        }
      } else {
        console.error(`❌ Task reminder check failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error in task reminder job:`, error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  console.log('   - Task reminders: every 15 minutes');
  
  // Whisper Mode - micro recaps during active meetings
  // Guarded by WHISPER_MODE_ENABLED to avoid additive risk when feature is not desired.
  if (process.env.WHISPER_MODE_ENABLED === 'true') {
    const schedule = process.env.WHISPER_MODE_CRON_SCHEDULE || '*/10 * * * *'; // Every 5-10 minutes (roadmap)
    whisperModeCronJob = cron.schedule(schedule, async () => {
      try {
        const result = await runWhisperMode();
        if (!result?.success) {
          console.error('❌ WhisperMode cron job failed:', result?.error || 'unknown error');
        }
      } catch (error) {
        console.error('❌ Error in WhisperMode cron job:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    console.log(`   - Whisper Mode: cron ${schedule} (enabled)`);
  } else {
    console.log('   - Whisper Mode: disabled (set WHISPER_MODE_ENABLED=true to enable)');
  }

  // Optional: Run the job immediately on startup (for testing)
  // Uncomment the line below if you want to run the job once on startup
  // updateMeetingStatuses();
}

/**
 * Stop all cron jobs
 * This is useful for graceful shutdown
 */
function stopCronJobs() {
  console.log('\n🛑 Stopping cron jobs...');
  
  if (meetingStatusCronJob) {
    meetingStatusCronJob.stop();
    console.log('   - Meeting status update job stopped');
  }
  if (autoJoinCronJob) {
    autoJoinCronJob.stop();
    console.log('   - Auto-join meetings job stopped');
  }
  if (preloadModelsCronJob) {
    preloadModelsCronJob.stop();
    console.log('   - Model preload job stopped');
  }
  if (taskRemindersCronJob) {
    taskRemindersCronJob.stop();
    console.log('   - Task reminders job stopped');
  }

  if (whisperModeCronJob) {
    whisperModeCronJob.stop();
    console.log('   - Whisper Mode cron job stopped');
  }
  
  console.log('✅ All cron jobs stopped');
}

/**
 * Trigger auto-join job immediately (for immediate meetings)
 * This bypasses the cron schedule and runs the job right away
 */
async function triggerAutoJoinImmediately() {
  try {
    console.log('🚀 Triggering auto-join job immediately...');
    const result = await autoJoinMeetings();
    if (!result.success) {
      console.error('❌ Immediate auto-join job failed:', result.error);
    } else {
      console.log(`✅ Immediate auto-join completed: triggered=${result.triggered}, skipped=${result.skipped}`);
    }
    return result;
  } catch (error) {
    console.error('❌ Error in immediate auto-join job:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initializeCronJobs,
  stopCronJobs,
  triggerAutoJoinImmediately
};

