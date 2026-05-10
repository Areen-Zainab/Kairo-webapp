# Calendar integration — feature and implementation

**Last updated:** May 10, 2026

This document describes **what** external calendar integration does in Kairo, **how** it is implemented at a high level, and where the **detailed implementation plan** (including the **ICS / CalDAV backup path**) lives for engineers who need step-by-step scope.

---

## 1. What the feature is

Kairo can **read** meetings from calendars the user already uses (Google Calendar, Microsoft 365 / Outlook, or—when needed—open-standard feeds). Those events can appear in **My Calendar** and meeting lists alongside Kairo-native meetings.

When an external event is **eligible** (for example it has a joinable video link, or the product allows “import all” style rules), Kairo can **materialize** it as a normal `Meeting` row. That matters because the rest of the product—**PreMeeting** timers, **auto-join** jobs, reminders, and existing meeting APIs—already assumes real `Meeting` records. Calendar integration does **not** introduce a second, parallel join pipeline; it **feeds** the same model.

If the integration module is **off** or the user has **no** connection, behavior stays as today: only Kairo-created meetings and task deadlines show where applicable.

---

## 2. Why two technical paths exist

**Primary path — OAuth to provider APIs:** The user connects **Google Calendar** or **Microsoft** once. The server stores tokens (encrypted), then calls each vendor’s **official calendar APIs** on a schedule. This path gives the freshest data, structured conference fields, and matches what most Workspace / Microsoft 365 users expect. It avoids **paid third-party “unified calendar” aggregators** (for example Nylas-style products); you pay in engineering and OAuth compliance, not per-seat aggregator fees.

**Backup path — open standards (ICS subscription URL and CalDAV):** Some users or organizations cannot or should not use cloud OAuth—self-hosted calendars, strict policies, or admins who disable secret iCal links. For them, Kairo supports **polling**: `GET` a private **ICS feed URL**, or sync via **CalDAV** with stored credentials. This path is **smaller in feature surface** and can be **slower** for plain ICS compared to live APIs, but it is the **safety net** and parity option for locked-down environments.

Both paths are **fully automatic after one-time setup**: there is no product plan to make users repeatedly download and upload calendar files.

---

## 3. User-facing behavior

- **Onboarding:** Steps invite the user to connect Google or Microsoft (OAuth). Advanced options can expose ICS URL and CalDAV for the backup path.
- **My Calendar:** Continues to load meetings from existing APIs; after sync, imported meetings appear in the same responses, distinguishable via `meetingSource` and optional `metadata.calendar` details.
- **Settings:** Lists connections, last sync time, errors, manual “Sync now,” and disconnect (including token revoke for OAuth).
- **Auto-join:** Unchanged at the job level if sync only creates/updates `Meeting` rows. Product policy may add toggles such as “auto-join synced meetings” so imported rows do not surprise users.

---

## 4. Implementation overview

### 4.1 Modularity

New code should live under a clear tree (for example `integrations/calendar`), behind a feature flag such as `ENABLE_CALENDAR_INTEGRATION`. Routes register only when the flag is on; core services avoid hard imports so the module can be removed in one change set without breaking transcription, RBAC, or the meeting bot.

### 4.2 Data model

Connections are modeled explicitly (for example a `CalendarConnection` table): type (`oauth_google`, `oauth_microsoft`, `ics_url`, `caldav`), enabled flag, sync cursors, and **encrypted** secrets (tokens, ICS URL, CalDAV credentials).

Per-meeting external identity should be stored in a structured way—commonly `Meeting.metadata.calendar` with `connectionId`, stable `uid`, optional recurrence id, and optional provider event id for OAuth deduplication—so multiple connections and idempotent upserts are possible without overloading the coarse `meetingSource` string alone.

### 4.3 Sync pipeline (both paths)

A **background job** runs on an interval per enabled connection:

1. **OAuth:** List or expand events in a time window via Google Calendar API / Microsoft Graph; map to the same internal event shape as ICS.
2. **ICS / CalDAV:** Fetch body or CalDAV report, parse **VEVENT** with a shared iCalendar library and recurrence expansion where needed.

**Common steps:** extract video URL (structured fields first for OAuth; URL property and description heuristics for ICS), set `meeting.platform`, decide whether to upsert a `Meeting`, handle recurrence and cancellations, dedupe by stable ids. Re-syncs **update in place**; cancelled or removed source events should not leave orphan join behavior.

### 4.4 API surface (conceptual)

REST endpoints under something like `/api/calendar/…` list connections, start OAuth, handle callbacks, create ICS/CalDAV connections (with a validation fetch), delete (and optionally clean future-only synced meetings), trigger manual sync, and expose feature availability. RBAC follows existing workspace / user ownership rules.

### 4.5 Frontend touchpoints

Key files in this repository include onboarding `CalendarStep.tsx`, `MyCalendar.tsx`, `PreMeeting.tsx` (external source labeling), and settings areas for connections. Use lazy loading for settings routes if bundle size matters when the feature is off.

### 4.6 Scheduler

Follow the same cron pattern as other jobs (for example `config/cron.js`): iterate enabled connections, run the appropriate fetch path, run the shared upsert pipeline, backoff on failures, surface errors in settings.

---

## 5. Security and operational notes

- Encrypt all long-lived secrets at rest; never log full ICS URLs or passwords.
- OAuth: minimum read-only calendar scopes; refresh on 401; revoke on disconnect.
- Time zones: normalize using API metadata for OAuth; respect `TZID` / floating rules for ICS.

---

## 6. Related code (repository)

- `backend/prisma/schema.prisma` — `Meeting` model and `meetingSource`.
- `backend/src/jobs/autoJoinMeetings.js` — auto-join assumptions.
- `frontend/src/pages/meetings/PreMeeting.tsx` — pre-meeting UI.
- `frontend/src/pages/userProfile/MyCalendar.tsx` — calendar UI.
- `frontend/src/components/onboarding/CalendarStep.tsx` — onboarding.

---

## Appendix A — Backup path: ICS feed and CalDAV (plan reference)

This section preserves the **detailed backup-path plan** (Option 2) so ICS and CalDAV remain specified even as the main narrative above stays product- and architecture-focused.

### A.1 Mechanisms

| Mechanism | What it is | When to use it |
|-----------|------------|----------------|
| **ICS / iCal feed URL** | User pastes a **private subscription URL**; the server **periodically `GET`s** the URL and parses the feed. | Users who cannot use OAuth, or providers that expose a stable feed. |
| **CalDAV** | CalDAV **base URL** + **credentials**; sync over the standard **CalDAV** protocol. | Self-hosted / enterprise calendaring; teams that block cloud OAuth. |

**Implementation notes:** one **VEVENT** parser for `.ics` bodies (for example `ical.js`, `node-ical`, or `ical-expander` for recurrence). For CalDAV, a small client (for example `tsdav`) for `calendar-query`, sync-token, or `ctag` as supported.

**Trade-offs vs OAuth:** Google private ICS feeds are often **delayed** vs live calendar; some Workspace admins **disable** secret iCal links—those users should prefer OAuth. CalDAV is usually better than raw ICS for self-hosted stacks.

### A.2 Option 1 vs Option 2 (quick reference)

| | Option 1 (OAuth) | Option 2 (ICS + CalDAV) |
|---|------------------|------------------------|
| **User supplies** | Clicks “Connect”; OAuth consent. | Feed URL, or CalDAV URL + credentials. |
| **Ongoing work** | None; server calls APIs and refreshes tokens. | None; server polls. |
| **Provider projects** | Required (Google Cloud, Azure/Entra app). | Not required for pure ICS. |
| **Typical update delay** | Generally best for Google/365. | ICS can be slow; CalDAV better. |
| **When** | Default implementation and primary UX. | Backup and self-hosted / policy edge cases. |

---

## Appendix B — Full implementation plan backup (phases, API table, checklist)

The following is the **archived implementation plan** (formerly a standalone plan document): goals, API examples, phased rollout, removal checklist, risks, and success criteria. Update this appendix when phases ship or OAuth provider requirements change.

### B.1 Goals and non-goals

**Goals**

- Show upcoming video meetings (and optional non-video blocks) in My Calendar from the user’s real calendar when configured.
- Optionally materialize eligible events as `Meeting` rows so existing flows (PreMeeting, auto-join, reminders) keep working—no parallel shadow join pipeline.
- **Option 1 (primary):** OAuth to **Google Calendar API** and **Microsoft Graph** (calendar read); implement first.
- **Option 2 (backup):** iCalendar over HTTP (ICS URL) and **CalDAV** for orgs that cannot use OAuth.
- **Modular / removable:** one feature flag, isolated backend namespace, UI entry points that can be disabled without breaking core Kairo.

**Non-goals**

- Paid unified calendar aggregator services (Nylas, Cronofy, etc.).
- Two-way full calendar write sync in v1; read + create/update `Meeting` from event is enough.
- Dropping Option 2 before launch is a product call; default is to keep backup for parity and locked-down orgs.

### B.2 Design principles

1. **Additive module:** avoid deep edits inside MeetingBot, transcription, or RBAC.
2. **No silent behavior change** when the module is off or disconnected.
3. **Idempotent sync:** stable external keys; re-syncs update in place.
4. **Single join authority:** only existing `Meeting` + metadata drives auto-join.

### B.3 OAuth path (Option 1) summary

| Aspect | Description |
|--------|-------------|
| **User** | Connect Google or Microsoft once; refresh tokens stored server-side (encrypted). |
| **Server** | Scheduled list/expand events in a window; map to `Meeting` with same upsert pipeline as backup path. |
| **Code shape** | Connection `type` values (`oauth_google`, `oauth_microsoft`); encrypted tokens; redirect/callback handlers; JSON list-events APIs. |

### B.4 Data model (recommended)

`Meeting` already supports `meetingSource`, times, recurrence, `meetingLink`, `platform`, `metadata` (Json).

**CalendarConnection** (example): `id`, `userId`, `workspaceId?`, `type`, `label`, `isEnabled`, `lastSyncAt`, `lastSyncError`, sync cursor fields; encrypted OAuth material or ICS URL / CalDAV credentials.

**Example `Meeting.metadata.calendar`:**

```json
{
  "calendar": {
    "connectionId": 12,
    "uid": "STABLE_ICS_UID_OR_API_ICALUID",
    "recurrenceId": "optional",
    "providerEventId": "optional_for_oauth_dedup"
  }
}
```

Enforce uniqueness via application logic or partial unique index; alternatively a nullable `external_uid` column on `Meeting`.

### B.5 From event to `Meeting` (both options)

1. Map OAuth events or parse VEVENT (`UID`, `DTSTART`, `DTEND`/`DURATION`, `RRULE`, `LOCATION`, `DESCRIPTION`, `URL`).
2. Extract video link (structured first for OAuth; URL / description heuristics for ICS).
3. Set `meeting.platform` from link.
4. Create `Meeting` if joinable link exists or if “import all events” product toggle applies.
5. Recurring: use API instances or `ical-expander` in a forward window; align with `isRecurring` / `recurrenceRule` where possible.
6. Dedupe and soft-cancel on cancellation or removal from source.

**Auto-join:** No change to join logic if sync only creates/updates rows; optional policy on `metadata.calendar` / user preference for auto-joining imports.

### B.6 API surface (example)

Mount when `ENABLE_CALENDAR_INTEGRATION=true`:

| Method | Path (example) | Purpose |
|--------|----------------|---------|
| GET | `/api/calendar/connections` | List connections (redact secrets). |
| GET | `/api/calendar/oauth/google/start` | Begin Google OAuth. |
| GET | `/api/calendar/oauth/google/callback` | Store tokens; create connection. |
| GET | `/api/calendar/oauth/microsoft/start` | Begin Microsoft OAuth. |
| GET | `/api/calendar/oauth/microsoft/callback` | Store tokens; create connection. |
| POST | `/api/calendar/connections` | Add ICS URL or CalDAV; validate with test fetch. |
| DELETE | `/api/calendar/connections/:id` | Remove; optional cleanup; revoke OAuth token. |
| POST | `/api/calendar/connections/:id/sync` | Manual sync. |
| GET | `/api/calendar/status` | Feature availability for frontend. |

### B.7 Phased rollout

| Phase | Scope | Outcome |
|-------|--------|--------|
| **P0** | Feature flag, `CalendarConnection`, **Google OAuth** + sync + `Meeting` upsert + UI | Shipped product path. |
| **P1** | **Microsoft OAuth**, refresh, disconnect/revoke, settings polish, multi-calendar if needed | Full primary provider coverage. |
| **P2 (backup)** | **ICS URL** + **CalDAV**; shared parser/upsert | Open-protocol users. |

**Tests:** static `.ics` strings or fixtures in-repo for parser/upsert only—not a user upload flow.

### B.8 Modular removal checklist

- Set `ENABLE_CALENDAR_INTEGRATION=false`.
- Stop calendar sync cron.
- Hide UI; table may remain empty.
- Full removal: delete integration tree, route registration, migration rollback in one PR; core `Meeting` and auto-join unchanged.

### B.9 Risks and mitigations

| Risk | Mitigation |
|------|------------|
| ICS URL leak if DB compromised | Encrypt; rotate user instructions; never return raw URL from API. |
| Duplicate meetings | Stable UID + recurrence id; unique strategy (see B.4). |
| Join storms | Existing dedupe; consider default manual join for imports until opt-in. |
| Time zones | ICS: normalize from `TZID` / floating; OAuth: API offsets. |
| OAuth token issues | Encrypt; refresh on 401; revoke on disconnect; minimum scopes. |

### B.10 Success criteria

- After one-time Google/Microsoft consent, the `Meeting` pipeline is fed from official APIs without repeated manual steps.
- With ICS or CalDAV (when P2 ships), events appear after background sync; joinable links yield usable `Meeting` rows with existing auto-join and reminders.
- Feature can be turned off in one config switch without breaking unrelated services.
- No paid unified third-party aggregator; vendor OAuth plus open parsers for backup suffices.

---

### Standards reference

- [iCalendar (RFC 5545)](https://icalendar.org/) — VEVENT and recurrence semantics for the backup parser path.
