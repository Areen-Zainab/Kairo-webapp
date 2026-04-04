const prisma = require("../lib/prisma");
const { broadcastTaskMention } = require("./WebSocketServer");

const THROTTLE_MS = parseInt(process.env.TASK_MENTION_WS_THROTTLE_MS || "4000", 10);
const lastRunByMeeting = new Map();

/**
 * Best-effort: if live transcript text references a task title linked to this meeting,
 * broadcast a small WS event to clients subscribed to the meeting room.
 * Throttled per meeting to limit DB + fan-out work.
 */
async function maybeBroadcastTaskMentions(meetingId, chunkText, chunkIndex) {
  if (!meetingId || !chunkText || typeof chunkText !== "string") return;
  const mId =
    typeof meetingId === "string" ? parseInt(meetingId, 10) : meetingId;
  if (Number.isNaN(mId)) return;

  const now = Date.now();
  const last = lastRunByMeeting.get(mId) || 0;
  if (now - last < THROTTLE_MS) return;
  lastRunByMeeting.set(mId, now);

  const normalized = chunkText.toLowerCase();

  try {
    const tasks = await prisma.task.findMany({
      where: { actionItem: { meetingId: mId } },
      select: { id: true, title: true },
      take: 80
    });

    for (const t of tasks) {
      const title = (t.title || "").trim();
      if (title.length < 3) continue;
      const tl = title.toLowerCase();
      if (normalized.includes(tl)) {
        broadcastTaskMention(mId, {
          taskId: t.id,
          taskTitle: title,
          chunkIndex,
          snippet: chunkText.length > 280 ? `${chunkText.slice(0, 280)}…` : chunkText
        });
      }
    }
  } catch (e) {
    console.warn(`[TaskMentionService] mention scan failed for meeting ${mId}:`, e.message);
  }
}

module.exports = { maybeBroadcastTaskMentions };
