const prisma = require("../lib/prisma");
const meetingEmbeddingService = require("../services/MeetingEmbeddingService");

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
