/**
 * routes/calendarRoutes.js
 *
 * Mounts only when ENABLE_CALENDAR_INTEGRATION=true.
 * All routes require authenticateToken (Kairo JWT).
 *
 * Endpoints:
 *   GET  /api/calendar/status                         – feature flag check
 *   GET  /api/calendar/connections                    – list user connections
 *   GET  /api/calendar/oauth/google/start             – begin Google OAuth
 *   GET  /api/calendar/oauth/google/callback          – handle code, store tokens
 *   POST /api/calendar/connections/:id/sync           – manual sync now
 *   DELETE /api/calendar/connections/:id              – disconnect + revoke
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const calendarController = require('../controllers/calendarController');

// ── Feature availability ──────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    enabled: process.env.ENABLE_CALENDAR_INTEGRATION === 'true',
    providers: ['google'],
  });
});

// ── OAuth: Google ─────────────────────────────────────────────────────────────
// Start: redirect browser to Google consent screen
router.get('/oauth/google/start', authenticateToken, calendarController.googleOAuthStart);

// Callback: Google redirects back here with ?code=...&state=...
// NOTE: This is a browser redirect so we don't use authenticateToken here;
// instead we validate the signed `state` that carries the userId.
router.get('/oauth/google/callback', calendarController.googleOAuthCallback);

// ── Connection management ─────────────────────────────────────────────────────
router.get('/connections', authenticateToken, calendarController.listConnections);
router.post('/connections/:id/sync', authenticateToken, calendarController.manualSync);
router.delete('/connections/:id', authenticateToken, calendarController.deleteConnection);

module.exports = router;
