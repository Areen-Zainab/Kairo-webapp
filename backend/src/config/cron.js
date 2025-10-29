const cron = require('node-cron');
const updateMeetingStatuses = require('../jobs/updateMeetingStatuses');
const autoJoinMeetings = require('../jobs/autoJoinMeetings');

let meetingStatusCronJob = null;
let autoJoinCronJob = null;

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
    console.log(`\n⏰ [${new Date().toISOString()}] Running scheduled meeting status update...`);
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
    console.log(`\n⏰ [${new Date().toISOString()}] Running auto-join meetings job...`);
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
  
  console.log('✅ All cron jobs stopped');
}

module.exports = {
  initializeCronJobs,
  stopCronJobs
};

