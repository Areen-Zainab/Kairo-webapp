# Plan: Migrate Transcription to faster-whisper (CTranslate2)

This outlines what must change to move from the current Whisper/WhisperX stack to a native `faster-whisper` pipeline. No code has been changed yet.

## Why switch
- Lower latency and memory: CTranslate2 inference is typically 2–4x faster on CPU and faster still on GPU, with smaller RAM/VRAM use and optional quantization (int8/int8_float16).
- Operational control: local model caching, explicit device/compute type selection, and predictable performance across CPU/GPU targets.
- Same model quality: uses the original Whisper weights; WER deltas are minimal for standard quantization.

## Target touchpoints
- Python transcription entrypoint: `ai-layer/whisperX/transcribe-whisper.py` (currently WhisperX with faster-whisper under the hood).
- Backend orchestration and process management: `backend/src/services/TranscriptionService.js`, `backend/src/jobs/preloadModels.js`, and any model preloader hooks.
- Dependency manifests: root `requirements.txt`, `ai-layer/whisperX/requirements.txt`, and any Docker/base image layers if used.
- Audio I/O assumptions: FFmpeg usage and 16 kHz mono PCM expectations in the backend recording flow.

## Required changes

### 1) Dependencies and runtime
- Add `faster-whisper` (and `ctranslate2` extras if pinned separately) to `requirements.txt` and remove/stop installing `openai-whisper` if present.
- Ensure FFmpeg remains available (already bundled in `ai-layer/whisperX/ffmpeg.exe` for Windows; keep PATH injection).
- If targeting GPU, ensure CUDA/cuDNN versions match `faster-whisper` wheels; otherwise keep CPU with AVX2.

### 2) Model artifacts
- Decide model size and quantization (e.g., `small` with `int8_float16` for GPU or `int8` for CPU).
- Let `faster-whisper` auto-download to a writable cache (e.g., `~/.cache/huggingface` or a configured models dir), or pre-download to a shared path mounted in production.
- Optionally vendor a converted CTranslate2 model for deterministic startup and to avoid first-run downloads.

### 3) Python transcription logic
- Replace WhisperX-specific loading with `faster_whisper.WhisperModel`:
  - Initialize once at process start with `device` (`"cuda"`/`"cpu"`) and `compute_type` (e.g., `int8_float16`, `float16`, `int8`).
  - Drop WhisperX VAD/diarization wrappers unless needed; if diarization is required, plan a separate module (e.g., PyAnnote/Silero) and feed segments to faster-whisper.
- Update the transcription call to use `model.transcribe(audio, beam_size=5, language="en", vad_filter=...)` as appropriate.
- Keep existing stdout/stderr signaling used by `TranscriptionService` (e.g., success markers, error messages).
- Ensure audio is loaded as 16 kHz mono float32; retain the current FFmpeg-based `load_audio` or replace with direct ffmpeg pipe to numpy/torch audio array.

### 4) Backend orchestration
- Confirm the Node process manager still spawns the Python worker with the new script entrypoint and arguments; update paths in `TranscriptionService.js` if the script name changes.
- Preserve the existing request/response protocol (stdin file path → stdout transcript). If output format changes (e.g., include language, timing), update the parser accordingly.
- Update any model preloading hooks (`preloadModels.js` or `ModelPreloader`) to call the new initialization path so chunk 0 does not wait on model download/load.

### 5) Configuration surface
- Expose environment variables for:
  - `FAST_WHISPER_MODEL_SIZE` (tiny/base/small/medium/large-v2)
  - `FAST_WHISPER_DEVICE` (`cpu`/`cuda`)
  - `FAST_WHISPER_COMPUTE_TYPE` (`int8`, `int8_float16`, `float16`, `auto`)
  - Optional `FAST_WHISPER_CACHE_DIR` for model weights
- Default to CPU + int8 for portability; document recommended GPU settings.

### 6) Observability and safeguards
- Add structured logging around load time, per-request latency, and cache hits/misses.
- Add a readiness probe that asserts the model is loaded before the meeting bot joins (addresses the current “model not ready on chunk 0” issue).
- Keep a fallback path: if the faster-whisper worker fails, return a clear error to the queue instead of blocking.

### 7) Validation and rollout
- Benchmark on representative clips (short, long, noisy) and record:
  - Time-to-first-token and total latency vs current WhisperX path
  - Peak RAM/VRAM
  - WER vs current baseline (small sample is fine)
- Test both CPU and GPU configs if supported in the target environment.
- Staged rollout: enable behind a feature flag/env toggle; keep WhisperX as fallback until confidence is high.

## Open questions to resolve before coding
- Do we still require diarization in this process, or can diarization be handled separately and merged post-transcription?
- What target hardware(s) must we support (CPU-only vs GPU nodes)?
- Is first-run download acceptable in production, or do we need pre-baked model artifacts in images?

Once these are answered, we can implement the dependency swap, update the Python entrypoint, and adjust the backend process hooks.

