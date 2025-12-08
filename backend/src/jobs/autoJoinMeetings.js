const prisma = require('../lib/prisma');
const MeetingBot = require('../services/MeetingBot');

// Track active meeting sessions
const activeSessions = new Map();

// Track join requests in progress to prevent duplicate joins (lock mechanism)
const joinLocks = new Map();

/**
 * Auto-join job
 * - Finds meetings whose startTime has arrived and should be joined by the bot
 * - Uses the persistent browser instance to join meetings
 * - Marks meeting metadata to avoid duplicate joins and optionally moves status to in-progress
 */
async function autoJoinMeetings() {
  const startedAt = Date.now();
  const now = new Date();

  console.log(`\n[${now.toISOString()}] ⏰ Starting auto-join meeting job...`);

  try {
    // Look for meetings that are scheduled/upcoming/in-progress and within their time window
    // filter out those already triggered via metadata in code
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

    // Get join locks for checking
    const joinLocksMap = getJoinLocks();

    // Sequentially iterate to keep logs clean and avoid stampedes
    for (const meeting of candidates) {
      try {
        // PRIORITY 1: Check activeSessions FIRST (most reliable - in-memory, immediate)
        // This prevents duplicates even if metadata hasn't been updated yet
        if (activeSessions.has(meeting.id)) {
          skipped++;
          continue;
        }

        // PRIORITY 2: Check joinLocks SECOND (prevents concurrent join attempts)
        // This catches joins that are in progress but not yet in activeSessions
        if (joinLocksMap.has(meeting.id)) {
          skipped++;
          continue;
        }

        // PRIORITY 3: Check metadata LAST (least reliable due to database timing)
        // Only check if metadata says join was triggered
        const meta = meeting.metadata || {};
        if (meta && meta.botJoinTriggeredAt) {
          // If metadata says triggered, skip to avoid duplicates
          // (Even if no active session, it means join is in progress or failed)
          skipped++;
          continue;
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

        // Join meeting using MeetingBot
        console.log(`🤖 Joining meeting ${meeting.id} (${meeting.title})...`);
        
        const bot = new MeetingBot({
          meetUrl: link,
          botName: process.env.BOT_NAME || 'Kairo Bot',
          durationMinutes: durationMinutes,
          meetingId: String(meeting.id),
          meetingTitle: meeting.title
        });

        const session = await bot.start();

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
 * Remove a meeting from active sessions without stopping (for cleanup)
 */
function removeFromActiveSessions(meetingId) {
  const removed = activeSessions.delete(meetingId);
  if (removed) {
    console.log(`Removed meeting ${meetingId} from active sessions`);
  }
  return removed;
}

/**
 * Stop a specific meeting session
 */
async function stopMeetingSession(meetingId) {
  console.log(`\n🛑 [stopMeetingSession] Attempting to stop meeting ${meetingId}...`);
  console.log(`   Active sessions: ${Array.from(activeSessions.keys()).join(', ') || 'none'}`);
  console.log(`   Looking for session with key: ${meetingId} (type: ${typeof meetingId})`);
  
  const session = activeSessions.get(meetingId);
  
  if (!session) {
    console.log(`⚠️ [stopMeetingSession] No active session found for meeting ${meetingId}`);
    console.log(`   Available session IDs: ${Array.from(activeSessions.keys()).map(id => `${id} (${typeof id})`).join(', ') || 'none'}`);
    return false;
  }
  
  if (!session.stop || typeof session.stop !== 'function') {
    console.error(`❌ [stopMeetingSession] Session found but stop() method is missing or not a function`);
    console.error(`   Session type: ${typeof session}`);
    console.error(`   Session keys: ${Object.keys(session).join(', ')}`);
    activeSessions.delete(meetingId);
    return false;
  }
  
  try {
    console.log(`🛑 [stopMeetingSession] Calling session.stop() for meeting ${meetingId}...`);
    await session.stop();
    activeSessions.delete(meetingId);
    console.log(`✅ [stopMeetingSession] Bot session stopped successfully for meeting ${meetingId}`);
    console.log(`   Remaining active sessions: ${Array.from(activeSessions.keys()).join(', ') || 'none'}`);
    return true;
  } catch (error) {
    console.error(`❌ [stopMeetingSession] Error stopping bot session for meeting ${meetingId}:`, error);
    console.error(`   Error stack:`, error.stack);
    activeSessions.delete(meetingId); // Remove from active sessions even on error
    return false;
  }
}

/**
 * Lock mechanism functions to prevent duplicate join requests
 */
function getJoinLocks() {
  return joinLocks;
}

function setJoinLock(meetingId) {
  // Atomic check-and-set: if lock already exists, return false
  // If lock doesn't exist, set it and return true
  if (joinLocks.has(meetingId)) {
    return false; // Lock already exists
  }
  joinLocks.set(meetingId, Date.now());
  console.log(`🔒 [Lock] Set join lock for meeting ${meetingId}`);
  return true; // Lock was successfully set
}

function clearJoinLock(meetingId) {
  const removed = joinLocks.delete(meetingId);
  if (removed) {
    console.log(`🔓 [Lock] Cleared join lock for meeting ${meetingId}`);
  }
  return removed;
}

module.exports = autoJoinMeetings;
module.exports.getActiveSessions = getActiveSessions;
module.exports.stopMeetingSession = stopMeetingSession;
module.exports.removeFromActiveSessions = removeFromActiveSessions;
// Export activeSessions Map so routes can add sessions to it
module.exports.activeSessions = activeSessions;
// Export lock mechanism functions
module.exports.getJoinLocks = getJoinLocks;
module.exports.setJoinLock = setJoinLock;
module.exports.clearJoinLock = clearJoinLock;


