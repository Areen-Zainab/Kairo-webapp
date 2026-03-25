const prisma = require('../lib/prisma');
const MicroSummaryService = require('../services/MicroSummaryService');

let isRunning = false;

function parseMaxMeetingsPerTick() {
  const raw = process.env.WHISPER_MODE_MAX_MEETINGS_PER_TICK;
  const n = raw ? parseInt(raw, 10) : 5;
  return Number.isFinite(n) && n > 0 ? n : 5;
}

/**
 * WhisperMode cron tick:
 * - Finds currently active meetings (`status: in-progress` and `endTime >= now`)
 * - Attempts to generate a micro-recap for meetings that are due
 *
 * This job is intentionally isolated: it does not broadcast WebSocket messages and does not touch UI.
 */
async function runWhisperMode() {
  const whisperEnabled = process.env.WHISPER_MODE_ENABLED === 'true';
  if (!whisperEnabled) {
    return { success: true, skipped: true, reason: 'WHISPER_MODE_ENABLED=false' };
  }

  if (isRunning) {
    return { success: true, skipped: true, reason: 'WhisperMode job already running' };
  }

  isRunning = true;
  try {
    const now = new Date();
    const maxMeetingsPerTick = parseMaxMeetingsPerTick();

    // Query only meetings that are likely still active.
    const meetings = await prisma.meeting.findMany({
      where: {
        status: 'in-progress',
        endTime: {
          gte: now
        }
      },
      select: {
        id: true,
        status: true,
        endTime: true,
        startTime: true,
        metadata: true
      },
      orderBy: {
        startTime: 'asc'
      },
      take: maxMeetingsPerTick
    });

    if (!meetings || meetings.length === 0) {
      return { success: true, processed: 0, generated: 0, skipped: 0 };
    }

    const svc = new MicroSummaryService();

    let processed = 0;
    let generated = 0;
    let skipped = 0;

    // Sequential execution avoids stampeding the Groq API.
    for (const meeting of meetings) {
      processed++;
      try {
        const res = await svc.maybeGenerateMicroRecap(meeting.id, meeting);
        if (res?.generated) generated++;
        else skipped++;
      } catch (err) {
        skipped++;
        // Keep cron job resilient: one meeting failure must not break the tick.
        console.error(`❌ [WhisperMode] Failed for meeting ${meeting.id}:`, err?.message || err);
      }
    }

    return { success: true, processed, generated, skipped };
  } finally {
    isRunning = false;
  }
}

module.exports = runWhisperMode;

