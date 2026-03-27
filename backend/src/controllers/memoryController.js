const prisma = require("../lib/prisma");
const meetingEmbeddingService = require("../services/MeetingEmbeddingService");
const memoryContextService = require("../services/MemoryContextService");
const memoryGraphAssemblyService = require("../services/MemoryGraphAssemblyService");

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

    // Extract meaningful terms from query (strip stop words shorter than 3 chars)
    const STOP_WORDS = new Set(['the','and','for','are','but','not','you','all','can','her','was','one','our','out','day','get','has','him','his','how','its','may','new','now','old','see','two','way','who','boy','did','had','let','put','say','she','too','use']);
    const matchedTerms = effectiveQuery
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-z0-9]/gi, ''))
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w));

    // Use hybrid search (pgvector + FTS)
    const results = await meetingEmbeddingService.hybridSearchWorkspaceMeetings(
      parseInt(workspaceId),
      effectiveQuery,
      Math.max(parseInt(limit) * 5, parseInt(limit))
    );

    // Format results and dedupe so each meeting appears once (best match wins).
    const formattedResults = (results || []).map((r) => {
      const content = typeof r.content === "string" ? r.content : "";
      const snippet = content.length > 200 ? `${content.slice(0, 200)}…` : content;

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

    const context = await memoryContextService.getMeetingContext(meetingIdInt);
    if (!context) {
      return res.status(404).json({ error: "Meeting context not found." });
    }

    res.json({ success: true, meetingId: meetingIdInt, context });
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
    const related = await memoryContextService.getRelatedMeetings(meetingIdInt, Number.isNaN(limit) ? 10 : limit);

    res.json({ success: true, meetingId: meetingIdInt, relatedMeetings: related });
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
