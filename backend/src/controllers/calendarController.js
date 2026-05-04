/**
 * controllers/calendarController.js
 *
 * Handles Google Calendar OAuth flow and connection lifecycle.
 *
 * Dependencies:
 *   - prisma (CalendarConnection model — see migration)
 *   - googleOAuth helpers
 *   - calendarSync engine
 */

const prisma = require('../lib/prisma');
const { getAuthUrl, exchangeCodeForTokens, revokeTokens } = require('../integrations/calendar/googleOAuth');
const { syncGoogleCalendar } = require('../integrations/calendar/calendarSync');
const { google } = require('googleapis');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Redact secrets before sending to frontend */
function safeConnection(conn) {
  const { accessToken, refreshToken, ...safe } = conn;
  return safe;
}

/** Decode the base64 state from Google's callback */
function decodeState(stateB64) {
  try {
    return JSON.parse(Buffer.from(stateB64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Resolve the best workspaceId for a user to attach synced meetings to.
 * Uses the first workspace where the user is an active member.
 */
async function resolveWorkspaceId(userId) {
  const member = await prisma.workspaceMember.findFirst({
    where: { userId, isActive: true },
    orderBy: { joinedAt: 'asc' },
  });
  return member?.workspaceId || null;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/calendar/oauth/google/start
 * Returns the Google consent URL (frontend can redirect or open a popup).
 */
async function googleOAuthStart(req, res) {
  try {
    const url = getAuthUrl(req.user.id);
    res.json({ url });
  } catch (err) {
    console.error('[calendarController] googleOAuthStart error:', err);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
}

/**
 * GET /api/calendar/oauth/google/callback
 * Handles the redirect from Google.
 * Exchanges the code → tokens, stores CalendarConnection, triggers first sync.
 */
async function googleOAuthCallback(req, res) {
  const { code, state, error: oauthError } = req.query;

  // User denied consent
  if (oauthError) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/profile-settings?calendar=denied`);
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state' });
  }

  const stateData = decodeState(state);
  if (!stateData?.userId) {
    return res.status(400).json({ error: 'Invalid state parameter' });
  }

  const userId = stateData.userId;

  try {
    // Exchange code → tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      // This happens when the user has already granted consent before.
      // We still have an access_token; try to update the existing connection.
      console.warn('[calendarController] No refresh_token in exchange — user may have already connected.');
    }

    // Fetch the user's Google email for the label
    let googleEmail = null;
    try {
      const { buildOAuth2Client } = require('../integrations/calendar/googleOAuth');
      const authClient = buildOAuth2Client();
      authClient.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
      const { data } = await oauth2.userinfo.get();
      googleEmail = data.email;
    } catch (infoErr) {
      console.warn('[calendarController] Could not fetch Google user info:', infoErr.message);
    }

    // Upsert CalendarConnection (one per google account per user)
    const existing = await prisma.calendarConnection.findFirst({
      where: { userId, type: 'oauth_google' },
    });

    let connection;
    const connData = {
      userId,
      type: 'oauth_google',
      label: googleEmail ? `Google (${googleEmail})` : 'Google Calendar',
      isEnabled: true,
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      providerAccountId: googleEmail,
      calendarId: 'primary',
      lastSyncError: null,
    };

    if (existing) {
      connection = await prisma.calendarConnection.update({
        where: { id: existing.id },
        data: connData,
      });
    } else {
      connection = await prisma.calendarConnection.create({
        data: connData,
      });
    }

    // Trigger first sync (non-blocking — don't fail the redirect if sync errors)
    const workspaceId = await resolveWorkspaceId(userId);
    if (workspaceId) {
      syncGoogleCalendar(userId, workspaceId, { connectionId: connection.id }).then((result) => {
        console.log(`[calendarController] Initial sync complete for user ${userId}:`, result);
      }).catch((err) => {
        console.error('[calendarController] Initial sync error:', err.message);
      });
    }

    // Redirect to frontend settings page with success signal
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/profile-settings?calendar=connected&provider=google`);
  } catch (err) {
    console.error('[calendarController] googleOAuthCallback error:', err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/profile-settings?calendar=error&msg=${encodeURIComponent(err.message)}`);
  }
}

/**
 * GET /api/calendar/connections
 * List all calendar connections for the current user (secrets redacted).
 */
async function listConnections(req, res) {
  try {
    const connections = await prisma.calendarConnection.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ connections: connections.map(safeConnection) });
  } catch (err) {
    console.error('[calendarController] listConnections error:', err);
    res.status(500).json({ error: 'Failed to list connections' });
  }
}

/**
 * POST /api/calendar/connections/:id/sync
 * Trigger an immediate sync for a specific connection.
 */
async function manualSync(req, res) {
  const connectionId = parseInt(req.params.id, 10);
  if (isNaN(connectionId)) return res.status(400).json({ error: 'Invalid connection ID' });

  try {
    const connection = await prisma.calendarConnection.findFirst({
      where: { id: connectionId, userId: req.user.id },
    });
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    const workspaceId = await resolveWorkspaceId(req.user.id);
    if (!workspaceId) return res.status(400).json({ error: 'No workspace found for sync' });

    const result = await syncGoogleCalendar(req.user.id, workspaceId, { connectionId });
    res.json({ success: true, result });
  } catch (err) {
    console.error('[calendarController] manualSync error:', err);
    res.status(500).json({ error: 'Sync failed', message: err.message });
  }
}

/**
 * DELETE /api/calendar/connections/:id
 * Disconnect: revoke Google token, delete connection row.
 * Leaves existing Meeting rows in place (just sourced from google-calendar).
 */
async function deleteConnection(req, res) {
  const connectionId = parseInt(req.params.id, 10);
  if (isNaN(connectionId)) return res.status(400).json({ error: 'Invalid connection ID' });

  try {
    const connection = await prisma.calendarConnection.findFirst({
      where: { id: connectionId, userId: req.user.id },
    });
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    // Revoke Google token (best-effort)
    if (connection.accessToken) {
      await revokeTokens(connection.accessToken);
    }

    await prisma.calendarConnection.delete({ where: { id: connectionId } });

    res.json({ success: true, message: 'Calendar disconnected' });
  } catch (err) {
    console.error('[calendarController] deleteConnection error:', err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
}

module.exports = {
  googleOAuthStart,
  googleOAuthCallback,
  listConnections,
  manualSync,
  deleteConnection,
};
