const prisma = require("../lib/prisma");
const meetingEmbeddingService = require("../services/MeetingEmbeddingService");

/**
 * Perform a semantic search on the workspace's meeting memories
 */
exports.semanticSearch = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { query, limit = 10 } = req.query;

    if (!workspaceId || isNaN(parseInt(workspaceId))) {
      return res.status(400).json({ error: "Valid workspace ID is required." });
    }

    if (!query || query.trim().length === 0) {
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
      query.trim(),
      parseInt(limit)
    );

    res.json({
      success: true,
      query: query.trim(),
      results
    });
  } catch (error) {
    console.error("Error in semantic search:", error);
    res.status(500).json({ error: "An error occurred while performing semantic search." });
  }
};
