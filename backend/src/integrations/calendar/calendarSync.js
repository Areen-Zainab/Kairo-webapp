/**
 * integrations/calendar/calendarSync.js
 *
 * Core sync engine: fetches Google Calendar events and upserts them
 * as Kairo Meeting rows. Idempotent — re-runs do UPDATE in place.
 *
 * Supported: Google Calendar (OAuth).
 * Future: Microsoft Graph, ICS — same upsert pipeline.
 */

const { google } = require('googleapis');
const prisma = require('../../lib/prisma');
const { buildAuthedClient } = require('./googleOAuth');

// ── Video-link detection ─────────────────────────────────────────────────────

const MEET_RE = /https:\/\/meet\.google\.com\/[a-z0-9\-]+/i;
const ZOOM_RE = /https:\/\/[\w.]*zoom\.us\/[^\s"<>)]+/i;
const TEAMS_RE = /https:\/\/teams\.microsoft\.com\/[^\s"<>)]+/i;
const WEBEX_RE = /https:\/\/[\w.]*webex\.com\/[^\s"<>)]+/i;

function detectPlatform(url) {
  if (!url) return 'other';
  if (MEET_RE.test(url)) return 'google-meet';
  if (ZOOM_RE.test(url)) return 'zoom';
  if (TEAMS_RE.test(url)) return 'teams';
  if (WEBEX_RE.test(url)) return 'webex';
  return 'other';
}

/**
 * Extract the best video link from a Google Calendar API event object.
 * Checks: conferenceData → hangoutLink → location → description.
 */
function extractMeetingLink(event) {
  // 1. Structured conference data (most reliable)
  if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(
      (e) => e.entryPointType === 'video'
    );
    if (videoEntry?.uri) return videoEntry.uri;
  }

  // 2. Google Meet legacy field
  if (event.hangoutLink) return event.hangoutLink;

  // 3. Location field (some invites put Meet link there)
  const locMatch = event.location && (
    MEET_RE.exec(event.location) ||
    ZOOM_RE.exec(event.location) ||
    TEAMS_RE.exec(event.location)
  );
  if (locMatch) return locMatch[0];

  // 4. First matching URL in description
  if (event.description) {
    const descMatch =
      MEET_RE.exec(event.description) ||
      ZOOM_RE.exec(event.description) ||
      TEAMS_RE.exec(event.description) ||
      WEBEX_RE.exec(event.description);
    if (descMatch) return descMatch[0];
  }

  return null;
}

// ── Duration helpers ─────────────────────────────────────────────────────────

function durationMinutes(start, end) {
  const s = new Date(start.dateTime || start.date);
  const e = new Date(end.dateTime || end.date);
  return Math.max(1, Math.round((e - s) / 60000));
}

// ── Single-event upsert ──────────────────────────────────────────────────────

/**
 * Upsert one Google Calendar event as a Kairo Meeting row.
 *
 * De-duplication key stored in Meeting.metadata.calendar.uid
 * (combination of connection id + Google event iCalUID).
 *
 * @param {object} event          - raw Google Calendar API event
 * @param {object} connection     - CalendarConnection row from DB
 * @param {number} workspaceId    - target workspace
 * @param {number} userId         - acting user (createdById)
 */
async function upsertEvent(event, connection, workspaceId, userId) {
  // Skip cancelled events — soft-cancel any existing Meeting row
  if (event.status === 'cancelled') {
    await cancelByUid(connection.id, event.iCalUID, workspaceId);
    return { action: 'cancelled' };
  }

  // All-day events have `date` (no `dateTime`). Skip them unless they have a video link.
  const isAllDay = !event.start?.dateTime;
  const meetingLink = extractMeetingLink(event);

  if (isAllDay && !meetingLink) {
    return { action: 'skipped_allday' };
  }

  const startTime = new Date(event.start.dateTime || event.start.date);
  const endTime = new Date(event.end.dateTime || event.end.date);
  const duration = durationMinutes(event.start, event.end);
  const platform = meetingLink ? detectPlatform(meetingLink) : null;

  const calendarMeta = {
    calendar: {
      connectionId: connection.id,
      uid: event.iCalUID,
      providerEventId: event.id,
      recurrenceId: event.recurringEventId || null,
    },
  };

  // Check if a Meeting already exists for this UID + workspace
  const existing = await prisma.meeting.findFirst({
    where: {
      workspaceId,
      meetingSource: 'google-calendar',
      metadata: {
        path: ['calendar', 'uid'],
        equals: event.iCalUID,
      },
    },
  });

  if (existing) {
    // Update in place (idempotent)
    await prisma.meeting.update({
      where: { id: existing.id },
      data: {
        title: event.summary || 'Untitled Meeting',
        description: event.description || null,
        meetingLink,
        platform,
        location: event.location || null,
        startTime,
        endTime,
        duration,
        status: statusFromEvent(event, startTime, endTime),
        isRecurring: !!event.recurringEventId,
        recurrenceRule: event.recurrence?.[0] || null,
        metadata: { ...((existing.metadata) || {}), ...calendarMeta },
        updatedAt: new Date(),
      },
    });
    return { action: 'updated', meetingId: existing.id };
  } else {
    // Insert new Meeting row
    const created = await prisma.meeting.create({
      data: {
        workspaceId,
        title: event.summary || 'Untitled Meeting',
        description: event.description || null,
        meetingLink,
        platform,
        location: event.location || null,
        startTime,
        endTime,
        duration,
        meetingType: event.recurringEventId ? 'recurring' : 'scheduled',
        status: statusFromEvent(event, startTime, endTime),
        isRecurring: !!event.recurringEventId,
        recurrenceRule: event.recurrence?.[0] || null,
        createdById: userId,
        meetingSource: 'google-calendar',
        metadata: calendarMeta,
      },
    });
    return { action: 'created', meetingId: created.id };
  }
}

function statusFromEvent(event, startTime, endTime) {
  const now = new Date();
  if (event.status === 'cancelled') return 'cancelled';
  if (endTime < now) return 'completed';
  if (startTime <= now && now <= endTime) return 'in-progress';
  return 'scheduled';
}

async function cancelByUid(connectionId, uid, workspaceId) {
  if (!uid) return;
  await prisma.meeting.updateMany({
    where: {
      workspaceId,
      meetingSource: 'google-calendar',
      metadata: {
        path: ['calendar', 'uid'],
        equals: uid,
      },
      status: { not: 'cancelled' },
    },
    data: { status: 'cancelled' },
  });
}

// ── Main sync function ───────────────────────────────────────────────────────

/**
 * Sync all enabled Google Calendar connections for a user.
 *
 * @param {number} userId
 * @param {number} workspaceId
 * @param {object} [opts]
 * @param {number} [opts.connectionId]  – sync only a specific connection
 * @returns {{ synced, created, updated, skipped, errors }}
 */
async function syncGoogleCalendar(userId, workspaceId, opts = {}) {
  const where = {
    userId,
    type: 'oauth_google',
    isEnabled: true,
    ...(opts.connectionId ? { id: opts.connectionId } : {}),
  };

  const connections = await prisma.calendarConnection.findMany({ where });

  let created = 0, updated = 0, skipped = 0, errors = 0;

  for (const connection of connections) {
    try {
      const authClient = buildAuthedClient({
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        expiryDate: connection.expiryDate,
      });

      // Listen for token refresh so we can persist the new access token
      authClient.on('tokens', async (tokens) => {
        const updateData = { accessToken: tokens.access_token };
        if (tokens.expiry_date) updateData.expiryDate = new Date(tokens.expiry_date);
        if (tokens.refresh_token) updateData.refreshToken = tokens.refresh_token;
        await prisma.calendarConnection.update({
          where: { id: connection.id },
          data: updateData,
        });
      });

      const calendar = google.calendar({ version: 'v3', auth: authClient });

      // Time window: past 1 day to next 90 days
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 1);
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 90);

      let pageToken;
      do {
        const resp = await calendar.events.list({
          calendarId: connection.calendarId || 'primary',
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,        // expand recurring instances
          orderBy: 'startTime',
          maxResults: 250,
          pageToken,
        });

        const events = resp.data.items || [];
        for (const event of events) {
          try {
            const result = await upsertEvent(event, connection, workspaceId, userId);
            if (result.action === 'created') created++;
            else if (result.action === 'updated') updated++;
            else skipped++;
          } catch (eventErr) {
            console.error(`[calendarSync] Error upserting event ${event.id}:`, eventErr.message);
            errors++;
          }
        }

        pageToken = resp.data.nextPageToken;
      } while (pageToken);

      // Update last sync timestamp + clear any previous error
      await prisma.calendarConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncError: null,
        },
      });
    } catch (connErr) {
      console.error(`[calendarSync] Connection ${connection.id} sync failed:`, connErr.message);
      errors++;
      await prisma.calendarConnection.update({
        where: { id: connection.id },
        data: { lastSyncError: connErr.message },
      }).catch(() => {});
    }
  }

  return {
    synced: connections.length,
    created,
    updated,
    skipped,
    errors,
  };
}

module.exports = {
  syncGoogleCalendar,
  upsertEvent,
};
