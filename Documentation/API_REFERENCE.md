# Kairo — API Reference

**Base URL:** `http://localhost:5000` (development) — replace with your deployed backend URL in production.  
**API prefix:** All REST endpoints are under `/api`.  
**Authentication:** All protected endpoints require an `Authorization: Bearer <token>` header. Obtain a token from `POST /api/auth/login`.  
**Content-Type:** `application/json` for all request and response bodies unless noted otherwise (file upload endpoints use `multipart/form-data`).

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Workspaces](#2-workspaces)
3. [Meetings](#3-meetings)
4. [Transcripts and Speaker Diarization](#4-transcripts-and-speaker-diarization)
5. [AI Insights](#5-ai-insights)
6. [Action Items](#6-action-items)
7. [Tasks and Kanban](#7-tasks-and-kanban)
8. [Memory and Knowledge Graph](#8-memory-and-knowledge-graph)
9. [Speakers and Voice Enrollment](#9-speakers-and-voice-enrollment)
10. [Notifications](#10-notifications)
11. [Reminders](#11-reminders)
12. [Calendar Integration](#12-calendar-integration)
13. [File Uploads](#13-file-uploads)
14. [WebSocket Events](#14-websocket-events)
15. [Health Check](#15-health-check)
16. [Error Format](#16-error-format)

---

## 1. Authentication

Base path: `/api/auth`

### POST `/api/auth/signup`

Register a new user account.

**Request body**

```json
{
  "name": "Areeba Khan",
  "email": "areeba@example.com",
  "password": "SecurePassword123!"
}
```

**Response `201`**

```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "name": "Areeba Khan",
    "email": "areeba@example.com"
  }
}
```

---

### POST `/api/auth/login`

Authenticate an existing user and receive a JWT.

**Request body**

```json
{
  "email": "areeba@example.com",
  "password": "SecurePassword123!"
}
```

**Response `200`**

```json
{
  "token": "<jwt>",
  "user": { "id": 1, "name": "Areeba Khan", "email": "areeba@example.com" }
}
```

---

### GET `/api/auth/me` 🔒

Return the authenticated user's profile.

**Response `200`**

```json
{
  "id": 1,
  "name": "Areeba Khan",
  "email": "areeba@example.com",
  "profilePictureUrl": "https://...",
  "audioSampleUrl": "https://...",
  "biometricConsent": true,
  "isActive": true
}
```

---

### PUT `/api/auth/me` 🔒

Update display name, bio, or profile picture URL.

**Request body** (all fields optional)

```json
{
  "name": "Areeba K.",
  "bio": "Product lead at Kairo.",
  "profilePictureUrl": "https://..."
}
```

**Response `200`** — Updated user object.

---

### PUT `/api/auth/me/preferences` 🔒

Update per-user app preferences (timezone, language, default view, etc.).

**Request body**

```json
{
  "timezone": "Asia/Karachi",
  "language": "en",
  "defaultMeetingView": "kanban"
}
```

**Response `200`** — Updated preferences object.

---

### PUT `/api/auth/me/notifications` 🔒

Update notification settings toggles.

**Request body**

```json
{
  "emailActionItems": true,
  "inAppReminders": true,
  "meetingStartAlert": false
}
```

**Response `200`** — Updated `NotificationSettings` object.

---

### PUT `/api/auth/me/password` 🔒

Change the authenticated user's password.

**Request body**

```json
{
  "currentPassword": "OldPassword1!",
  "newPassword": "NewPassword2!"
}
```

**Response `200`**

```json
{ "message": "Password updated successfully." }
```

---

### POST `/api/auth/logout` 🔒

Invalidate the current session.

**Response `200`**

```json
{ "message": "Logged out." }
```

---

### GET `/api/auth/verify` 🔒

Verify that the current JWT is valid and not expired.

**Response `200`**

```json
{ "valid": true, "userId": 1 }
```

---

## 2. Workspaces

Base path: `/api/workspaces`

### GET `/api/workspaces` 🔒

List all workspaces the authenticated user belongs to.

**Response `200`**

```json
[
  {
    "id": 10,
    "name": "Engineering",
    "role": "admin",
    "memberCount": 8,
    "createdAt": "2026-01-15T09:00:00Z"
  }
]
```

---

### POST `/api/workspaces` 🔒

Create a new workspace. The creator is assigned the `owner` role.

**Request body**

```json
{
  "name": "Product Team",
  "description": "Cross-functional product workspace."
}
```

**Response `201`** — Created workspace object.

---

### GET `/api/workspaces/:workspaceId` 🔒

Get workspace details including member count and settings.

**Response `200`** — Workspace object with nested settings.

---

### PUT `/api/workspaces/:workspaceId` 🔒

Update workspace name, description, or settings. Requires `admin` or `owner` role.

---

### DELETE `/api/workspaces/:workspaceId` 🔒

Permanently delete a workspace and all associated data. Requires `owner` role.

---

### POST `/api/workspaces/:workspaceId/join` 🔒

Join a workspace using an invite code.

**Request body**

```json
{ "inviteCode": "abc123xyz" }
```

---

### POST `/api/workspaces/:workspaceId/invite` 🔒

Send a workspace invitation by email. Requires `admin` or `owner` role.

**Request body**

```json
{
  "email": "newmember@example.com",
  "role": "member"
}
```

---

### GET `/api/workspaces/:workspaceId/members` 🔒

List all workspace members with their roles and enrollment status.

**Response `200`**

```json
[
  {
    "userId": 3,
    "name": "Hafsa Malik",
    "email": "hafsa@example.com",
    "role": "member",
    "voiceEnrolled": true,
    "joinedAt": "2026-02-01T10:00:00Z"
  }
]
```

---

### GET `/api/workspaces/:workspaceId/members/search?q=` 🔒

Search workspace members by name or email. Used by task assignee lookups.

---

### GET `/api/workspaces/:workspaceId/dashboard` 🔒

Return workspace dashboard summary — recent meetings, open action items, task counts.

---

### GET `/api/workspaces/:workspaceId/analytics` 🔒

Return full workspace analytics data across four dimensions (overview, participants, action items, insights). Accepts query parameters:

| Parameter | Type | Description |
|---|---|---|
| `range` | string | `7d`, `30d`, `90d`, `all` |
| `from` | ISO date | Start date filter |
| `to` | ISO date | End date filter |

---

### GET `/api/workspaces/:workspaceId/logs` 🔒

Return paginated workspace activity audit log.

| Parameter | Type | Default |
|---|---|---|
| `page` | number | 1 |
| `limit` | number | 20 |

---

### POST `/api/workspaces/:workspaceId/archive` 🔒

Archive a workspace (soft-delete). Requires `owner` role.

---

## 3. Meetings

Base path: `/api/meetings`

### GET `/api/meetings/workspace/:workspaceId` 🔒

List all meetings in a workspace. Supports filtering and sorting.

| Parameter | Type | Description |
|---|---|---|
| `status` | string | `scheduled`, `in-progress`, `completed` |
| `from` | ISO date | Start date filter |
| `to` | ISO date | End date filter |
| `page` | number | Pagination page |
| `limit` | number | Results per page (default 20) |

**Response `200`**

```json
[
  {
    "id": 55,
    "title": "Q3 Planning",
    "status": "completed",
    "startTime": "2026-05-01T10:00:00Z",
    "endTime": "2026-05-01T11:15:00Z",
    "durationMinutes": 75,
    "participantCount": 6,
    "meetingSource": "google-calendar"
  }
]
```

---

### POST `/api/meetings` 🔒

Create a meeting record.

**Request body**

```json
{
  "workspaceId": 10,
  "title": "Sprint Review",
  "meetingUrl": "https://meet.google.com/abc-defg-hij",
  "scheduledAt": "2026-05-20T14:00:00Z"
}
```

---

### GET `/api/meetings/:meetingId` 🔒

Get full meeting details including participants, notes count, and AI insights status.

---

### PUT `/api/meetings/:meetingId` 🔒

Update meeting title, scheduled time, or meeting URL.

---

### DELETE `/api/meetings/:meetingId` 🔒

Delete a meeting and all associated data. Requires `admin` or `owner` role.

---

### POST `/api/meetings/:meetingId/bot-join` 🔒

Instruct the Kairo Puppeteer bot to join the meeting URL. The bot handles audio capture and real-time transcription.

**Response `200`**

```json
{ "message": "Bot joining meeting.", "botSessionId": "uuid-..." }
```

---

### GET `/api/meetings/:meetingId/statistics` 🔒

Return meeting-level statistics — duration, word count, speaker count, talk-time breakdown.

---

### GET `/api/meetings/:meetingId/participants` 🔒

List all detected and confirmed participants for a meeting.

---

### PATCH `/api/meetings/:meetingId/privacy-mode` 🔒

Toggle privacy mode on or off during a live meeting. When enabled, audio chunks are dropped at the transcription layer and the current timestamp interval is recorded.

**Request body**

```json
{ "enabled": true }
```

**Response `200`**

```json
{
  "privacyMode": true,
  "interval": { "start": "2026-05-10T14:32:00Z", "end": null }
}
```

---

### POST `/api/meetings/:meetingId/whisper/trigger` 🔒

Manually trigger a Whisper Mode micro-recap for a live meeting, bypassing the scheduled interval. Generates a 2–3 sentence recap via Groq and broadcasts it over WebSocket.

**Response `200`**

```json
{
  "recap": "The team is currently debating deployment strategies...",
  "timestamp": "2026-05-10T14:35:12Z",
  "forced": true
}
```

---

### POST `/api/meetings/:meetingId/reprocess` 🔒

Trigger a full reprocess: re-run diarization, speaker matching, AI insights, and memory embeddings. Useful after manual speaker assignment changes. Requires `admin` or `owner` role.

---

### POST `/api/meetings/:meetingId/regenerate-embeddings` 🔒

Regenerate memory embeddings for a meeting without re-running diarization or AI insights.

---

## 4. Transcripts and Speaker Diarization

### GET `/api/meetings/:meetingId/transcript` 🔒

Return the finalized diarized transcript with resolved speaker names.

**Response `200`**

```json
{
  "meetingId": 55,
  "utterances": [
    {
      "chunkIndex": 0,
      "speaker": "Hafsa Malik",
      "speakerLabel": "SPEAKER_00",
      "identificationTier": "biometric",
      "text": "Let us start with the backlog review.",
      "startTime": 0.0,
      "endTime": 3.2
    }
  ],
  "diarized": true
}
```

**Identification tier values:** `biometric` (green), `manual` (amber), `historical` (blue), `unresolved` (no badge).

---

### GET `/api/meetings/:meetingId/transcript/live` 🔒

Return the current live transcript state during an active meeting (REST fallback; real-time delivery is over WebSocket).

---

## 5. AI Insights

### GET `/api/meetings/:meetingId/insights` 🔒

Return all AI-generated insights for a completed meeting.

**Response `200`**

```json
{
  "meetingId": 55,
  "insights": {
    "summary": {
      "executive_summary": "The team agreed to defer the Q3 launch...",
      "paragraph_summary": "...",
      "bullet_points": ["Deferred Q3 launch", "Assigned DB migration to Hafsa"]
    },
    "decisions": [
      { "decision": "Migrate database to Supabase", "impact": "High", "confidence": 0.94 }
    ],
    "topics": [
      { "topic": "Database Migration", "confidence": 0.97, "startTime": "00:05:12" }
    ],
    "sentiment": {
      "overall": "Positive",
      "score": 0.78,
      "perSpeaker": { "Hafsa Malik": "Neutral", "Areeba Khan": "Positive" }
    },
    "actionItems": [
      {
        "id": 12,
        "title": "Prepare migration script",
        "assignee": "Hafsa Malik",
        "dueDate": "2026-05-20",
        "priority": "high",
        "confidence": 0.91,
        "status": "pending"
      }
    ],
    "participants": [
      {
        "speaker": "Hafsa Malik",
        "speakingTimeSeconds": 420,
        "utteranceCount": 38,
        "engagementScore": 0.85
      }
    ]
  },
  "generatedAt": "2026-05-10T15:02:00Z"
}
```

---

### POST `/api/meetings/:meetingId/insights/regenerate` 🔒

Discard existing insights and re-run the full parallel agent pipeline. Requires `admin` or `owner` role.

**Response `202`**

```json
{ "message": "Insight regeneration queued." }
```

---

## 6. Action Items

Base path: `/api/action-items`

### GET `/api/action-items/meetings/:meetingId` 🔒

List all action items extracted for a meeting.

**Response `200`**

```json
[
  {
    "id": 12,
    "title": "Prepare migration script",
    "description": "Write and test the Supabase migration.",
    "assignee": "Hafsa Malik",
    "dueDate": "2026-05-20T00:00:00Z",
    "priority": "high",
    "confidence": 0.91,
    "status": "pending",
    "taskId": null,
    "canonicalKey": "prepare-migration-script-hafsa"
  }
]
```

---

### PUT `/api/action-items/:itemId/confirm` 🔒

Confirm an action item. Automatically creates a linked Task in the workspace Kanban board with parsed deadline and priority.

**Response `200`**

```json
{
  "actionItem": { "id": 12, "status": "confirmed" },
  "task": {
    "id": 88,
    "title": "Prepare migration script",
    "columnId": 3,
    "dueDate": "2026-05-20T00:00:00Z",
    "priority": "high"
  }
}
```

---

### PUT `/api/action-items/:itemId/reject` 🔒

Reject an action item (marks as `rejected`; no task is created).

---

### GET `/api/action-items/pending` 🔒

Return all pending action items across all workspace meetings the user has access to.

---

### GET `/api/action-items/live/:meetingId` 🔒

Return action items detected so far during an ongoing live meeting (periodically updated by the live extraction cron).

---

## 7. Tasks and Kanban

### Kanban Columns

#### GET `/api/workspaces/:workspaceId/kanban/columns` 🔒

List all Kanban columns for a workspace in display order.

**Response `200`**

```json
[
  { "id": 1, "title": "To-Do", "order": 0, "isDefault": true },
  { "id": 2, "title": "In Progress", "order": 1, "isDefault": true },
  { "id": 3, "title": "Done", "order": 2, "isDefault": true }
]
```

#### POST `/api/workspaces/:workspaceId/kanban/columns` 🔒

Create a custom column. Requires `admin` or `owner` role.

**Request body**

```json
{ "title": "Review", "order": 3 }
```

#### PUT `/api/workspaces/:workspaceId/kanban/columns/:columnId` 🔒

Rename a column or update its order position.

#### DELETE `/api/workspaces/:workspaceId/kanban/columns/:columnId` 🔒

Delete a custom column. Tasks in the column are moved to the first default column. Requires `admin` or `owner` role.

---

### Tasks

#### GET `/api/workspaces/:workspaceId/tasks` 🔒

List all tasks in a workspace. Supports filtering.

| Parameter | Type | Description |
|---|---|---|
| `columnId` | number | Filter by Kanban column |
| `assigneeId` | number | Filter by assigned user |
| `priority` | string | `low`, `medium`, `high`, `urgent` |
| `tag` | string | Filter by tag name |
| `dueBefore` | ISO date | Tasks due before this date |

**Response `200`**

```json
[
  {
    "id": 88,
    "title": "Prepare migration script",
    "description": "...",
    "columnId": 1,
    "priority": "high",
    "assigneeId": 3,
    "assigneeName": "Hafsa Malik",
    "dueDate": "2026-05-20T00:00:00Z",
    "tags": [{ "id": 5, "name": "Backend", "color": "#3B82F6" }],
    "actionItemId": 12,
    "meetingContext": null
  }
]
```

#### POST `/api/workspaces/:workspaceId/tasks` 🔒

Create a task manually.

**Request body**

```json
{
  "title": "Update API docs",
  "description": "Reflect new memory endpoints.",
  "columnId": 1,
  "priority": "medium",
  "assigneeId": 3,
  "dueDate": "2026-05-25T00:00:00Z",
  "tagIds": [5]
}
```

#### PUT `/api/tasks/:taskId` 🔒

Update any task field. Inline edit from `TaskDetailModal`.

#### DELETE `/api/tasks/:taskId` 🔒

Delete a task. `owner` and `admin` can delete any task; `member` can only delete tasks they created.

#### PATCH `/api/tasks/:taskId/move` 🔒

Move a task to a different column (drag-and-drop persistence).

**Request body**

```json
{ "columnId": 2, "order": 1 }
```

#### GET `/api/tasks/:taskId/context` 🔒

Return the originating meeting context for a task (summary excerpt, transcript snippet, decisions, notes, memory-channel badges). Only available for tasks created from confirmed action items.

**Response `200`**

```json
{
  "taskId": 88,
  "meeting": {
    "id": 55,
    "title": "Q3 Planning",
    "startTime": "2026-05-01T10:00:00Z"
  },
  "summaryExcerpt": "The team agreed to defer the Q3 launch...",
  "transcriptSnippet": "Hafsa: We need to finish the migration before launch.",
  "decisions": ["Migrate database to Supabase"],
  "notes": ["Check pgvector compatibility first."],
  "memoryChannels": ["transcript", "summary", "action_item"]
}
```

---

### Tags

#### GET `/api/workspaces/:workspaceId/tags` 🔒

List all workspace tags.

#### POST `/api/workspaces/:workspaceId/tags` 🔒

Create a tag.

**Request body**

```json
{ "name": "Backend", "color": "#3B82F6" }
```

---

## 8. Memory and Knowledge Graph

Base path: `/api/workspaces/:workspaceId/memory`

### GET `/api/workspaces/:workspaceId/memory/search` 🔒

Perform a hybrid semantic + full-text search across all meeting content in a workspace.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | yes | Search query |
| `limit` | number | no | Max results (default 10) |
| `from` | ISO date | no | Filter meetings after this date |
| `to` | ISO date | no | Filter meetings before this date |

**Response `200`**

```json
{
  "query": "database migration",
  "results": [
    {
      "meetingId": 55,
      "meetingTitle": "Q3 Planning",
      "startTime": "2026-05-01T10:00:00Z",
      "snippet": "...decided to migrate the database to Supabase...",
      "matchedTerms": ["database", "migration"],
      "similarityScore": 91,
      "searchType": "hybrid"
    }
  ]
}
```

---

### POST `/api/workspaces/:workspaceId/memory/chat` 🔒

Submit a natural language query grounded in workspace meeting memory. Returns an LLM-generated answer with source citations.

**Request body**

```json
{ "message": "What decisions were made about the API last month?" }
```

**Response `200`**

```json
{
  "answer": "In the May 1st Q3 Planning meeting, the team decided to...",
  "sources": [
    { "meetingId": 55, "meetingTitle": "Q3 Planning", "relevance": 0.94 }
  ]
}
```

---

### GET `/api/workspaces/:workspaceId/memory/graph` 🔒

Return the full workspace knowledge graph (nodes and edges). Graph is assembled at query time with a 60-second TTL cache.

**Response `200`**

```json
{
  "nodes": [
    { "id": "meeting:55", "type": "meeting", "label": "Q3 Planning", "date": "2026-05-01" },
    { "id": "task:88", "type": "task", "label": "Prepare migration script" },
    { "id": "context:55", "type": "memory", "label": "Database migration discussion" }
  ],
  "edges": [
    { "source": "meeting:55", "target": "task:88", "type": "produced" },
    { "source": "meeting:55", "target": "context:55", "type": "has_context" }
  ]
}
```

---

### GET `/api/workspaces/:workspaceId/memory/graph/stats` 🔒

Return graph statistics — node counts by type, edge counts, density metrics.

---

### GET `/api/workspaces/:workspaceId/memory/graph/node/:nodeId/neighbours` 🔒

Return the BFS subgraph of neighbours up to `depth` hops from a given node. Used for click-to-expand in the knowledge graph.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `depth` | number | 1 | BFS expansion depth (max 3) |

**Response `200`**

```json
{
  "nodeId": "meeting:55",
  "depth": 1,
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

---

### GET `/api/workspaces/:workspaceId/memory/meetings/:meetingId/context` 🔒

Return the structured memory context for a specific meeting (topics, decisions, action-item summaries, participants, prose context, transcript snippet).

---

### GET `/api/workspaces/:workspaceId/memory/meetings/:meetingId/related` 🔒

Return meetings related to the given meeting by semantic similarity. Prefers `meeting_relationships` table rows; falls back to on-demand cosine similarity on summary embeddings.

**Response `200`**

```json
[
  {
    "meetingId": 48,
    "title": "API Architecture Review",
    "startTime": "2026-04-15T11:00:00Z",
    "similarityScore": 0.89
  }
]
```

---

### GET `/api/workspaces/:workspaceId/memory/member-insights` 🔒

Return per-member participation and contribution statistics derived from memory contexts.

---

## 9. Speakers and Voice Enrollment

Base path: `/api/speakers`

### POST `/api/speakers/consent/grant` 🔒

Record the authenticated user's explicit consent to biometric voice enrollment.

**Response `200`**

```json
{ "consentGranted": true, "consentGrantedAt": "2026-05-12T18:00:00Z" }
```

---

### POST `/api/speakers/validate-audio` 🔒

Validate an audio sample's quality (SNR check) before enrollment. Returns pass/fail and the measured SNR in dB.

**Content-Type:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `audio` | file | WAV or MP3, minimum 15 seconds |

**Response `200`**

```json
{
  "valid": true,
  "snrDb": 24.5,
  "durationSeconds": 18.3,
  "message": "Audio quality is acceptable for enrollment."
}
```

---

### POST `/api/speakers/enroll` 🔒

Enroll the authenticated user's voice. Extracts a 192-dimensional ECAPA-TDNN embedding and stores it in `user_voice_embeddings`.

**Content-Type:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `audio` | file | WAV or MP3, 15–30 seconds, validated SNR |

**Response `200`**

```json
{
  "enrolled": true,
  "embeddingCount": 1,
  "lastEmbeddingUpdated": "2026-05-12T18:05:00Z"
}
```

---

### GET `/api/speakers/workspace/:workspaceId/enrolled` 🔒

List all workspace members who have enrolled voice embeddings (used by `LiveSpeakerIdentifier` at meeting start).

---

### GET `/api/speakers/meetings/:meetingId` 🔒

Get all speaker identity mappings for a meeting — maps `SPEAKER_XX` labels to resolved user names with identification tier metadata.

**Response `200`**

```json
[
  {
    "speakerLabel": "SPEAKER_00",
    "resolvedName": "Hafsa Malik",
    "userId": 3,
    "tier": "biometric",
    "confidence": 0.84
  },
  {
    "speakerLabel": "SPEAKER_01",
    "resolvedName": null,
    "userId": null,
    "tier": "unresolved",
    "confidence": null
  }
]
```

---

### POST `/api/speakers/meetings/:meetingId/assign` 🔒

Manually assign a speaker label to a workspace member (Tier 4 manual assignment). Triggers cascade name propagation across transcript, insights, action items, and memory embeddings, then broadcasts a `speaker_identified` WebSocket event.

**Request body**

```json
{
  "speakerLabel": "SPEAKER_01",
  "userId": 5
}
```

**Response `200`**

```json
{
  "assigned": true,
  "speakerLabel": "SPEAKER_01",
  "resolvedName": "Areeba Khan",
  "cascadeComplete": true
}
```

---

## 10. Notifications

Base path: `/api/notifications`

### GET `/api/notifications` 🔒

List notifications for the authenticated user (paginated).

| Parameter | Type | Default |
|---|---|---|
| `page` | number | 1 |
| `limit` | number | 20 |
| `unreadOnly` | boolean | false |

**Response `200`**

```json
[
  {
    "id": "uuid-...",
    "type": "task_reminder",
    "title": "Task Due Soon",
    "body": "Prepare migration script is due in 1 hour.",
    "read": false,
    "createdAt": "2026-05-20T13:00:00Z"
  }
]
```

---

### GET `/api/notifications/unread-count` 🔒

Return the count of unread notifications (used for navbar badge).

**Response `200`**

```json
{ "count": 3 }
```

---

### PUT `/api/notifications/:notificationId/read` 🔒

Mark a specific notification as read.

---

### PUT `/api/notifications/read-all` 🔒

Mark all notifications as read.

---

### DELETE `/api/notifications/:notificationId` 🔒

Delete a notification.

---

## 11. Reminders

Base path: `/api/reminders`

### GET `/api/reminders/preferences` 🔒

Return the authenticated user's reminder preferences (advance intervals, quiet hours).

**Response `200`**

```json
{
  "advanceIntervals": [1440, 60],
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00",
  "enabled": true
}
```

---

### PUT `/api/reminders/preferences` 🔒

Update reminder preferences.

**Request body**

```json
{
  "advanceIntervals": [1440, 60, 15],
  "quietHoursStart": "23:00",
  "quietHoursEnd": "08:00"
}
```

---

### GET `/api/reminders/upcoming` 🔒

List upcoming scheduled reminders for tasks with deadlines.

---

### POST `/api/reminders/test` 🔒

Send a test reminder notification to verify the delivery pipeline.

---

## 12. Calendar Integration

Base path: `/api/calendar`

> Requires `ENABLE_CALENDAR_INTEGRATION=true` in the environment. Routes are not mounted when the flag is absent or false.

### GET `/api/calendar/status` 🔒

Return whether the user has an active calendar connection.

**Response `200`**

```json
{ "connected": true, "provider": "google", "lastSyncAt": "2026-05-12T17:45:00Z" }
```

---

### GET `/api/calendar/oauth/google/start` 🔒

Initiate the Google OAuth 2.0 consent flow. Redirects the browser to the Google consent page.

---

### GET `/api/calendar/oauth/google/callback`

OAuth 2.0 callback handler — exchanges the authorization code for tokens, stores the `CalendarConnection`, and redirects the frontend to `?calendar=connected`.

---

### GET `/api/calendar/connections` 🔒

List all calendar connections for the authenticated user.

---

### POST `/api/calendar/connections/:connectionId/sync` 🔒

Trigger an immediate calendar sync for a connection, upsetting Google Calendar events as Kairo `Meeting` rows.

---

### DELETE `/api/calendar/connections/:connectionId` 🔒

Disconnect and delete a calendar connection. Removes tokens and stops cron sync for this connection.

---

## 13. File Uploads

Base path: `/api/upload`

All file upload endpoints use `multipart/form-data`.

### POST `/api/upload/profile-picture` 🔒

Upload a profile picture. Returns the public URL stored in Supabase.

| Field | Type |
|---|---|
| `image` | file (JPEG, PNG, WebP; max 5MB) |

**Response `200`**

```json
{ "url": "https://supabase.co/storage/v1/object/public/profiles/..." }
```

---

### POST `/api/meetings/:meetingId/files` 🔒

Upload a file attachment to a meeting.

| Field | Type |
|---|---|
| `file` | file (any type; max 50MB) |

**Response `201`**

```json
{
  "id": "uuid-...",
  "filename": "slides.pdf",
  "size": 1048576,
  "url": "https://...",
  "uploadedAt": "2026-05-10T14:00:00Z"
}
```

---

### GET `/api/meetings/:meetingId/files` 🔒

List all files attached to a meeting.

---

### DELETE `/api/meetings/:meetingId/files/:fileId` 🔒

Delete a file attachment.

---

## 14. WebSocket Events

**Connection URL:** `ws://localhost:5000/ws/transcript`

**Authentication:** Pass the JWT as a query parameter on connection:  
`ws://localhost:5000/ws/transcript?token=<jwt>`

All messages are JSON. Clients are routed to per-meeting rooms via a `join` message.

### Client → Server

#### Join a meeting room

```json
{ "type": "join", "meetingId": 55 }
```

#### Leave a meeting room

```json
{ "type": "leave", "meetingId": 55 }
```

---

### Server → Client

#### `transcript` — Live transcript chunk

Emitted for each ~3-second audio chunk processed by WhisperX.

```json
{
  "type": "transcript",
  "meetingId": 55,
  "chunkIndex": 14,
  "speaker": "SPEAKER_00",
  "text": "We should prioritize the migration.",
  "startTime": 42.1,
  "endTime": 45.3,
  "timestamp": "2026-05-10T14:32:42Z"
}
```

---

#### `live_speaker_update` — Real-time speaker label patch

Emitted after `LiveSpeakerIdentifier` resolves a speaker for a chunk via ECAPA-TDNN cosine similarity + sliding-window majority vote.

```json
{
  "type": "live_speaker_update",
  "meetingId": 55,
  "chunkIndex": 14,
  "speaker": "Hafsa Malik",
  "userId": 3,
  "confidence": 0.81
}
```

---

#### `speaker_identified` — Post-meeting speaker resolution complete

Emitted after `SpeakerMatchingEngine` finishes post-meeting biometric identification and cascade propagation.

```json
{
  "type": "speaker_identified",
  "meetingId": 55,
  "mappings": [
    { "speakerLabel": "SPEAKER_00", "resolvedName": "Hafsa Malik", "tier": "biometric" }
  ]
}
```

---

#### `whisper_recap` — Live meeting micro-recap

Emitted by `MicroSummaryService` on schedule or manual trigger.

```json
{
  "type": "whisper_recap",
  "meetingId": 55,
  "recap": "The team is finalizing the database migration timeline...",
  "timestamp": "2026-05-10T14:35:00Z",
  "forced": false
}
```

---

#### `task_mention` — Task title detected in transcript

Emitted by `TaskMentionService` when a linked task's title is detected in the live transcript stream (throttled per `TASK_MENTION_WS_THROTTLE_MS`).

```json
{
  "type": "task_mention",
  "meetingId": 55,
  "taskId": 88,
  "taskTitle": "Prepare migration script",
  "chunkIndex": 22,
  "timestamp": "2026-05-10T14:38:10Z"
}
```

---

#### `meeting_status` — Lifecycle state change

```json
{
  "type": "meeting_status",
  "meetingId": 55,
  "status": "completed",
  "timestamp": "2026-05-10T15:00:00Z"
}
```

---

## 15. Health Check

### GET `/`

Returns a JSON health payload. No authentication required.

**Response `200`**

```json
{
  "status": "ok",
  "service": "Kairo API",
  "timestamp": "2026-05-12T13:00:00Z"
}
```

---

## 16. Error Format

All error responses use a consistent JSON envelope:

```json
{
  "error": "Human-readable error message.",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common HTTP Status Codes

| Code | Meaning |
|---|---|
| `400` | Bad request — missing or invalid parameters |
| `401` | Unauthorized — missing, invalid, or expired JWT |
| `403` | Forbidden — authenticated but insufficient role |
| `404` | Resource not found |
| `409` | Conflict — duplicate resource (e.g. already enrolled) |
| `422` | Unprocessable entity — validation failed |
| `429` | Rate limited — too many requests |
| `500` | Internal server error |
| `503` | Service unavailable — AI subprocess or external LLM unavailable |

### Authentication Error Responses

| Scenario | Status | Error message |
|---|---|---|
| No `Authorization` header | `401` | `"Access token required"` |
| Malformed or invalid token | `401` | `"Invalid token"` |
| Expired token | `401` | `"Token expired"` |
| Valid token but user deleted/inactive | `401` | `"Invalid or inactive user"` |
| Valid token but insufficient workspace role | `403` | `"Insufficient permissions"` |
