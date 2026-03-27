const express = require("express");
const controller = require("../controllers/memoryController");
const { authenticateToken } = require("../middleware/auth");

// Must use mergeParams: true to access :workspaceId from the parent router (server.js)
const router = express.Router({ mergeParams: true });

// Search route: GET /api/workspaces/:workspaceId/memory/search?q=query
router.get("/search", authenticateToken, controller.semanticSearch);

// Memory Graph routes
router.get("/graph", authenticateToken, controller.getWorkspaceGraph);
router.get("/graph/stats", authenticateToken, controller.getWorkspaceGraphStats);
// Node-neighbour expansion — must be defined before any wildcard graph route
router.get("/graph/node/:nodeId/neighbours", authenticateToken, controller.getNodeNeighbours);

// Memory context endpoints (for graph node details)
router.get("/meetings/:meetingId/context", authenticateToken, controller.getMeetingContext);
router.get("/meetings/:meetingId/related", authenticateToken, controller.getRelatedMeetings);

module.exports = router;
