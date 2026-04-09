# Speaker Diarization — Integration Map & Implementation Plan

> Generated: April 2026  
> Scope: Connect all existing pipeline components for end-to-end speaker diarization and identification. Fully modular — no changes to live transcription, AI insights, meeting memory, or auth workflows unless explicitly noted.

---

## 1. Pipeline Overview (As-Built)

```
┌─────────────────────────────────────────────────────────────────┐
│  ENROLLMENT (before meetings)                                   │
│                                                                 │
│  VoiceStep (onboarding)  ──► POST /speakers/consent/grant       │
│  VoiceTab (settings)     ──► POST /speakers/validate-audio      │
│                          ──► POST /speakers/enroll              │
│                               └─► VoiceEmbeddingBridge          │
│                                    └─► VoiceEmbeddingService.py │
│                                         └─► user_voice_embeddings│
└─────────────────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  LIVE MEETING                                                   │
│                                                                 │
│  Audio captured ──► TranscriptionService                        │
│                      ├─ whisperX chunks (text only, no diarz.)  │
│                      └─ WebSocket: speaker = "Speaker 1" (stub) │
└─────────────────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST-MEETING DIARIZATION                                       │
│                                                                 │
│  TranscriptionService.finalize()                                │
│    └─► transcribe-whisper.py --diarize                          │
│         └─► WhisperX + pyannote DiarizationPipeline             │
│              └─► transcript_diarized.json                       │
│                   (SPEAKER_00, SPEAKER_01, ...)                 │
└─────────────────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST-MEETING SPEAKER IDENTIFICATION                            │
│                                                                 │
│  PostMeetingProcessor.triggerSpeakerIdentification()            │
│    └─► SpeakerMatchingEngine.runForMeeting()                    │
│         ├─ getDiarizedTranscript()  ◄── transcript_diarized.json│
│         ├─ findCompleteAudioFile()  ◄── full meeting audio      │
│         ├─ groupSegmentsBySpeaker() → {SPEAKER_00: [{start,end}]}│
│         ├─ Tier 1: ffmpeg segment → embed → cosine vs DB        │
│         ├─ Tier 3: historical speaker_identity_maps lookup       │
│         └─ saveIdentityMapping() → speaker_identity_maps table  │
└─────────────────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND DISPLAY (currently disconnected)                      │
│                                                                 │
│  TranscriptPanel  ◄── ??? no speaker_identified WS event       │
│  MeetingSummary   ◄── ??? no GET /speakers/meetings/:id call    │
│  VoiceTab         ◄── broken field name mismatch               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Gaps & Bugs — Full Inventory

### Layer 1 — Critical Crashes (runtime errors)

| ID   | File | Bug | Symptom |
|------|------|-----|---------|
| 1.1  | `speakerRoutes.js` | Calls `SpeakerIdentificationService.getMeetingMappings()` — method does not exist (real name: `getIdentityMappings`) | `GET /api/speakers/meetings/:id` throws at runtime |
| 1.2  | `SpeakerMatchingEngine.js` | `groupSegmentsBySpeaker` reads `diarized_start`/`start_time` (snake_case); `getDiarizedTranscript` returns `startTime`/`endTime` (camelCase, normalized) plus `originalStartTime`/`timeOffset` | Every speaker segment gets `start=0, end=3`; ffmpeg extracts wrong audio window; Tier 1 embeddings are all from the same first 3 seconds |
| 1.3  | `speakerRoutes.js` | No `GET /speakers/workspace/:workspaceId/enrolled` route exists | Frontend `getWorkspaceEnrolledUsers()` gets 404 |

### Layer 2 — Data Contract Mismatches (silent failures)

| ID   | File | Bug |
|------|------|-----|
| 2.1  | `frontend/src/services/api.ts` | `SpeakerConsentStatus` interface declares `biometricConsent`, `enrolled`, `lastEnrollmentAt`, `embeddingVersion`; backend sends `hasConsent`, `embeddingCount`, `lastEmbeddingUpdated`, `hasAudioSample` |
| 2.2  | `frontend/src/pages/Onboarding.tsx` | After enrollment, checks `enrollResponse.data?.snr`; backend returns `snrDb` |

### Layer 3 — VoiceTab Inoperative (settings page)

| ID   | File | Bug |
|------|------|-----|
| 3.1  | `VoiceTab.tsx` | Reads `status.biometricConsent`, `status.enrolled`, `status.lastEnrollmentAt` — all `undefined` after 2.1 fix uses correct names; needs field reference updates |
| 3.2  | `VoiceTab.tsx` | No consent-grant step in re-enrollment flow; calling `/enroll` without prior `/consent/grant` returns 403 |

### Layer 4 — Missing Connections (results never reach frontend)

| ID   | Files | Gap |
|------|-------|-----|
| 4.1  | `WebSocketServer.js` | No `broadcastSpeakerIdentified` function exists |
| 4.2  | `PostMeetingProcessor.js`, `TranscriptionService.js` | `triggerSpeakerIdentification()` called without `broadcastFn`; identification results never broadcast |
| 4.3  | `TranscriptPanel.tsx` (or equivalent) | No handler for `speaker_identified` WS event |
| 4.4  | Meeting summary page | No call to `GET /api/speakers/meetings/:meetingId` on load; stored mappings never applied to display |

### Layer 5 — Infrastructure & Stability

| ID   | File | Issue |
|------|------|-------|
| 5.1  | `SpeakerMatchingEngine.js` | Venv candidate `../../../../venv` resolves outside repo root |
| 5.2  | `SpeakerIdentificationService.js` | Instantiates own `new PrismaClient()` instead of shared `lib/prisma` singleton |
| 5.3  | `SpeakerMatchingEngine.js` | `saveIdentityMapping` called with raw `meetingId` parameter (possibly string) instead of parsed `meetingIdNum` |

### Layer 6 — Optional / Quality

| ID   | Area | Note |
|------|------|------|
| 6.1  | Python + Frontend | SNR threshold mismatch: Python accepts ≥ 6 dB; UI gates "good" at ≥ 15 dB; user can't enroll valid audio |
| 6.2  | Meeting summary | Past meetings with resolved speaker IDs don't refresh on revisit |
| 6.3  | TranscriptPanel | Manual speaker assignment UI (`SpeakerAssignmentPopover`) not wired to existing backend endpoints |

---

## 3. Complete Step-by-Step To-Do List

### ✅ Layer 1 — Critical Crashes

- [ ] **1.1** `backend/src/routes/speakerRoutes.js` line ~202: rename `getMeetingMappings` → `getIdentityMappings`
- [ ] **1.2** `backend/src/services/SpeakerMatchingEngine.js` `groupSegmentsBySpeaker()`: update timestamp resolution to use `u.originalStartTime` (actual audio time) and `u.endTime + (u.timeOffset ?? 0)` as primary path, with snake_case fields as fallback for raw utterance objects
- [ ] **1.3** `backend/src/routes/speakerRoutes.js`: add `GET /speakers/workspace/:workspaceId/enrolled` → calls `SpeakerIdentificationService.getEnrolledWorkspaceUsers(workspaceId)`, returns `{ users: [{id, name, lastEnrollment}] }`

### ✅ Layer 2 — Data Contract Fixes

- [ ] **2.1** `frontend/src/services/api.ts`: rewrite `SpeakerConsentStatus` interface to match actual backend shape: `{ hasConsent, consentGivenAt, hasAudioSample, embeddingCount, lastEmbeddingUpdated, daysSinceLastUpdate, needsReEnrollment }`
- [ ] **2.2** `frontend/src/pages/Onboarding.tsx` line ~165: change `enrollResponse.data?.snr` → `enrollResponse.data?.snrDb`

### ✅ Layer 3 — VoiceTab Re-Enrollment

- [ ] **3.1** `frontend/src/components/profileSettings/VoiceTab.tsx`: update all status field reads after 2.1: `biometricConsent` → `hasConsent`, `enrolled` → `embeddingCount > 0`, `lastEnrollmentAt` → `lastEmbeddingUpdated`
- [ ] **3.2** `frontend/src/components/profileSettings/VoiceTab.tsx`: add inline consent-grant step — when `!status.hasConsent`, show consent checkbox before recording section; on confirm, call `grantSpeakerConsent()` first

### ✅ Layer 4 — Post-Meeting Results → Frontend

- [ ] **4.1** `backend/src/services/WebSocketServer.js`: add `broadcastSpeakerIdentified(meetingId, mappings)` function that emits `{ type: 'speaker_identified', data: { meetingId, mappings: [{speakerLabel, userId, userName, confidenceScore, tierResolved}] } }`
- [ ] **4.2** `backend/src/services/PostMeetingProcessor.js`: import `WebSocketServer`; inside `triggerSpeakerIdentification`, construct a `broadcastFn` closure that collects all resolved mappings and calls `broadcastSpeakerIdentified` once after `runForMeeting` completes
- [ ] **4.3** Frontend TranscriptPanel: add WebSocket event handler for `speaker_identified`; maintain a `Map<speakerLabel, {userId, userName}>` in state; re-render utterances with resolved names
- [ ] **4.4** Frontend TranscriptPanel / meeting page `useEffect` on load: call `getMeetingSpeakerMappings(meetingId)` and apply label→name substitution before first render

### ✅ Layer 5 — Infrastructure

- [ ] **5.1** `backend/src/services/SpeakerMatchingEngine.js` `VENV_CANDIDATES`: move `../../../venv/Scripts/python.exe` and `../../../venv/bin/python` to the front of the array
- [ ] **5.2** `backend/src/services/SpeakerIdentificationService.js`: replace `new PrismaClient()` at top of file with `require('../lib/prisma')`
- [ ] **5.3** `backend/src/services/SpeakerMatchingEngine.js` `runForMeeting()` line ~482: change `saveIdentityMapping(meetingId, ...)` → `saveIdentityMapping(meetingIdNum, ...)`

### ✅ Layer 6 — Optional / Quality

- [ ] **6.1** Align SNR gating: either raise `SNR_THRESHOLD_DB` in `VoiceEmbeddingService.py` to 15, or lower the frontend display threshold to 6, or make the UI `valid` flag (from backend) the authoritative enrollment gate instead of the hardcoded 15 dB check
- [ ] **6.2** Meeting summary page: on load, always call `getMeetingSpeakerMappings(meetingId)` and apply label→name mapping (same as 4.4 but for the review/summary view specifically)
- [ ] **6.3** Wire `SpeakerAssignmentPopover` to `POST /api/speakers/meetings/:meetingId/assign` and the new `GET /speakers/workspace/:workspaceId/enrolled` (from 1.3) for the user picker

---

## 4. Implementation Dependency Order

```
1.1 ─────────────────────────────── independent, do first
1.2 ─────────────────────────────── independent, do first
1.3 ─────────────────────────────── independent, do first
                                          │
2.1 (type fix) ──────────────────────────┤
     └─► 3.1 (VoiceTab field names)      │
           └─► 3.2 (consent grant step)  │
                                          │
2.2 ─────────────────────────────── independent
                                          │
4.1 (new WS event type) ─────────────────┘
     └─► 4.2 (wire broadcastFn)
           └─► 4.3 (frontend handles WS event)
                 └─► 4.4 (page-load fetch)
                       └─► 6.2, 6.3

5.1, 5.2, 5.3 ──────────────── infrastructure, any time
6.1 ─────────────────────────── after enrollment is working
```

---

## 5. Files Touched Per Layer

| Layer | Backend | Frontend | Python |
|-------|---------|----------|--------|
| 1 | `speakerRoutes.js`, `SpeakerMatchingEngine.js` | — | — |
| 2 | — | `api.ts`, `Onboarding.tsx` | — |
| 3 | — | `VoiceTab.tsx` | — |
| 4 | `WebSocketServer.js`, `PostMeetingProcessor.js` | `TranscriptPanel.tsx` (or equiv.) | — |
| 5 | `SpeakerMatchingEngine.js`, `SpeakerIdentificationService.js` | — | — |
| 6 | — | `VoiceTab.tsx`, meeting summary page | `VoiceEmbeddingService.py` |
