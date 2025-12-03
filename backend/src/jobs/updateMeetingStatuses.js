const prisma = require('../lib/prisma');
const { computeMeetingStatus } = require('../utils/meetingStatus');
const { stopMeetingSession } = require('./autoJoinMeetings');

/**
 * Job to automatically update meeting statuses based on start and end times
 * - Updates "scheduled" meetings to "completed" when endTime < now
 * - Updates "scheduled" meetings to "in-progress" when startTime <= now <= endTime
 * - Updates "in-progress" meetings to "completed" when endTime < now
 */
async function updateMeetingStatuses() {
  const startTime = Date.now();
  console.log(`\n[${new Date().toISOString()}] ⏰ Starting meeting status update job...`);

  try {
    const now = new Date();

    // Find all scheduled meetings AND in-progress meetings
    const meetingsToCheck = await prisma.meeting.findMany({
      where: {
        status: {
          in: ['scheduled', 'upcoming', 'in-progress']
        }
      }
    });

    console.log(`Found ${meetingsToCheck.length} meetings to check (scheduled/upcoming/in-progress)`);

    let completedCount = 0;
    let inProgressCount = 0;
    let errors = [];

    // Process each meeting
    for (const meeting of meetingsToCheck) {
      try {
        const computedStatus = computeMeetingStatus(meeting);
        
        // Only update if status has changed
        if (computedStatus !== meeting.status) {
          await prisma.meeting.update({
            where: { id: meeting.id },
            data: { status: computedStatus }
          });

          // Stop active bot session if meeting is being marked as completed
          if (computedStatus === 'completed') {
            try {
              await stopMeetingSession(meeting.id);
              console.log(`Stopped active bot session for auto-completed meeting ${meeting.id}`);
            } catch (sessionError) {
              console.error(`Error stopping bot session for meeting ${meeting.id}:`, sessionError);
              // Continue even if stopping session fails
            }
            completedCount++;
          } else if (computedStatus === 'in-progress') {
            inProgressCount++;
          }

          console.log(`Updated meeting ${meeting.id} (${meeting.title}): ${meeting.status} → ${computedStatus}`);
        }
      } catch (error) {
        errors.push({
          meetingId: meeting.id,
          title: meeting.title,
          error: error.message
        });
        console.error(`Error updating meeting ${meeting.id}:`, error.message);
      }
    }

    const duration = Date.now() - startTime;
    
    console.log(`[${new Date().toISOString()}] Meeting status update completed:`);
    console.log(`  - Updated to "completed": ${completedCount}`);
    console.log(`  - Updated to "in-progress": ${inProgressCount}`);
    console.log(`  - Errors: ${errors.length}`);
    console.log(`  - Duration: ${duration}ms`);

    // Log errors if any
    if (errors.length > 0) {
      console.error('Errors encountered during update:');
      errors.forEach(err => {
        console.error(`  - Meeting ${err.meetingId} (${err.title}): ${err.error}`);
      });
    }

    return {
      success: true,
      completedCount,
      inProgressCount,
      errorCount: errors.length,
      totalChecked: meetingsToCheck.length,
      duration
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Fatal error in meeting status update job:`, error);
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = updateMeetingStatuses;

