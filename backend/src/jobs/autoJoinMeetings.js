const prisma = require('../lib/prisma');
const { joinMeeting } = require('../services/joinMeeting');

// Track active meeting sessions
const activeSessions = new Map();

/**
 * Auto-join job
 * - Finds meetings whose startTime has arrived and should be joined by the bot
 * - Uses the persistent browser instance to join meetings
 * - Marks meeting metadata to avoid duplicate joins and optionally moves status to in-progress
 */
async function autoJoinMeetings() {
  const startedAt = Date.now();
  const now = new Date();

  console.log(`\n[${now.toISOString()}] Starting auto-join meeting job...`);

  try {
    // Look for meetings that are scheduled/upcoming/in-progress and within their time window
    // We will filter out those already triggered via metadata in code
    const candidates = await prisma.meeting.findMany({
      where: {
        status: { in: ['scheduled', 'upcoming', 'in-progress'] },
        startTime: { lte: now },
        endTime: { gte: now },
        meetingLink: { not: null }
      }
    });

    let triggered = 0;
    let skipped = 0;
    const errors = [];

    // Sequentially iterate to keep logs clean and avoid stampedes
    for (const meeting of candidates) {
      try {
        const meta = meeting.metadata || {};
        
        // Skip if already joined
        if (meta && meta.botJoinTriggeredAt) {
          // Check if session is still active
          if (activeSessions.has(meeting.id)) {
            skipped++;
            continue;
          }
        }

        const link = meeting.meetingLink;
        if (!link || typeof link !== 'string') {
          skipped++;
          continue;
        }

        // Calculate duration in minutes (from now until meeting end, with minimum of 5 minutes)
        const meetingEndTime = new Date(meeting.endTime);
        const durationMs = Math.max(meetingEndTime.getTime() - now.getTime(), 5 * 60 * 1000);
        const durationMinutes = Math.ceil(durationMs / (60 * 1000));

        // Join meeting using the persistent browser
        console.log(`🤖 Joining meeting ${meeting.id} (${meeting.title})...`);
        
        const session = await joinMeeting({
          meetUrl: link,
          botName: process.env.BOT_NAME || 'Kairo Bot',
          durationMinutes: durationMinutes,
          meetingId: String(meeting.id)
        });

        // Store session for cleanup
        activeSessions.set(meeting.id, session);

        // Set up cleanup when meeting duration ends or meeting ends
        const cleanupTimeout = setTimeout(async () => {
          try {
            if (session && session.stop) {
              await session.stop();
            }
            activeSessions.delete(meeting.id);
            
            // Update meeting status
            await prisma.meeting.update({
              where: { id: meeting.id },
              data: { status: 'completed' }
            });
          } catch (err) {
            console.error(`Error cleaning up meeting ${meeting.id}:`, err);
          }
        }, durationMinutes * 60 * 1000);

        // Mark as triggered to prevent duplicates; also set status to in-progress
        const newMetadata = { 
          ...(meta || {}), 
          botJoinTriggeredAt: new Date().toISOString(),
          botSessionId: String(session.meetingId)
        };

        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            status: 'in-progress',
            metadata: newMetadata
          }
        });

        console.log(`✅ Auto-join successful for meeting ${meeting.id} (${meeting.title})`);
        triggered++;
      } catch (err) {
        console.error(`❌ Auto-join error for meeting ${meeting.id}:`, err);
        errors.push({ meetingId: meeting.id, error: err.message });
        
        // Update meeting status to indicate failure
        try {
          await prisma.meeting.update({
            where: { id: meeting.id },
            data: {
              status: 'scheduled', // Reset status on failure
              metadata: {
                ...(meeting.metadata || {}),
                botJoinError: err.message,
                botJoinFailedAt: new Date().toISOString()
              }
            }
          });
        } catch (updateErr) {
          console.error(`Failed to update meeting ${meeting.id} status:`, updateErr);
        }
      }
    }

    const duration = Date.now() - startedAt;
    console.log(`[${new Date().toISOString()}] Auto-join job done: triggered=${triggered}, skipped=${skipped}, errors=${errors.length}, duration=${duration}ms`);

    return { success: true, triggered, skipped, errors, duration };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Fatal error in auto-join job:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get active sessions (for debugging/monitoring)
 */
function getActiveSessions() {
  return Array.from(activeSessions.keys());
}

/**
 * Stop a specific meeting session
 */
async function stopMeetingSession(meetingId) {
  const session = activeSessions.get(meetingId);
  if (session && session.stop) {
    await session.stop();
    activeSessions.delete(meetingId);
    return true;
  }
  return false;
}

module.exports = autoJoinMeetings;
module.exports.getActiveSessions = getActiveSessions;
module.exports.stopMeetingSession = stopMeetingSession;


