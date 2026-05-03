# Calendar Integration — Implementation Plan (Final Iteration)

**Purpose:** Define a realistic, **modular**, and **removable** way to bring external calendars into Kairo without depending on **paid third-party calendar aggregators** (Nylas, Cronofy, etc.). **Primary integration:** OAuth to **Google Calendar** and **Microsoft Graph**. **Backup:** iCalendar/ICS and **CalDAV** for edge cases. The design plugs into `Meeting` records, `meetingSource`, auto-join / cron, and the **My Calendar** + onboarding UI.

**Last updated:** April 24, 2026

---

## 1. Goals and non-goals

### Goals

- Show **upcoming video meetings** (and optional non-video blocks) in **My Calendar** and meeting lists, sourced from the user’s real calendar when configured.
- Optionally **materialize** eligible events as Kairo `Meeting` rows so **existing** flows keep working: `PreMeeting` timers, `autoJoinMeetings` / bot join, reminders — **no parallel “shadow” join pipeline**.
- **Two ways to connect (both fully automatic after setup — no manual re-upload of files). Product default is OAuth; open-protocol paths are a backup.**
  - **Option 1 (primary) — OAuth (provider APIs):** **Google Calendar API** and **Microsoft Graph** (calendar read) after the user authorizes the app once; uses each vendor’s **free** API tier, not a paid “unified calendar” aggregator. **This is the method to implement first.**
  - **Option 2 (backup) — iCalendar over HTTP (ICS feed URL) and CalDAV:** for users or orgs that cannot or should not use OAuth (e.g. self-hosted calendars, or policies that favor feed URLs or CalDAV over cloud consent). Smaller feature set; polling-based. See [iCalendar (RFC 5545)](https://icalendar.org/).
- **Modular / removable:** one feature flag, isolated backend namespace, and UI entry points that can be disabled or deleted without breaking core Kairo.

### Non-goals (for this plan)

- Paid **unified** calendar **aggregator** services (Nylas, Cronofy, etc. that charge you per connected user).
- Two-way full calendar **write** sync (editing events in Kairo and pushing them back to Google/Outlook) — out of scope for v1; **read** + **create Kairo `Meeting` from event** is enough.
- Dropping the **Option 2** backup in code before launch is acceptable only if product is certain no segment needs ICS/CalDAV; by default, keep the backup for parity and locked-down orgs.

---

## 2. Design principles

1. **Additive module:** new code lives under a clear `integrations/calendar` (or equivalent) tree; **avoid** deep edits inside `MeetingBot`, transcription, or RBAC.
2. **No silent behavior change:** if the module is off or a user has no connection, behavior matches today (Kairo-native meetings + task deadlines only on My Calendar).
3. **Idempotent sync:** external events map to `Meeting` rows with stable **external keys**; re-syncs update in place, no duplicate join storms.
4. **Single join authority:** only **existing** `Meeting` + metadata flags drive auto-join; calendar sync only creates/updates those rows.

---

## 3. Integration options (all automatic, ongoing)

Both options rely on **background sync** (cron or queue workers): the user does **one-time** setup; Kairo keeps `Meeting` rows in step. There is **no** product plan to require users to repeatedly download and re-upload calendar files.

### Option 1 (primary) — OAuth: Google Calendar API + Microsoft Graph

| Aspect | Description |
|--------|-------------|
| **What the user does** | Clicks **“Connect Google Calendar”** or **“Connect Microsoft 365 / Outlook”**, completes the provider’s consent screen **once**; the app stores **refresh tokens** server-side. |
| **What the server does** | Calls the official APIs on a **schedule** (or with **push** notifications in a later iteration): list calendars (optional), list/expand events in a time window, map events → `Meeting` with the same upsert pipeline as the backup path. |
| **Why it is the default** | **Fresher** data, **richer** conference fields, and the **expected** experience for Google Workspace and Microsoft 365, including when secret ICS links are disabled by admin policy. |

**Cost / billing:** avoid **paid** third-party *aggregator* products; budget **engineering** and **compliance** for OAuth (app registration, token refresh, and possible **Google / Microsoft** app verification in production). Calendar API and **Graph** calendar use each vendor’s **free tier** limits for typical usage.

**Code shape (overview):** connection `type` values (e.g. `oauth_google`, `oauth_microsoft`); **encrypted** refresh and access material; **redirect/callback** handlers; sync jobs call **JSON** list-events APIs (not only HTTP GET of `.ics`).

**Security:** only store long-lived tokens **encrypted**; **revoke** on disconnect; **minimum** read-only calendar scopes.

### Option 2 (backup) — ICS feed URL + CalDAV (open standards)

| Mechanism | What it is | When to use it |
|-----------|------------|----------------|
| **ICS / iCal feed URL** | User pastes a **private subscription URL**; the server **periodically `GET`s** the URL and parses the feed. | **Backup** for users who cannot use OAuth, or to supplement a provider that exposes a stable feed. |
| **CalDAV** | CalDAV **base URL** + **credentials**; sync over the standard **CalDAV** protocol. | Self-hosted / enterprise calendaring; some teams that block cloud OAuth. |

**Shared implementation details:** one **iCalendar (VEVENT)** parser for `.ics` bodies (`ical.js` / `node-ical` / `ical-expander` for recurrence). For **CalDAV**, a small client (e.g. `tsdav`) for `calendar-query` / sync-token / ctag as supported.

**Security:** **ICS URLs** and **CalDAV** credentials are **secrets**; **encrypt at rest**; never log full URLs or passwords.

**Trade-offs vs Option 1 (OAuth):** private **ICS** feeds for Google are often **delayed** vs the live calendar; some Workspace admins **disable** secret iCal links — those users should prefer **Option 1**. Option 2 remains a **safety net** and for non-Google/365 stacks.

---

### Comparing the two options (quick reference)

| | Option 1 (OAuth) | Option 2 (ICS + CalDAV) |
|---|------------------|------------------------|
| **User supplies** | Clicks “Connect”; OAuth consent. | Feed URL, or CalDAV URL + credentials. |
| **Ongoing work** | None. Server calls APIs and refreshes tokens. | None. Server polls. |
| **Provider projects** | **Required** (Google Cloud, Azure/Entra app). | Not required for pure **ICS**; not required to ship OAuth. |
| **Typical update delay** | Generally best for Google/365. | **ICS** can be slow; **CalDAV** better. |
| **When** | **Default** implementation and primary UX. | **Backup** and self-hosted / policy edge cases. |

---

## 4. How it maps onto the existing system

### 4.1 Data model (minimal extensions)

`Meeting` already has:

- `meetingSource` (string; e.g. `kairo`, today’s roadmap mentions `google-calendar` / `outlook` as labels)
- `startTime` / `endTime` / `duration`
- `isRecurring` / `recurrenceRule` (iCal RRULE already aligned)
- `meetingLink`, `platform`, `metadata` (Json)

**Recommended approach:**

- Add a dedicated table, e.g. `CalendarConnection` (per user or per workspace — **product choice**; *per user* is simpler for “My Calendar”):
  - `id`, `userId`, `workspaceId?`, `type` (`ics_url` | `caldav` | `oauth_google` | `oauth_microsoft`)
  - `label`, `isEnabled`, `lastSyncAt`, `lastSyncError`, `syncCursor` / `ctag` / `syncToken` (as needed for CalDAV or API **sync tokens** / cursors)
  - **Secret fields (Option 1 — OAuth):** refresh token (encrypted), token expiry, optional provider account id and selected calendar ids (if not syncing “all”)
  - **Secret fields (Option 2 — backup):** `icsUrl` encrypted; `caldavUrl`, `username`, `passwordEncrypted` (if CalDAV)
- Store **per-meeting** external identity in `Meeting.metadata` to avoid a migration on every field:

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

Index or uniqueness: `(workspaceId, meetingSource, metadata->calendar->uid)` enforced in application code or a partial unique index if your DB supports JSON well enough — otherwise a nullable `external_uid` column on `Meeting` (single migration) is acceptable.

**Why not only `meetingSource`?** The string is too coarse for multi-connection and de-duplication; metadata (or one column) carries stable UIDs.

### 4.2 From calendar event to Kairo `Meeting`

**Option 1 (OAuth):**

1. **Map** API events to the same logical fields: provider event `id` + `iCalUID` (if present) for stable keys, `start`/`end`, `summary`, `location`, `description`, `conferenceData` / `onlineMeeting` / `webLink` as available per API.

**Option 2 (ICS / CalDAV):**

1. **Parse** VEVENT: `UID`, `DTSTART`, `DTEND` or `DURATION`, `RRULE`, `LOCATION`, `DESCRIPTION`, `URL` (some invites put the Meet link in URL or in DESCRIPTION).

**Common (both options):**

2. **Extract video link** with a small, test-covered heuristic (order of preference):
   - **Option 1 (OAuth):** structured fields first (e.g. Google `hangoutLink` / `conferenceData`, Microsoft `onlineMeeting` / `webLink`) when present
   - **Option 2 (ICS/CalDAV):** `URL` property if it looks like Meet/Zoom/Teams
   - first `https` line in description matching known patterns (reuse ideas from your meeting link validation elsewhere, if any)
3. **Platform** (`meeting.platform`): set from link (`google-meet`, `zoom`, `teams`, `other`).
4. **Decide** whether to create a `Meeting`:
   - v1: only if a **joinable** link is found **or** user opts in to “import all events” (then link optional — product toggle).
5. **Recurring events — Option 1 (OAuth):** use each API’s **instances** or **events.list** with time bounds. **Option 2 (ICS/CalDAV):** expand with `ical-expander` into instances in a window, or one `Meeting` per occurrence in the forward window (e.g. next 90 days); align with `recurrenceRule` / `isRecurring` on `Meeting` where possible.
6. **Deduplication:** stable **provider id + iCalUID** (OAuth) or **UID** from ICS (+ recurrence instance id for exceptions). On sync, UPDATE if changed; soft-cancel if **cancelled** or removed from source.

### 4.3 Auto-join and cron

Existing behavior in `autoJoinMeetings.js` and `PreMeeting` assumes **real `Meeting` rows** with `status`, `startTime`, `endTime`, `meetingLink`. **No change** to join logic is required if calendar sync only **creates/updates** those rows.

**Guardrails:**

- `metadata.calendar` presence → optional policy: e.g. only auto-join if user toggled “Kairo: auto-join synced meetings” (store on `CalendarConnection` or `User` preferences).
- Respect the same **duplicate** protections already used for bot joins (`botJoinTriggeredAt`, active sessions, locks).

### 4.4 Scheduler

Add a **sync job** (same pattern as other cron in `config/cron.js`):

- Every N minutes: for each enabled `CalendarConnection`, **call** Google/Microsoft **list events** for **Option 1 (OAuth)**, or **GET** the ICS feed / **CalDAV** sync for **Option 2 (backup)**, then run the same **upsert** pipeline.
- Backoff on repeated failures; surface error in **Settings** UI and optional toast.

This keeps the module **stateless** between runs except for DB cursors and connection secrets.

---

## 5. API surface (modular)

Mount routes only when feature flag is on, e.g. `ENABLE_CALENDAR_INTEGRATION=true`:

| Method | Path (example) | Purpose |
|--------|------------------|---------|
| GET | `/api/calendar/connections` | List user’s connections (redact secrets). |
| GET | `/api/calendar/oauth/google/start` | **Option 1** — begin Google OAuth (return auth URL or redirect). |
| GET | `/api/calendar/oauth/google/callback` | **Option 1** — handle code, store tokens, create connection. |
| GET | `/api/calendar/oauth/microsoft/start` | **Option 1** — begin Microsoft OAuth. |
| GET | `/api/calendar/oauth/microsoft/callback` | **Option 1** — handle code, store tokens, create connection. |
| POST | `/api/calendar/connections` | **Option 2 (backup):** add ICS URL or CalDAV; validate with test fetch. |
| DELETE | `/api/calendar/connections/:id` | Remove + optional cleanup of future-only synced meetings; **revoke** token with provider if OAuth connection. |
| POST | `/api/calendar/connections/:id/sync` | Manual “sync now”. |
| GET | `/api/calendar/status` | Feature availability for frontend. |

**RBAC:** reuse existing “user can access workspace / own resources” rules; connections are user-scoped unless you explicitly add workspace-shared feeds.

**Removal:** if the feature flag is off, routes return 404; frontend hides menu items; **no** imports in core paths — optional `require` inside a small `registerCalendarRoutes(app)` that no-ops when disabled.

---

## 6. Frontend integration

| Area | Work |
|------|------|
| **Onboarding `CalendarStep.tsx`** | **Primary:** “Connect Google Calendar” and “Connect Microsoft” (start **Option 1** OAuth). **Backup:** “Use calendar feed URL (ICS)” and **CalDAV (advanced)**. Remove mock “success” that does not call the backend. |
| **My `MyCalendar.tsx`** | Already loads meetings from APIs; after sync, **the same** `getMeetingsByWorkspace` responses include imported meetings (with badge via `meetingSource` / metadata). |
| **Settings** | List connections with **OAuth** (Google, Microsoft) first, then **ICS/CalDAV**; last sync, errors, “Sync now”, **Disconnect** (triggers token revoke for OAuth). |
| **PreMeeting** | `case 'google-calendar':` in existing UI (see `PreMeeting.tsx`) can map to a generic **“External calendar”** string driven by `meetingSource` / metadata. |

Use **dynamic import** for calendar settings route so production bundles stay split if the feature is off.

---

## 7. Phased rollout (realistic)

| Phase | Scope | Outcome |
|-------|--------|--------|
| **P0** | Feature flag, `CalendarConnection`, **Option 1: OAuth (Google first)** + token storage + scheduled **list events** + `Meeting` upsert + source in UI | Shipped product path. |
| **P1** | **Option 1: Microsoft (OAuth)**, token refresh, disconnect/revoke, settings polish, multi-calendar select if required | Full primary provider coverage. |
| **P2 (backup)** | **Option 2: ICS feed URL** + **CalDAV**; shared parser/upsert with duplicate-key rules; document as fallback | Users who need open-protocol paths. |

**Tests:** unit **fixtures** may use static `.ics` **strings** or small files in-repo **only** for parser/upsert tests (this is developer test data, not a user-facing “upload your calendar” flow).

---

## 8. Modular removal checklist

- Set `ENABLE_CALENDAR_INTEGRATION=false` (or remove env var defaulting to off).
- Stop registering cron handler for sync.
- Drop or hide `CalendarConnection` from UI; DB table can stay empty.
- If removing entirely: delete `integrations/calendar/`, route file, and migration rollback in a **single** PR; core `Meeting` and auto-join unchanged.

---

## 9. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| ICS feed leaks if DB compromised | Encrypt secrets; rotate instructions for users; never expose raw URL in API responses. |
| Duplicate meetings | Stable UID + recurrence id; unique constraint strategy (§4.1). |
| Join storms on bad sync | Same dedupe as today; consider “imported meetings default to manual join” until user opts in. |
| Time zones | **Option 2 (ICS/CalDAV):** normalize to UTC from VEVENT `TZID` / floating times. **Option 1 (OAuth):** use API-provided `timeZone` / offset. |
| OAuth **token** leak or expiry mishandled | Encrypted storage; **refresh** on 401; revoke on disconnect; **minimum** scopes. |

---

## 10. Success criteria

- **Option 1 (OAuth):** After one-time **Google** and/or **Microsoft** consent, the `Meeting` pipeline is fed from the official APIs; **no** user-side file or repeated manual steps.
- **Option 2 (ICS/CalDAV):** With a **feed URL** or **CalDAV** (when shipped in P2), events appear after background sync; joinable links produce **`Meeting` rows** usable with **existing** auto-join and reminders.
- The feature can be **turned off** in one config switch without breaking unrelated services.
- No **paid** third-party **unified** calendar aggregator; **OAuth to each vendor’s own APIs** (plus **Option 2** open parsers for backup) is sufficient.

---

## 11. Related code references (repository)

- Meeting creation & `meetingSource`: `backend/prisma/schema.prisma` — `Meeting` model.
- Auto-join: `backend/src/jobs/autoJoinMeetings.js`.
- Pre-meeting timers / join: `frontend/src/pages/meetings/PreMeeting.tsx`.
- My Calendar UI: `frontend/src/pages/userProfile/MyCalendar.tsx`.
- Onboarding mock: `frontend/src/components/onboarding/CalendarStep.tsx`.

This document is the **planning** source of truth for implementation; update it when phases ship or when Provider OAuth details change.
