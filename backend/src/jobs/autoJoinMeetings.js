const path = require('path');
const { spawn } = require('child_process');
const prisma = require('../lib/prisma');

/**
 * Auto-join job
 * - Finds meetings whose startTime has arrived and should be joined by the bot
 * - Spawns the headless meetService process with MEET_URL
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
        if (meta && meta.botJoinTriggeredAt) {
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

        const scriptPath = path.join(__dirname, '..', 'services', 'meetService.js');

        const isProd = process.env.NODE_ENV === 'production';
        const child = spawn(process.execPath, [scriptPath], {
          env: {
            ...process.env,
            MEET_URL: link,
            BOT_NAME: process.env.BOT_NAME || 'Kairo Bot',
            SHOW_BROWSER: isProd ? 'false' : 'true', // Headless in production for stability
            MEETING_ID: String(meeting.id),
            MEETING_TITLE: meeting.title || '',
            AUTO_MODE: 'true',
            DURATION_MINUTES: String(durationMinutes)
          },
          detached: isProd,
          stdio: isProd ? 'ignore' : 'inherit'
        });

        if (isProd) {
          child.unref();
        }

        // Mark as triggered to prevent duplicates; also set status to in-progress
        const newMetadata = { ...(meta || {}), botJoinTriggeredAt: new Date().toISOString(), botPid: child.pid };

        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            status: 'in-progress',
            metadata: newMetadata
          }
        });

        console.log(`🤖 Auto-join triggered for meeting ${meeting.id} (${meeting.title})`);
        triggered++;
      } catch (err) {
        console.error(`Auto-join error for meeting ${meeting.id}:`, err);
        errors.push({ meetingId: meeting.id, error: err.message });
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

module.exports = autoJoinMeetings;


