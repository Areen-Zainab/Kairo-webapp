const prisma = require("../lib/prisma");
const meetingEmbeddingService = require("../services/MeetingEmbeddingService");
const memoryCache = require("../services/memoryCache");
const memoryContextService = require("../services/MemoryContextService");
const memoryGraphAssemblyService = require("../services/MemoryGraphAssemblyService");
const meetingMemoryChatService = require("../services/MeetingMemoryChatService");
const { getLiveTranscriptEntries } = require("../utils/meetingFileStorage");

const HIGHLIGHT_STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "two", "way", "who", "boy", "did", "had", "let", "put", "say", "she", "too", "use",
  "what", "when", "where", "which", "from", "that", "this", "with", "have", "were", "will", "into", "about", "them", "they", "their", "your", "does", "then", "than", "also", "just", "some"
]);

/**
 * Prefer a window around the first literal match of the query or any term (embedding chunks are long).
 */
function buildSnippetAroundMatch(content, effectiveQuery, terms, maxLen = 320) {
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) return "";
  if (text.length <= maxLen) return text;

  const lower = text.toLowerCase();
  const qNorm = String(effectiveQuery || "").trim().toLowerCase().replace(/\s+/g, " ");
  let bestPos = -1;

  if (qNorm.length >= 2) {
    const idx = lower.indexOf(qNorm);
    if (idx >= 0) bestPos = idx;
  }

  const sortedTerms = [...(terms || [])].map((t) => String(t || "").trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const t of sortedTerms) {
    if (t.length < 2) continue;
    const idx = lower.indexOf(t.toLowerCase());
    if (idx >= 0 && (bestPos < 0 || idx < bestPos)) bestPos = idx;
  }

  if (bestPos < 0) {
    return text.length > maxLen ? `${text.slice(0, maxLen).trim()}…` : text;
  }

  const half = Math.floor(maxLen / 2);
  let start = Math.max(0, bestPos - half);
  let end = Math.min(text.length, start + maxLen);
  if (end - start < maxLen) start = Math.max(0, end - maxLen);

  if (start > 0) {
    const sp = text.lastIndexOf(" ", start);
    if (sp > start - 48 && sp >= 0) start = sp + 1;
  }

  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

/**
 * Perform a hybrid (semantic + full-text) search on the workspace's meeting memories
 */
exports.semanticSearch = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { q, query, limit = 10 } = req.query;
    const effectiveQuery = (typeof q === "string" && q.trim().length > 0)
      ? q.trim()
      : (typeof query === "string" ? query.trim() : "");

    if (!workspaceId || isNaN(parseInt(workspaceId))) {
      return res.status(400).json({ error: "Valid workspace ID is required." });
    }

    if (!effectiveQuery) {
      return res.status(400).json({ error: "Search query is required." });
    }

    // Ensure the user is a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: parseInt(workspaceId),
          userId: req.user.id
        }
      }
    });

    if (!membership || !membership.isActive) {
      return res.status(403).json({ error: "You do not have access to this workspace." });
    }

    // Terms for client highlighting (2+ chars so "ui", "qa", etc. still mark when present in text)
    const matchedTerms = effectiveQuery
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/gi, ""))
      .filter((w) => w.length >= 2 && !HIGHLIGHT_STOP_WORDS.has(w));

    // Use hybrid search (pgvector + FTS)
    const results = await meetingEmbeddingService.hybridSearchWorkspaceMeetings(
      parseInt(workspaceId),
      effectiveQuery,
      Math.max(parseInt(limit) * 5, parseInt(limit))
    );

    // Format results and dedupe so each meeting appears once (best match wins).
    const formattedResults = (results || []).map((r) => {
      const content = typeof r.content === "string" ? r.content : "";
      const snippet = buildSnippetAroundMatch(content, effectiveQuery, matchedTerms, 320);

      return {
        id: r.id,
        meetingId: r.meeting_id,
        meetingTitle: r.meeting_title,
        meetingStartTime: r.start_time,
        contentType: r.content_type,
        snippet,
        content,
        distance: typeof r.distance === "number" ? r.distance : Number(r.distance),
        matchedTerms  // pass query terms so frontend can highlight without reparsing
      };
    });

    const meetingBest = new Map();
    for (const r of formattedResults) {
      const key = String(r.meetingId);
      const existing = meetingBest.get(key);
      if (!existing || (typeof r.distance === "number" && r.distance < existing.distance)) {
        meetingBest.set(key, r);
      }
    }

    const dedupedResults = Array.from(meetingBest.values())
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      query: effectiveQuery,
      results: dedupedResults
    });
  } catch (error) {
    console.error("Error in semantic search:", error);
    res.status(500).json({ error: "An error occurred while performing semantic search." });
  }
};

/**
 * Ask a memory-aware chat question for this workspace.
 * POST /api/workspaces/:workspaceId/memory/chat
 */
exports.chatAnswer = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const workspaceIdInt = parseInt(workspaceId, 10);
    const { question, meetingId, chatHistory = [], limit = 8 } = req.body || {};

    if (Number.isNaN(workspaceIdInt)) {
      return res.status(400).json({ error: "Valid workspace ID is required." });
    }

    const questionText = typeof question === 'string' ? question.trim() : '';
    if (!questionText) {
      return res.status(400).json({ error: "Question is required." });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceIdInt,
          userId: req.user.id
        }
      }
    });

    if (!membership || !membership.isActive) {
      return res.status(403).json({ error: "You do not have access to this workspace." });
    }

    let meetingIdInt = null;
    if (meetingId != null && meetingId !== '') {
      meetingIdInt = parseInt(meetingId, 10);
      if (!Number.isNaN(meetingIdInt)) {
        const meeting = await prisma.meeting.findUnique({
          where: { id: meetingIdInt },
          select: { id: true, workspaceId: true }
        });

        if (!meeting || meeting.workspaceId !== workspaceIdInt) {
          return res.status(404).json({ error: "Meeting not found in this workspace." });
        }
      }
    }

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 8, 3), 20);

    const semanticResults = await meetingEmbeddingService.hybridSearchWorkspaceMeetings(
      workspaceIdInt,
      questionText,
      safeLimit
    );

    const liveTranscriptEntries = meetingIdInt
      ? getLiveTranscriptEntries(meetingIdInt, null).slice(-25)
      : [];

    const llm = await meetingMemoryChatService.generateAnswer({
      question: questionText,
      semanticResults,
      liveTranscriptEntries,
      chatHistory
    });

    const sourceItems = (semanticResults || []).slice(0, safeLimit).map((r) => ({
      meetingId: r.meeting_id,
      meetingTitle: r.meeting_title,
      contentType: r.content_type,
      snippet: String(r.content || '').slice(0, 240)
    }));

    return res.json({
      success: true,
      question: questionText,
      answer: llm.answer,
      usedFallback: !!llm.usedFallback,
      model: llm.model,
      sources: sourceItems,
      sourceCount: sourceItems.length,
      liveContextCount: liveTranscriptEntries.length
    });
  } catch (error) {
    console.error("Error in memory chat answer:", error);
    return res.status(500).json({ error: "An error occurred while generating memory chat response." });
  }
};

/**
 * Fetch the Memory Engine context for a single meeting.
 * GET /api/workspaces/:workspaceId/memory/meetings/:meetingId/context
 */
exports.getMeetingContext = async (req, res) => {
  try {
    const { workspaceId, meetingId } = req.params;
    const workspaceIdInt = parseInt(workspaceId, 10);
    const meetingIdInt = parseInt(meetingId, 10);

    if (Number.isNaN(workspaceIdInt) || Number.isNaN(meetingIdInt)) {
      return res.status(400).json({ error: "Valid workspaceId and meetingId are required." });
    }

    // Ensure the user is a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: workspaceIdInt, userId: req.user.id }
      }
    });

    if (!membership || !membership.isActive) {
      return res.status(403).json({ error: "You do not have access to this workspace." });
    }

    // Ensure the meeting belongs to the workspace
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingIdInt },
      select: { id: true, workspaceId: true }
    });

    if (!meeting || meeting.workspaceId !== workspaceIdInt) {
      return res.status(404).json({ error: "Meeting not found in this workspace." });
    }

    const bypassCache = req.query.cache === "0";
    if (!bypassCache && memoryCache.TTL_MS > 0) {
      const cached = memoryCache.getContext(meetingIdInt);
      if (cached) {
        return res.json({ success: true, meetingId: meetingIdInt, context: cached, cached: true });
      }
    }

    const context = await memoryContextService.getMeetingContext(meetingIdInt);
    if (!context) {
      return res.status(404).json({ error: "Meeting context not found." });
    }

    if (!bypassCache && memoryCache.TTL_MS > 0) {
      memoryCache.setContext(meetingIdInt, context);
    }

    res.json({ success: true, meetingId: meetingIdInt, context, cached: false });
  } catch (error) {
    console.error("Error in getMeetingContext:", error);
    res.status(500).json({ error: "An error occurred while fetching meeting context." });
  }
};

/**
 * Fetch related meetings (if `meeting_relationships` is populated).
 * GET /api/workspaces/:workspaceId/memory/meetings/:meetingId/related
 */
exports.getRelatedMeetings = async (req, res) => {
  try {
    const { workspaceId, meetingId } = req.params;
    const workspaceIdInt = parseInt(workspaceId, 10);
    const meetingIdInt = parseInt(meetingId, 10);

    if (Number.isNaN(workspaceIdInt) || Number.isNaN(meetingIdInt)) {
      return res.status(400).json({ error: "Valid workspaceId and meetingId are required." });
    }

    // Ensure the user is a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: workspaceIdInt, userId: req.user.id }
      }
    });

    if (!membership || !membership.isActive) {
      return res.status(403).json({ error: "You do not have access to this workspace." });
    }

    // Ensure the meeting belongs to the workspace
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingIdInt },
      select: { id: true, workspaceId: true }
    });

    if (!meeting || meeting.workspaceId !== workspaceIdInt) {
      return res.status(404).json({ error: "Meeting not found in this workspace." });
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const safeLimit = Number.isNaN(limit) ? 10 : limit;
    const bypassCache = req.query.cache === "0";

    if (!bypassCache && memoryCache.TTL_MS > 0) {
      const cached = memoryCache.getRelated(meetingIdInt, safeLimit);
      if (cached) {
        return res.json({
          success: true,
          meetingId: meetingIdInt,
          relatedMeetings: cached,
          cached: true
        });
      }
    }

    const related = await memoryContextService.getRelatedMeetings(meetingIdInt, safeLimit);

    if (!bypassCache && memoryCache.TTL_MS > 0) {
      memoryCache.setRelated(meetingIdInt, safeLimit, related);
    }

    res.json({ success: true, meetingId: meetingIdInt, relatedMeetings: related, cached: false });
  } catch (error) {
    console.error("Error in getRelatedMeetings:", error);
    res.status(500).json({ error: "An error occurred while fetching related meetings." });
  }
};

/**
 * Memory Graph: workspace-scoped nodes/edges for the Memory Graph UI.
 * GET /api/workspaces/:workspaceId/memory/graph
 */
exports.getWorkspaceGraph = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const workspaceIdInt = parseInt(workspaceId, 10);

    if (Number.isNaN(workspaceIdInt)) {
      return res.status(400).json({ error: "Valid workspaceId is required." });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspaceIdInt, userId: req.user.id } }
    });
    if (!membership || !membership.isActive) {
      return res.status(403).json({ error: "You do not have access to this workspace." });
    }

    const limitMeetings = req.query.limitMeetings ? parseInt(req.query.limitMeetings, 10) : undefined;
    const limitNodes = req.query.limitNodes ? parseInt(req.query.limitNodes, 10) : undefined;
    const limitActions = req.query.limitActions ? parseInt(req.query.limitActions, 10) : undefined;

    const graphData = await memoryGraphAssemblyService.buildWorkspaceGraph(workspaceId, {
      limitMeetings,
      limitNodes,
      limitActions
    });

    res.json({ success: true, workspaceId, graphData });
  } catch (error) {
    console.error("Error in getWorkspaceGraph:", error);
    res.status(500).json({ error: "An error occurred while fetching workspace graph." });
  }
};

/**
 * Memory Graph: workspace stats used by MemoryView.
 * GET /api/workspaces/:workspaceId/memory/graph/stats
 */
exports.getWorkspaceGraphStats = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const workspaceIdInt = parseInt(workspaceId, 10);

    if (Number.isNaN(workspaceIdInt)) {
      return res.status(400).json({ error: "Valid workspaceId is required." });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspaceIdInt, userId: req.user.id } }
    });
    if (!membership || !membership.isActive) {
      return res.status(403).json({ error: "You do not have access to this workspace." });
    }

    // Build graph with the same caps as /graph so the cache is shared.
    const graphData = await memoryGraphAssemblyService.buildWorkspaceGraph(workspaceId, {
      limitMeetings: req.query.limitMeetings ? parseInt(req.query.limitMeetings, 10) : 10,
      limitNodes: req.query.limitNodes ? parseInt(req.query.limitNodes, 10) : 220,
      limitActions: req.query.limitActions ? parseInt(req.query.limitActions, 10) : 30
    });

    const stats = await memoryGraphAssemblyService.getWorkspaceStats(workspaceId, graphData);
    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error in getWorkspaceGraphStats:", error);
    res.status(500).json({ error: "An error occurred while fetching workspace graph stats." });
  }
};

/**
 * Memory Graph: subgraph centred on a single node up to `depth` hops.
 * GET /api/workspaces/:workspaceId/memory/graph/node/:nodeId/neighbours?depth=1
 */
exports.getNodeNeighbours = async (req, res) => {
  try {
    const { workspaceId, nodeId } = req.params;
    const workspaceIdInt = parseInt(workspaceId, 10);

    if (Number.isNaN(workspaceIdInt)) {
      return res.status(400).json({ error: "Valid workspaceId is required." });
    }

    if (!nodeId || typeof nodeId !== "string" || nodeId.trim().length === 0) {
      return res.status(400).json({ error: "Valid nodeId is required." });
    }

    // Cap depth at 3 to prevent runaway BFS on large graphs.
    const rawDepth = req.query.depth ? parseInt(req.query.depth, 10) : 1;
    const depth = Number.isNaN(rawDepth) ? 1 : Math.min(Math.max(rawDepth, 1), 3);

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspaceIdInt, userId: req.user.id } }
    });
    if (!membership || !membership.isActive) {
      return res.status(403).json({ error: "You do not have access to this workspace." });
    }

    const result = await memoryGraphAssemblyService.getNodeNeighbours(
      workspaceId,
      nodeId,
      depth
    );

    if (!result) {
      return res.status(404).json({ error: "Node not found in workspace graph." });
    }

    res.json({ success: true, workspaceId, nodeId, ...result });
  } catch (error) {
    console.error("Error in getNodeNeighbours:", error);
    res.status(500).json({ error: "An error occurred while fetching node neighbours." });
  }
};

/**
 * Meeting Tasks tab: board tasks from this meeting + pending action items not yet tasks.
 * GET /api/workspaces/:workspaceId/memory/meetings/:meetingId/tasks-panel
 */
exports.getMeetingTasksPanel = async (req, res) => {
  try {
    const workspaceIdInt = parseInt(req.params.workspaceId, 10);
    const meetingId = parseInt(req.params.meetingId, 10);

    if (Number.isNaN(workspaceIdInt) || Number.isNaN(meetingId)) {
      return res.status(400).json({ error: "Valid workspace and meeting IDs are required." });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspaceIdInt, userId: req.user.id } }
    });
    if (!membership || !membership.isActive) {
      return res.status(403).json({ error: "You do not have access to this workspace." });
    }

    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, workspaceId: workspaceIdInt },
      select: { id: true }
    });
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found in this workspace." });
    }

    const tasks = await prisma.task.findMany({
      where: {
        workspaceId: workspaceIdInt,
        actionItem: { is: { meetingId } }
      },
      include: {
        column: { select: { name: true } },
        actionItem: { select: { id: true, title: true, status: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    const pendingActionItems = await prisma.actionItem.findMany({
      where: {
        meetingId,
        status: "pending",
        task: null
      },
      orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        assignee: true,
        dueDate: true,
        lastSeenAt: true
      }
    });

    const formatTask = (t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      assignee: t.assignee,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      priority: t.priority,
      columnName: t.column?.name || null,
      actionItemId: t.actionItemId,
      updatedAt: t.updatedAt.toISOString()
    });

    const formatPending = (a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      assignee: a.assignee,
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
      lastSeenAt: a.lastSeenAt ? a.lastSeenAt.toISOString() : null
    });

    res.json({
      success: true,
      tasks: tasks.map(formatTask),
      pendingActionItems: pendingActionItems.map(formatPending)
    });
  } catch (error) {
    console.error("Error in getMeetingTasksPanel:", error);
    res.status(500).json({ error: "An error occurred while loading meeting tasks." });
  }
};

function normalizePersonLabel(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Member graph node: resolve workspace user + meetings + assigned tasks + stats.
 * GET /api/workspaces/:workspaceId/memory/member-insights?label=Display+Name
 */
exports.getMemberInsights = async (req, res) => {
  try {
    const workspaceIdInt = parseInt(req.params.workspaceId, 10);
    const label = typeof req.query.label === "string" ? req.query.label.trim() : "";

    if (Number.isNaN(workspaceIdInt)) {
      return res.status(400).json({ error: "Valid workspace ID is required." });
    }
    if (!label) {
      return res.status(400).json({ error: "Query parameter label is required." });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: workspaceIdInt, userId: req.user.id } }
    });
    if (!membership || !membership.isActive) {
      return res.status(403).json({ error: "You do not have access to this workspace." });
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: workspaceIdInt, isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    const normLabel = normalizePersonLabel(label);
    let matched = members.find((m) => normalizePersonLabel(m.user.name) === normLabel);
    if (!matched) {
      matched = members.find(
        (m) => m.user.email.toLowerCase() === label.toLowerCase()
      );
    }
    if (!matched && normLabel.length >= 2) {
      const words = normLabel.split(" ").filter((w) => w.length >= 2);
      if (words.length) {
        matched = members.find((m) => {
          const nn = normalizePersonLabel(m.user.name);
          return words.every((w) => nn.includes(w));
        });
      }
    }

    const isCompleteColumn = (name) => {
      const n = String(name || "").toLowerCase();
      return n.includes("complete") || n === "done";
    };

    if (!matched) {
      const tasksByAssignee = await prisma.task.findMany({
        where: {
          workspaceId: workspaceIdInt,
          assignee: { contains: label, mode: "insensitive" }
        },
        include: {
          column: { select: { name: true } },
          actionItem: {
            include: {
              meeting: { select: { id: true, title: true, startTime: true } }
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      });

      const completed = tasksByAssignee.filter((t) => isCompleteColumn(t.column?.name));
      const latestDone = completed[0] || null;

      return res.json({
        success: true,
        resolved: false,
        label,
        user: null,
        meetings: [],
        tasks: tasksByAssignee.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          assignee: t.assignee,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          priority: t.priority,
          columnName: t.column?.name || null,
          updatedAt: t.updatedAt.toISOString(),
          meetingId: t.actionItem?.meetingId || null,
          meetingTitle: t.actionItem?.meeting?.title || null
        })),
        stats: {
          meetingsAttended: 0,
          tasksAssigned: tasksByAssignee.length,
          tasksCompleted: completed.length,
          latestMeeting: null,
          latestCompletedTask: latestDone
            ? {
                id: latestDone.id,
                title: latestDone.title,
                updatedAt: latestDone.updatedAt.toISOString()
              }
            : null
        }
      });
    }

    const userId = matched.userId;
    const user = matched.user;

    const meetings = await prisma.meeting.findMany({
      where: {
        workspaceId: workspaceIdInt,
        participants: { some: { userId } }
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        status: true,
        duration: true
      },
      orderBy: { startTime: "desc" }
    });

    const tasks = await prisma.task.findMany({
      where: {
        workspaceId: workspaceIdInt,
        OR: [
          { assignee: { equals: user.name, mode: "insensitive" } },
          { assignee: { equals: user.email, mode: "insensitive" } }
        ]
      },
      include: {
        column: { select: { name: true } },
        actionItem: {
          include: {
            meeting: { select: { id: true, title: true, startTime: true } }
          }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    const completed = tasks.filter((t) => isCompleteColumn(t.column?.name));
    const latestDone = completed[0] || null;
    const latestMeeting = meetings[0] || null;

    res.json({
      success: true,
      resolved: true,
      label,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      meetings: meetings.map((m) => ({
        id: m.id,
        title: m.title,
        startTime: m.startTime.toISOString(),
        endTime: m.endTime ? m.endTime.toISOString() : null,
        status: m.status,
        duration: m.duration
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        assignee: t.assignee,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        priority: t.priority,
        columnName: t.column?.name || null,
        updatedAt: t.updatedAt.toISOString(),
        meetingId: t.actionItem?.meetingId || null,
        meetingTitle: t.actionItem?.meeting?.title || null
      })),
      stats: {
        meetingsAttended: meetings.length,
        tasksAssigned: tasks.length,
        tasksCompleted: completed.length,
        latestMeeting: latestMeeting
          ? {
              id: latestMeeting.id,
              title: latestMeeting.title,
              startTime: latestMeeting.startTime.toISOString()
            }
          : null,
        latestCompletedTask: latestDone
          ? {
              id: latestDone.id,
              title: latestDone.title,
              updatedAt: latestDone.updatedAt.toISOString()
            }
          : null
      }
    });
  } catch (error) {
    console.error("Error in getMemberInsights:", error);
    res.status(500).json({ error: "An error occurred while loading member insights." });
  }
};
