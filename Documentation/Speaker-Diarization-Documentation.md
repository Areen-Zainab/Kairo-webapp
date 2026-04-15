# Speaker Diarization — Integration Map & Implementation Status

> Last updated: April 9, 2026  
> Scope: End-to-end speaker diarization and identification — post-meeting biometric matching, live per-chunk identification, manual assignment UI, and cascade name propagation. Fully modular.

---

## 0. Voice Embedding Model

### Model: SpeechBrain ECAPA-TDNN (`speechbrain/spkrec-ecapa-voxceleb`)

Kairo uses **SpeechBrain's ECAPA-TDNN** (Emphasized Channel Attention, Propagation and Aggregation Time Delay Neural Network) as its canonical voice embedding model. All speaker fingerprints — whether enrolled at signup or extracted from live audio chunks — are stored as **192-dimensional L2-normalised vectors** in the `user_voice_embeddings` table via pgvector.

### Why ECAPA-TDNN?

| Property | Detail |
|---|---|
| **Architecture** | Time Delay Neural Network with channel attention and residual propagation — designed specifically for speaker verification, not generic speech recognition |
| **Pre-trained dataset** | VoxCeleb (large-scale, multi-speaker, real-world audio across languages and devices) |
| **Output dimensionality** | 192-dimensional vector — compact enough for fast cosine similarity at scale, expressive enough for accurate discrimination between speakers |
| **Accuracy** | Achieves state-of-the-art Equal Error Rate (EER) on standard speaker verification benchmarks |
| **Robustness** | Performs well on short utterances (≥5s for meeting segments, ≥2.5s for live chunks) and across recording devices |
| **Local inference** | Runs fully on-device (CPU) via SpeechBrain — no external API calls, no latency spikes, no data leaving the server |
| **Integration** | Consumed directly via `speechbrain.inference.speaker.EncoderClassifier`; persistent warm `--server` mode keeps the encoder in memory across all meetings, reducing per-chunk overhead to near-zero |

### Why Not an Alternative?

- **Pyannote ResNet34** (`wespeaker-voxceleb-resnet34-LM`) is included as a fallback. It produces 256-dimensional embeddings, which are trimmed/zero-padded to 192 to match the DB schema. It is less accurate than ECAPA-TDNN on short segments and is only activated if SpeechBrain is unavailable.
- **MFCC mean** (64-dim) is a last-resort fallback used in development/testing only. It is not suitable for production identification.

### Thresholds

| Context | Minimum Audio Duration | Similarity Threshold |
|---|---|---|
| Voice enrollment | 15 seconds | — |
| Post-meeting biometric identification (Tier 1) | 5 seconds | 0.72 (cross-device tolerant) |
| Live per-chunk identification | 2.5 seconds | 0.55 (lower to handle 3s variability) |

The separation of thresholds ensures the live path (which operates on short, potentially noisy chunks) remains non-blocking and non-fatal — it never interrupts transcription, and a failed identification simply reverts the segment to its generic `SPEAKER_XX` label until post-meeting processing resolves it with higher confidence.

---

## 1. Pipeline Overview (Current State)

```
┌─────────────────────────────────────────────────────────────────┐
│  ENROLLMENT (before meetings)                          ✅ DONE   │
│                                                                 │
│  VoiceStep (onboarding)  ──► POST /speakers/consent/grant       │
│  VoiceTab (settings)     ──► POST /speakers/validate-audio      │
│  ProfileTab (profile)    ──► auto-enroll on audio upload        │
│                          ──► POST /speakers/enroll              │
│                               └─► VoiceEmbeddingBridge          │
│                                    └─► VoiceEmbeddingService.py │
│                                         └─► user_voice_embeddings│
│                                              (192-dim ECAPA-TDNN)│
└─────────────────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  LIVE MEETING — per-chunk speaker identification       ✅ DONE   │
│                                                                 │
│  AudioRecorder.startRealtimeTranscription()                     │
│    └─► TranscriptionService.initLiveSpeakerIdentification()     │
│         └─► LiveSpeakerIdentifier.initialize()                  │
│              └─► loads enrolled workspace user embeddings (DB)  │
│                                                                 │
│  Per 3s chunk (after transcript broadcast):                     │
│    setImmediate → LiveSpeakerIdentifier.identifyChunk()         │
│      ├─ EmbeddingServerProcess.embed()  ◄── persistent Python   │
│      │     └─► VoiceEmbeddingService.py --server (warm encoder) │
│      │          └─► cmd_embed_live(): MIN_LIVE=2.5s, SNR check  │
│      │               returns 192-dim embedding                  │
│      ├─ cosine similarity vs enrolled profiles                  │
│      │     LIVE_THRESHOLD = 0.55                                │
│      ├─ sliding window majority vote (WINDOW=4, MIN_VOTES=2)    │
│      └─► if voted → broadcastLiveSpeakerUpdate()               │
│               └─► WebSocket: live_speaker_update {chunkIndex,   │
│                              speaker, userId, confidence}        │
│                                                                 │
│  Frontend: useLiveTranscript.ts                                 │
│    └─► live_speaker_update handler patches entry.speaker        │
│         (pending override map handles race: update before chunk) │
└─────────────────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST-MEETING DIARIZATION                              ✅ DONE   │
│                                                                 │
│  TranscriptionService.finalize() / MeetingReprocessService      │
│    └─► transcribe-whisper.py --diarize                          │
│         └─► WhisperX + pyannote DiarizationPipeline             │
│              └─► transcript_diarized.json                       │
│                   (SPEAKER_00, SPEAKER_01, ...)                 │
└─────────────────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST-MEETING SPEAKER IDENTIFICATION                   ✅ DONE   │
│                                                                 │
│  MeetingReprocessService (synchronous, before insights)         │
│    └─► SpeakerMatchingEngine.runForMeeting()                    │
│         ├─ getDiarizedTranscript()  ◄── transcript_diarized.json│
│         ├─ findCompleteAudioFile()  ◄── full meeting audio      │
│         ├─ groupSegmentsBySpeaker() → {SPEAKER_00: [{start,end}]}│
│         ├─ Tier 1: ffmpeg segment → embed --identify → cosine   │
│         │         threshold: 0.72 (tuned for cross-device)      │
│         ├─ Tier 3: historical speaker_identity_maps lookup      │
│         ├─ saveIdentityMapping() → speaker_identity_maps table  │
│         │   (manual tier-4 preserved unless biometric wins)     │
│         └─► cascadeNameUpdate() for resolved speakers           │
│                  → transcript file, action_items, ai_insights,  │
│                    meeting_embeddings, memory_contexts           │
└─────────────────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI INSIGHTS (uses real names)                         ✅ DONE   │
│                                                                 │
│  AIInsightsService.generateInsights()  ◄── cascade done first  │
│  MeetingEmbeddingService               ◄── uses updated names  │
└─────────────────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND DISPLAY                                      ✅ DONE   │
│                                                                 │
│  TranscriptPanel (post-meeting details page)                    │
│    ├─ fetchSpeakerMappings() on load (keyed by label + name)    │
│    ├─ WebSocket handler: speaker_identified (post-meeting)      │
│    ├─ WebSocket handler: live_speaker_update (live meeting)     │
│    ├─ Biometric / Manual / Historical identification badges     │
│    └─ IDENTIFY button for ANY unresolved speaker label          │
│         (no regex guard — works for SPEAKER_XX, "Speaker 1",   │
│          "Unknown", any other placeholder)                      │
│  useLiveTranscript.ts (live meeting page)                       │
│    ├─ WebSocket: patches speaker label on live_speaker_update   │
│    └─ pending override map: handles update-before-chunk race    │
│  MeetingDetails.tsx                                             │
│    ├─ fetchTick: full re-fetch after reprocess completes        │
│    └─ mappingsRefreshTick: re-fetch mappings after reprocess    │
│  SpeakerAssignmentPopover                                       │
│    └─ Manual assign → cascadeNameUpdate → broadcastWS           │
└─────────────────────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  UNRESOLVED SPEAKERS / GUEST PROFILING                ⏳ PENDING │
│                                                                 │
│  Currently: unresolved speakers shown as raw SPEAKER_XX labels  │
│  Planned:   extract meeting-scoped embeddings → "Guest A/B"     │
│             use guest profiles for within-meeting re-verification│
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. What Has Been Implemented

### Enrollment pipeline
- `VoiceStep.tsx` (onboarding): records 15–30s sample, validates SNR, enrolls; lets user replay recorded sample before submitting
- `VoiceTab.tsx` (settings): same pipeline; shows "Voice sample enrolled" summary when enrolled; "Update sample" toggle; inline consent grant
- `ProfileTab.tsx` (profile): auto-enrolls on audio upload/record if consent is present; duration enforced at 15–30s
- `Onboarding.tsx`: saves raw audio to profile (uploads to Supabase + updates `audioSampleUrl`) so it shows in Profile Tab
- `VoiceEmbeddingService.py`:
  - Separate `MIN_ENROLL_DURATION_SEC=15` / `MIN_IDENTIFY_DURATION_SEC=5` / `MIN_LIVE_DURATION_SEC=2.5`
  - 192-dim ECAPA-TDNN embeddings (canonical); 256-dim pyannote fallback normalised to 192
  - `--server` mode: persistent stdin/stdout JSON server for low-latency live chunk embedding
  - `--identify` flag: uses relaxed 5s minimum for meeting segment identification
  - Torchaudio warnings suppressed; ffmpeg fallback is silent unless it also fails
- DB tables: `user_voice_embeddings`, `speaker_identity_maps`, `biometric_consent`/`consent_given_at` on users

### Live meeting speaker identification (new — implemented April 2026)
- `EmbeddingServerProcess.js` — singleton long-lived Python process manager:
  - Lazy init on first `embed()` call; keeps encoder warm across all meetings
  - Adaptive timeout: 35s for first call (cold-start), 10s for subsequent
  - Exponential-backoff restart (max 3 attempts); restart counter resets after 60s stable uptime
  - Graceful `stop()` on Node process exit/signal (prevents orphaned Python processes)
- `LiveSpeakerIdentifier.js` — per-meeting identification service:
  - Loads enrolled workspace users' voice embeddings from DB on `initialize()`
  - `identifyChunk(audioPath, chunkIndex)`: calls `EmbeddingServerProcess.embed()` → cosine similarity → sliding window majority vote
  - `LIVE_THRESHOLD = 0.55` (lower than post-meeting 0.72 to account for 3s audio variability)
  - `WINDOW_SIZE = 4`, `MIN_VOTES_TO_CONFIRM = 2` — smooths label flicker across chunks
  - Completely non-blocking and non-fatal (never affects transcription)
  - Global on/off: `LIVE_SPEAKER_ID_ENABLED = false`
- `TranscriptionService.js`:
  - `initLiveSpeakerIdentification()`: creates + initialises `LiveSpeakerIdentifier`; called by `AudioRecorder`
  - After each chunk broadcast: `setImmediate` hook calls `identifyChunk()` then `broadcastLiveSpeakerUpdate()`
  - `cleanup()`: calls `liveSpeakerIdentifier.cleanup()`
- `AudioRecorder.js`: calls `this.transcriptionService.initLiveSpeakerIdentification()` when real-time transcription starts
- `WebSocketServer.js`: `broadcastLiveSpeakerUpdate(meetingId, chunkIndex, userName, userId, confidence)` — sends `live_speaker_update` type message to all connected clients; logs when delivered
- `useLiveTranscript.ts` (`MeetingLive.tsx` hook):
  - Handles `live_speaker_update` in `ws.onmessage` — patches the matching entry's `speaker` field in state
  - Pending override map: if update arrives before the transcript chunk, stores override and applies it when the chunk arrives

### Post-meeting identification
- `SpeakerMatchingEngine.js`:
  - Tier 1: voice fingerprint via cosine similarity (threshold `0.72`)
  - Tier 3: historical lookup from previous meetings
  - Correct `--identify` flag passed for meeting segment embeddings
  - Correct camelCase timestamp fields (`originalStartTime`, `endTime + timeOffset`)
  - Venv path order fixed for Windows
- `SpeakerIdentificationService.js`: shared Prisma singleton; `saveIdentityMapping` UPSERT preserves manual (tier-4) assignments unless a biometric match wins
- `MeetingReprocessService.js`: speaker ID runs **synchronously before** AI insights; resolved names cascade into transcript before insights generation

### Cascade name update
- Rewrites: `action_items.assignee`, `ai_insights.content`, `meeting_memory_contexts`, `meeting_embeddings.content`, on-disk `transcript_diarized.json`
- Manual assignment from UI triggers cascade immediately via `POST /api/speakers/meetings/:id/assign`

### Frontend display
- `TranscriptPanel.tsx`:
  - Fetches mappings on load; keyed by both `speakerLabel` AND `userName` (handles post-cascade entries)
  - WebSocket listener for `speaker_identified` (post-meeting) and `live_speaker_update` (live) events
  - Identification badges: **Biometric** (green), **Manual** (amber), **Historical** (blue)
  - **IDENTIFY button for ANY unresolved speaker** — regex guard removed; works for `SPEAKER_XX`, `"Speaker 1"`, `"Unknown"`, and any other placeholder label
- `useLiveTranscript.ts`: `live_speaker_update` handler patches speaker labels in real-time in the live meeting view
- `MeetingDetails.tsx`: `fetchTick` forces full re-fetch after reprocess; `mappingsRefreshTick` triggers mapping refresh
- `SpeakerAssignmentPopover.tsx`: wired to `POST /assign` endpoint; broadcasts WS event on success

### Logging and stability
- Removed verbose `findCompleteAudioFile` / `getMeetingStats` / meeting route logs
- Python `UserWarning` / `FutureWarning` suppressed; full paths replaced with basenames in logs
- `broadcastLiveSpeakerUpdate` logs when message is delivered to clients

---

## 3. Layer Status

### ✅ Layer 1 — Critical Crashes
- [x] **1.1** `speakerRoutes.js`: `getMeetingMappings` → `getIdentityMappings`
- [x] **1.2** `SpeakerMatchingEngine.js`: `groupSegmentsBySpeaker` uses camelCase timestamps correctly
- [x] **1.3** `speakerRoutes.js`: `GET /speakers/workspace/:workspaceId/enrolled` route added

### ✅ Layer 2 — Data Contract Fixes
- [x] **2.1** `api.ts`: `SpeakerConsentStatus` interface rewritten to match backend shape
- [x] **2.2** `Onboarding.tsx`: `enrollResponse.data?.snr` → `enrollResponse.data?.snrDb`

### ✅ Layer 3 — VoiceTab Re-Enrollment
- [x] **3.1** `VoiceTab.tsx`: field names updated to `hasConsent`, `embeddingCount`, `lastEmbeddingUpdated`
- [x] **3.2** `VoiceTab.tsx`: inline consent-grant step added

### ✅ Layer 4 — Post-Meeting Results → Frontend
- [x] **4.1** `WebSocketServer.js`: `broadcastSpeakerIdentified()` added
- [x] **4.2** `PostMeetingProcessor.js`: `broadcastFn` wired; broadcasts on completion
- [x] **4.3** `TranscriptPanel.tsx`: WebSocket `speaker_identified` handler added
- [x] **4.4** `TranscriptPanel.tsx`: `getMeetingSpeakerMappings()` called on load

### ✅ Layer 5 — Infrastructure
- [x] **5.1** `SpeakerMatchingEngine.js`: venv path order corrected for Windows
- [x] **5.2** `SpeakerIdentificationService.js`: shared `lib/prisma` singleton
- [x] **5.3** `SpeakerMatchingEngine.js`: `meetingIdNum` (integer) passed to `saveIdentityMapping`

### ✅ Layer 6 — Quality
- [x] **6.1** Dual duration thresholds: `MIN_ENROLL_DURATION_SEC=15`, `MIN_IDENTIFY_DURATION_SEC=5` in Python; `--identify` flag passed for meeting segments
- [x] **6.2** `MeetingDetails.tsx`: `fetchTick` triggers full re-fetch after reprocess (stale transcript bug fixed)
- [x] **6.3** `SpeakerAssignmentPopover.tsx`: wired to assign endpoint + cascade + WS broadcast

### ✅ Layer 7 — Live Meeting Speaker Identification (beyond original plan)
- [x] **7.1** `VoiceEmbeddingService.py`: `--server` mode (persistent stdin/stdout JSON server); `MIN_LIVE_DURATION_SEC=2.5`; `cmd_embed_live()`
- [x] **7.2** `EmbeddingServerProcess.js`: singleton Python process manager; adaptive cold-start timeout (35s first, 10s subsequent); exponential-backoff restart; graceful shutdown hooks
- [x] **7.3** `LiveSpeakerIdentifier.js`: per-meeting cosine + sliding window majority vote; `LIVE_THRESHOLD=0.55`
- [x] **7.4** `WebSocketServer.js`: `broadcastLiveSpeakerUpdate()` with delivery logging
- [x] **7.5** `TranscriptionService.js`: `initLiveSpeakerIdentification()` + `setImmediate` hook after chunk broadcast
- [x] **7.6** `AudioRecorder.js`: calls `initLiveSpeakerIdentification()` on start
- [x] **7.7** `useLiveTranscript.ts`: `live_speaker_update` handler + pending override map
- [x] **7.8** `types.ts` (`TranscriptEntry`): `chunkIndex?: number` field added

### ➕ Additional Items Beyond Original Plan
- [x] **+A** `MeetingReprocessService.js`: speaker ID runs **synchronously before** AI insights + embeddings
- [x] **+B** `MeetingReprocessService.js`: cascade resolved names into transcript before insights reads it
- [x] **+C** `SpeakerIdentificationService.saveIdentityMapping`: UPSERT preserves manual tier-4 assignments unless new biometric wins
- [x] **+D** `TranscriptPanel.tsx`: identification badges (Biometric / Manual / Historical)
- [x] **+E** `TranscriptPanel.tsx`: dual-keyed `speakerMappings` map (by label + by resolved name)
- [x] **+F** `SpeakerMatchingEngine.js`: cosine threshold `0.82` → `0.72` for cross-device tolerance
- [x] **+G** Auto-enrollment in `ProfileTab.tsx`; onboarding saves raw audio to profile
- [x] **+H** `TranscriptPanel.tsx`: IDENTIFY button shows for ALL unresolved speakers (removed `/speaker_/i` regex guard — now catches `"Speaker 1"`, `"Unknown"`, etc.)
- [x] **+I** `LiveSpeakerIdentifier.js`: threshold lowered `0.60` → `0.55` to capture near-miss chunks
- [x] **+J** `WebSocketServer.broadcastLiveSpeakerUpdate`: delivery log added for diagnostics

---

## 4. Layer 8 — Within-Meeting Guest Profiling ⏳ PENDING

### Concept

After biometric identification runs and some speakers remain UNRESOLVED, pyannote has already given us consistent voice segments for those speakers. We extract one representative embedding per unresolved speaker from the meeting audio, label them **Guest A**, **Guest B** (ordered by first appearance), and:

1. Give unresolved speakers human-readable names instead of raw `SPEAKER_XX` labels — propagated through transcript, insights, action items.
2. Optionally re-verify borderline utterance assignments against all profiles (enrolled users + guests).
3. Enable cross-meeting guest matching ("last week's Guest A = today's SPEAKER_02?").

### Pipeline position

```
runForMeeting() — Tier 1 (biometric) + Tier 3 (historical)
        │
        ▼
 [NEW] Guest Profiling Step (for each UNRESOLVED speaker)
        ├─ Collect all audio segments for SPEAKER_XX
        ├─ Concatenate/average → 192-dim embedding  (embed --identify)
        ├─ Assign guest_label by first-appearance order (Guest A, Guest B, ...)
        ├─ Save to meeting_guest_profiles table
        └─ cascadeNameUpdate(meetingId, "SPEAKER_XX", null, "Guest A")
                  → renames in transcript, action items, insights, embeddings
        │
        ▼
 [OPTIONAL] Within-Meeting Re-Verification Pass
        ├─ For each utterance segment:
        │    compare embedding vs (enrolled users + guest profiles for this meeting)
        │    if a different profile wins by >0.05 margin → reassign
        └─ Re-run cascadeNameUpdate for any reassigned labels
```

### New database table

```sql
CREATE TABLE meeting_guest_profiles (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  meeting_id    INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  speaker_label TEXT NOT NULL,        -- original pyannote label, e.g. "SPEAKER_01"
  guest_label   TEXT NOT NULL,        -- human-readable, e.g. "Guest A"
  embedding     vector(192),          -- averaged from meeting segments
  segment_count INTEGER DEFAULT 0,    -- how many segments contributed to embedding
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (meeting_id, speaker_label)
);
```

### Step-by-step to-do list for Layer 8

- [ ] **8.1** DB migration: create `meeting_guest_profiles` table (add to `migratePhase1SpeakerIdentity.js`)
- [ ] **8.2** `SpeakerIdentificationService.js`: add `saveGuestProfile(meetingId, speakerLabel, guestLabel, embeddingArray, segmentCount)` and `getGuestProfiles(meetingId)`
- [ ] **8.3** `SpeakerMatchingEngine.js`: after Tier 1/3 loop, collect UNRESOLVED speakers; sort by first-segment start time; assign `Guest A`, `Guest B`, ... labels alphabetically
- [ ] **8.4** `SpeakerMatchingEngine.js`: for each guest, concatenate or use longest segment, call `embed --identify`, call `saveGuestProfile` with the resulting embedding
- [ ] **8.5** `SpeakerMatchingEngine.js`: call `cascadeNameUpdate(meetingId, speakerLabel, null, guestLabel)` for each guest so all transcript/insight text uses "Guest A" etc.
- [ ] **8.6** `SpeakerIdentificationService.saveIdentityMapping`: store `guest_label` in the metadata JSON field so `getIdentityMappings` can surface it to the frontend
- [ ] **8.7** `speakerRoutes.js`: update `GET /speakers/meetings/:id` response to include `guestLabel` and `isGuest` fields from metadata
- [ ] **8.8** Frontend `api.ts`: add `guestLabel?: string; isGuest?: boolean` to `SpeakerMapping` type
- [ ] **8.9** `TranscriptPanel.tsx`: add **Guest** badge (slate/grey, user icon) for `isGuest` speakers; update dual-key map to also index by `guestLabel`
- [ ] **8.10** `SpeakerAssignmentPopover.tsx`: when speaker `isGuest`, show "Identify this guest" CTA alongside normal assignment
- [ ] **8.11** (Optional) `SpeakerMatchingEngine.js`: `reVerifyUtterances()` second pass — compare each utterance segment embedding against enrolled + guest profiles; reassign if margin > 0.05

---

## 5. Full Implementation Dependency Order

```
✅ 1.1 → 1.2 → 1.3   (crashes)
✅ 2.1 → 3.1 → 3.2   (contract + VoiceTab)
✅ 2.2                (onboarding SNR field)
✅ 4.1 → 4.2 → 4.3 → 4.4   (post-meeting WS pipeline)
✅ 5.1 → 5.2 → 5.3   (infrastructure)
✅ 6.1 → 6.2 → 6.3   (quality)
✅ +A → +B → +C       (reprocess ordering + manual preservation)
✅ +D → +E            (badges + dual-key mapping)
✅ 7.1 → 7.2 → 7.3   (Python server mode + Node process manager + per-meeting ID)
✅ 7.4 → 7.5 → 7.6   (WS broadcast + TranscriptionService hook + AudioRecorder init)
✅ 7.7 → 7.8          (frontend live handler + type)
✅ +H → +I → +J       (IDENTIFY button fix + threshold + log)

⏳ 8.1 (DB migration)
    └─► 8.2 (service methods)
          └─► 8.3 + 8.4 (SpeakerMatchingEngine guest build)
                └─► 8.5 (cascade guest names)
                      └─► 8.6 (metadata field)
                            └─► 8.7 (route response)
                                  └─► 8.8 + 8.9 (frontend badge)
                                        └─► 8.10 (popover CTA)
                                              └─► 8.11 (optional re-verify)
```

---

## 6. Files Touched Per Layer

| Layer | Backend | Frontend | Python |
|-------|---------|----------|--------|
| 1–6 | `speakerRoutes.js`, `SpeakerMatchingEngine.js`, `SpeakerIdentificationService.js`, `WebSocketServer.js`, `PostMeetingProcessor.js`, `MeetingReprocessService.js` | `api.ts`, `Onboarding.tsx`, `VoiceTab.tsx`, `TranscriptPanel.tsx`, `MeetingDetails.tsx`, `SpeakerAssignmentPopover.tsx` | `VoiceEmbeddingService.py` |
| 7 (live ID) | `EmbeddingServerProcess.js` *(new)*, `LiveSpeakerIdentifier.js` *(new)*, `TranscriptionService.js`, `AudioRecorder.js`, `WebSocketServer.js` | `useLiveTranscript.ts`, `types.ts` | `VoiceEmbeddingService.py` (--server mode) |
| 8 (pending) | `SpeakerMatchingEngine.js`, `SpeakerIdentificationService.js`, `speakerRoutes.js`, migration script | `api.ts`, `TranscriptPanel.tsx`, `SpeakerAssignmentPopover.tsx` | — |
