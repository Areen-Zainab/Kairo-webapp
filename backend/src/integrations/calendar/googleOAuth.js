/**
 * integrations/calendar/googleOAuth.js
 * Thin wrapper around the Google OAuth2 client.
 * All credentials come from environment variables; nothing is hard-coded.
 */

const { google } = require('googleapis');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

/**
 * Build a fresh OAuth2 client.
 * Call this per-request so credentials are always current.
 */
function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI  // e.g. http://localhost:5000/api/calendar/oauth/google/callback
  );
}

/**
 * Generate the Google consent URL for a given user.
 * @param {number} userId  – embedded in state for CSRF / routing
 * @returns {string}       – full redirect URL to send the browser to
 */
function getAuthUrl(userId) {
  const client = buildOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',   // get refresh_token
    prompt: 'consent',        // force consent so we always get refresh_token
    scope: SCOPES,
    state: Buffer.from(JSON.stringify({ userId })).toString('base64'),
  });
}

/**
 * Exchange an authorization code for tokens.
 * @param {string} code
 * @returns {{ access_token, refresh_token, expiry_date, ... }}
 */
async function exchangeCodeForTokens(code) {
  const client = buildOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

/**
 * Build an authenticated OAuth2 client from stored tokens.
 * @param {{ accessToken: string, refreshToken: string, expiryDate: Date|null }} connection
 * @returns {google.auth.OAuth2}
 */
function buildAuthedClient(connection) {
  const client = buildOAuth2Client();
  client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expiry_date: connection.expiryDate ? new Date(connection.expiryDate).getTime() : undefined,
  });

  // Persist refreshed tokens automatically
  client.on('tokens', (tokens) => {
    // Caller must handle persisting; we just log here.
    if (tokens.refresh_token) {
      console.log('[googleOAuth] Received new refresh_token (should be persisted)');
    }
  });

  return client;
}

/**
 * Revoke all tokens for a connection (on disconnect).
 */
async function revokeTokens(accessToken) {
  try {
    const client = buildOAuth2Client();
    await client.revokeToken(accessToken);
    console.log('[googleOAuth] Token revoked successfully');
  } catch (err) {
    // Non-fatal — token may already be expired
    console.warn('[googleOAuth] Token revoke failed (may already be expired):', err.message);
  }
}

module.exports = {
  buildOAuth2Client,
  buildAuthedClient,
  getAuthUrl,
  exchangeCodeForTokens,
  revokeTokens,
};
