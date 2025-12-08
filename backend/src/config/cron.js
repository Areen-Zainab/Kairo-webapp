const cron = require('node-cron');
const updateMeetingStatuses = require('../jobs/updateMeetingStatuses');
const autoJoinMeetings = require('../jobs/autoJoinMeetings');
const preloadModels = require('../jobs/preloadModels');

let meetingStatusCronJob = null;
let autoJoinCronJob = null;
let preloadModelsCronJob = null;

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

