const express = require("express");
const controller = require("../controllers/memoryController");
const { authenticateToken } = require("../middleware/auth");

// Must use mergeParams: true to access :workspaceId from the parent router (server.js)
const router = express.Router({ mergeParams: true });

// Search route: GET /api/workspaces/:workspaceId/memory/search?q=query
router.get("/search", authenticateToken, controller.semanticSearch);

module.exports = router;
