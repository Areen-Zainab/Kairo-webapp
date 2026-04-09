# Whisper Mode — Micro-Recaps During Live Meetings

**Last Updated:** March 26, 2026  
**Status:** ✅ Fully Implemented  
**Feature Owner:** Kairo Team

---

## Overview

Whisper Mode generates short, AI-powered micro-recaps (2–3 sentences) of recent meeting content at regular intervals. It serves two audiences:

- **Latecomers** who missed the start and need to catch up quickly.
- **Distracted participants** who want to re-orient without interrupting the meeting.

Recaps appear in a dedicated sidebar tab and are delivered both automatically (via a background cron job) and on-demand (via a "Catch Me Up" button).

---

## Architecture

```
 Automatic (Cron)                      Manual ("Catch Me Up" button)
       │                                           │
       ▼                                           ▼
 runWhisperMode.js               POST /api/meetings/:id/whisper/trigger
 (polls every N min)             (bypasses interval check; isManual=true)
       │                                           │
       └──────────────┬────────────────────────────┘
                      ▼
       MicroSummaryService.maybeGenerateMicroRecap()
                      │
       ┌──────────────┼──────────────────────────┐
       ▼              ▼                           ▼
 Read transcript   Call Groq API           Save to
 chunks from disk  (generate 2-3           meeting.metadata
 (last N minutes)   sentence recap)        .whisperMode.microRecaps
                      │
                      ▼
       WebSocketServer.broadcastWhisperRecap()
                      │
                      ▼
       useWhisperRecaps.ts (frontend hook)
                      │
       ┌──────────────┴──────────────────┐
       ▼                                 ▼
  WhisperRecapTab.tsx            toastSuccess notification
  (chat-like recap feed)         ("New meeting recap available")
```

---

## Backend Components

### `backend/src/services/MicroSummaryService.js`
The core generation engine.

**Key behaviour:**
- Reads the last `N` minutes of live transcript from disk (`chunk_*_transcript.txt`).
- Hashes the transcript to detect duplicate content — skips generation if the content hasn't changed.
- Calls Groq API to produce a 2–3 sentence plain-English recap.
- Persists the recap as an object `{ recapText, at, lastNMinutes }` appended to `meeting.metadata.whisperMode.microRecaps[]`.
- Trims the stored array to the last `MAX_STORED_RECAPS` items (default: 10).
- Broadcasts the fresh recap via `WebSocketServer.broadcastWhisperRecap()`.

**Signature:**
```js
maybeGenerateMicroRecap(meetingId, meeting, isManual = false)
// isManual=true bypasses the minimum interval check
```

**Returns:**
```js
{ generated: boolean, skipped: boolean, reason?: string, recapText?: string }
```

### `backend/src/jobs/runWhisperMode.js`
A cron job that polls all active meetings and triggers recap generation sequentially (to avoid Groq API rate limits).

- Registered in `backend/src/config/cron.js`.
- Gated by `WHISPER_MODE_ENABLED=true` in environment.

### `backend/src/routes/meetingRoutes.js` — Manual Trigger Endpoint
```
POST /api/meetings/:id/whisper/trigger
Authorization: Bearer <token>
```
- Checks workspace membership before triggering.
- Calls `MicroSummaryService.maybeGenerateMicroRecap(meetingId, meeting, true)`.
- Returns `{ success, message, recapText }` or `{ success: false, skipped: true, message }` if skipped.

### `backend/src/services/WebSocketServer.js` — `broadcastWhisperRecap()`
Pushes a `whisper_recap` event to all connected clients for a given meeting:
```json
{
  "type": "whisper_recap",
  "data": {
    "text": "The team discussed...",
    "timestamp": "2026-03-26T21:00:00.000Z"
  }
}
```

---

## Frontend Components

### `frontend/src/hooks/useWhisperRecaps.ts`
Manages all state for Whisper Mode on the frontend:

| Export | Type | Purpose |
|---|---|---|
| `recaps` | `WhisperRecap[]` | All recaps for this meeting |
| `loading` | `boolean` | Initial fetch state |
| `error` | `string \| null` | Error message if trigger fails |
| `triggering` | `boolean` | True while manual trigger is in-flight |
| `triggerCatchMeUp()` | `() => void` | Fires `POST /whisper/trigger` |
| `newRecapEvent` | `WhisperRecap \| null` | Flashes non-null whenever a new recap arrives (use for toasts) |

**Initialisation:** Fetches existing recaps from `meeting.metadata.whisperMode.microRecaps` on mount.  
**Real-time:** Connects a dedicated WebSocket to `/ws/transcript?meetingId=<id>` and filters for `type === 'whisper_recap'` messages.

### `frontend/src/components/meetings/meetingslive/WhisperRecapTab.tsx`
A chat-like scrollable panel rendering timestamped recap cards.
- Auto-scrolls to the latest recap as new ones arrive.
- Shows a skeleton loader during initial fetch.
- Shows an inline error state if the manual trigger is refused.
- Shows a "Generating..." spinner row while `triggering === true`.

### `frontend/src/pages/meetings/MeetingLive.tsx` — Integration Points
1. **"Catch Me Up" button** — Inserted in the Top Bar next to the Bot Controls dropdown. Hidden on xs screens (`hidden sm:flex`). Gradient purple when idle, muted when `triggering`.
2. **"Recaps" tab** — Added to the sidebar tab array (alongside Notes, Actions, Chat, Memory). Shows a count badge of how many recaps exist.
3. **Toast notification** — `useEffect` watches `newRecapEvent` and calls `toastSuccess('New meeting recap available', 'Whisper Mode')`.

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `WHISPER_MODE_ENABLED` | `false` | Master on/off switch. **Must be `true` to generate any recaps.** |
| `WHISPER_MODE_RECAP_INTERVAL_MINUTES` | `10` | Minimum gap between auto-recaps |
| `WHISPER_MODE_LAST_N_MINUTES` | `5` | How far back to look for transcript content |
| `WHISPER_MODE_TRANSCRIPT_MAX_CHARS` | `3000` | Max characters fed to Groq per recap |
| `WHISPER_MODE_MAX_STORED_RECAPS` | `10` | How many recaps are retained in `meeting.metadata` |

---

## What to Expect During a Test Meeting

| Scenario | Outcome |
|---|---|
| `WHISPER_MODE_ENABLED=false` | All triggers silently return `skipped`. No recaps generated. |
| Click "Catch Me Up" with no transcript yet | Button resets; brief error message shown in the Recaps tab |
| Click "Catch Me Up" with transcript data | Recap card appears in Recaps tab; toast fires |
| Auto-cron fires | Same as above, without user interaction |
| Second manual trigger immediately after first | Bypasses interval check (`isManual=true`) — generates again |
| Meeting has ended | Backend guard skips generation (`endTime < now`) |

> **Note:** Two WebSocket connections are held simultaneously during a meeting — one from `useLiveTranscript` and one from `useWhisperRecaps`. Both connect to the same server endpoint; the server supports multiple simultaneous clients per meeting without issue.

---

## Data Schema (stored in `meeting.metadata`)

```json
{
  "whisperMode": {
    "lastRecapAt": "2026-03-26T20:55:00.000Z",
    "lastTranscriptHash": "abc123...",
    "microRecaps": [
      {
        "recapText": "The team agreed to defer the API redesign ...",
        "at": "2026-03-26T20:45:00.000Z",
        "lastNMinutes": 5
      }
    ]
  }
}
```

---

## Optional Future Enhancements

- [ ] Topic-change detection: trigger a recap automatically when the conversation shifts topics.
- [ ] Richer recap content: include bullet-listed decisions and open questions in the generated text.
