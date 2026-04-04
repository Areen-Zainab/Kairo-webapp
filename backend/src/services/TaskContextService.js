const prisma = require("../lib/prisma");
const memoryContextService = require("./MemoryContextService");

function normalizeDecisions(keyDecisions) {
  if (keyDecisions == null) return [];
  if (Array.isArray(keyDecisions)) {
    return keyDecisions
      .map((d) =>
        typeof d === "string"
          ? d
          : d.text || d.decision || d.title || (typeof d === "object" ? JSON.stringify(d) : String(d))
      )
      .filter(Boolean);
  }
  if (typeof keyDecisions === "object") {
    const v = keyDecisions.decisions || keyDecisions.items;
    if (Array.isArray(v)) return normalizeDecisions(v);
  }
  return [];
}

/**
 * Task-scoped view of meeting memory: enriched "Meeting Context" for TaskDetailModal
 * and optional micro-channel stats (embedding rows per content type).
 */
class TaskContextService {
  async getTaskMeetingContext(taskId, userId) {
    const taskIdInt = parseInt(taskId, 10);
    if (Number.isNaN(taskIdInt)) return { error: "invalid_task", status: 400 };

    const task = await prisma.task.findUnique({
      where: { id: taskIdInt },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        description: true,
        actionItemId: true,
        actionItem: {
          select: {
            meetingId: true,
            title: true,
            description: true,
            meeting: { select: { id: true, title: true } }
          }
        }
      }
    });

    if (!task) return { error: "not_found", status: 404 };

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: task.workspaceId, userId }
      }
    });

    if (!membership || !membership.isActive) {
      return { error: "forbidden", status: 403 };
    }

    const meetingId = task.actionItem?.meetingId;
    if (!meetingId) {
      return {
        success: true,
        taskId: taskIdInt,
        meetingId: null,
        meetingContext: null,
        microChannels: []
      };
    }

    const [fullMemory, noteRows, channelGroups] = await Promise.all([
      memoryContextService.getMeetingContext(meetingId),
      prisma.meetingNote.findMany({
        where: { meetingId },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: { content: true }
      }),
      prisma.meetingEmbedding.groupBy({
        by: ["contentType"],
        where: { meetingId },
        _count: { _all: true }
      })
    ]);

    const decisions = normalizeDecisions(fullMemory?.keyDecisions);
    const notesPreview = noteRows.map((n) => (n.content || "").trim()).filter(Boolean);

    const meetingContext = {
      meetingId: String(meetingId),
      meetingTitle:
        task.actionItem?.meeting?.title ||
        fullMemory?.meeting?.title ||
        "Meeting",
      transcriptSnippet: fullMemory?.transcriptSnippet || null,
      decisions,
      notes: notesPreview,
      summaryExcerpt:
        fullMemory?.meetingContext && fullMemory.meetingContext.length > 0
          ? fullMemory.meetingContext.length > 800
            ? `${fullMemory.meetingContext.slice(0, 800)}…`
            : fullMemory.meetingContext
          : null,
      actionItemTitle: task.actionItem?.title || null,
      actionItemDescription: task.actionItem?.description || null
    };

    const microChannels = (channelGroups || []).map((g) => ({
      contentType: g.contentType,
      count: g._count._all
    }));

    return {
      success: true,
      taskId: taskIdInt,
      meetingId,
      meetingContext,
      microChannels
    };
  }
}

module.exports = new TaskContextService();
