/**
 * jobs/syncCalendars.js
 *
 * Background job: iterate all enabled CalendarConnections and sync them.
 * Called by cron.js on a schedule (e.g. every 15 minutes).
 *
 * For each user with a connected Google Calendar, we need their workspaceId.
 * We use their first active workspace; if a user has no workspace, we skip them.
 */

const prisma = require('../lib/prisma');
const { syncGoogleCalendar } = require('../integrations/calendar/calendarSync');

async function syncAllCalendars() {
  if (process.env.ENABLE_CALENDAR_INTEGRATION !== 'true') {
    return { success: true, skipped: 'feature_disabled' };
  }

  let totalSynced = 0, totalCreated = 0, totalUpdated = 0, totalErrors = 0;

  try {
    // Find all distinct users with enabled google calendar connections
    const distinctUsers = await prisma.calendarConnection.findMany({
      where: { type: 'oauth_google', isEnabled: true },
      select: { userId: true },
      distinct: ['userId'],
    });

    for (const { userId } of distinctUsers) {
      try {
        // Resolve primary workspace for this user
        const member = await prisma.workspaceMember.findFirst({
          where: { userId, isActive: true },
          orderBy: { joinedAt: 'asc' },
        });

        if (!member) {
          console.warn(`[syncCalendars] User ${userId} has no workspace — skipping`);
          continue;
        }

        const result = await syncGoogleCalendar(userId, member.workspaceId);
        totalSynced += result.synced;
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalErrors += result.errors;
      } catch (userErr) {
        console.error(`[syncCalendars] Error syncing user ${userId}:`, userErr.message);
        totalErrors++;
      }
    }

    return {
      success: true,
      synced: totalSynced,
      created: totalCreated,
      updated: totalUpdated,
      errors: totalErrors,
    };
  } catch (err) {
    console.error('[syncCalendars] Fatal error in syncAllCalendars:', err);
    return { success: false, error: err.message };
  }
}

module.exports = syncAllCalendars;
