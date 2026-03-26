const prisma = require("../lib/prisma");
const meetingEmbeddingService = require("../services/MeetingEmbeddingService");
const memoryContextService = require("../services/MemoryContextService");

/**
 * Perform a semantic search on the workspace's meeting memories
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

    // Call the embedding service to execute the vector search
    const results = await meetingEmbeddingService.searchWorkspaceMeetings(
      parseInt(workspaceId),
      effectiveQuery,
      // Pull more rows than requested since we dedupe by meeting below
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
        content, // keep full content for now (frontend can decide what to show)
        distance: typeof r.distance === "number" ? r.distance : Number(r.distance)
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
