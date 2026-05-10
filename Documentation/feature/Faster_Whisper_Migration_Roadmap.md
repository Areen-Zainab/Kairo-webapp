# Migration Roadmap: WhisperX to Native faster-whisper

This document outlines the systematic migration from the current `whisperX` engine to fully native `faster-whisper` for Kairo's transcription layer. 

**Last Updated:** April 9, 2026

## 1. Context & Architectural Reality
Our current pipeline relies heavily on `whisperX` as a wrapper script inside `ai-layer/whisperX/transcribe-whisper.py`. However, deep analysis of the current infrastructure confirms we are *already* bypassing most of its features:
* **Live Transcription:** We manually disable its PyAnnote VAD logic (`WHISPERX_DISABLE_PYANNOTE=1`) and dynamically drill through to its underlying `faster-whisper` object reference to process live ~3s chunks.
* **Speaker Identification / Fingerprinting:** Completely detached from transcription. Identification occurs via a robust, independent 4-tier Node.js engine (`SpeakerMatchingEngine.js`) linked natively to a separate embedding generation engine (`VoiceEmbeddingService.py`) utilizing `SpeechBrain` and isolated FFmpeg slicing.
* **The Only WhisperX Dependency:** The **sole** remaining requirement keeping WhisperX alive is the post-meeting step where `TranscriptionService.js` invokes `transcribe-whisper.py --diarize`. This uses `whisperx.DiarizationPipeline` and `whisperx.assign_word_speakers()` directly over the final merged audio payload.

## 2. Why Migrate?
- **Dependency Bloat & Version Fragmentation:** WhisperX forces a sprawling matrix of dependencies. Its outdated `transformers` and `torch` calls consistently trigger runtime exceptions (such as the PyTorch `weights_only` safeguard patches we had to inject explicitly into the python header).
- **Latency & Memory Optimizations:** Native `faster-whisper` (backed by CTranslate2) cuts initialization timelines and VRAM/RAM footprints significantly. Without the monolithic wrapper, worker threads idle and execute faster.
- **Native VAD Controls:** Directly invoking `faster-whisper` allows us to leverage its built-in Silero VAD parameters efficiently, removing our messy wrapper hacks around initialization flags and string-binding errors.

---

## 3. Execution Plan

### Phase 1: Pure Live Transcription Cutover
We will forcefully decouple the live textual transcription engine from the speaker diarization pipeline entirely.
1. **Dependency Overhaul:** Eradicate `whisperx` from `requirements.txt`. Ensure `faster-whisper` is exclusively pinned alongside its CTranslate2 dependencies. 
2. **Rewrite `transcribe-whisper.py`:** 
   - Strip all monkey-patches for PyTorch safe globals.
   - Initialize `faster_whisper.WhisperModel(model_size, device="cpu", compute_type="int8")` concisely without `whisperx.load_model`.
   - Exploit native `vad_filter=True` in the transcription call.
   - Maintain the precise JSON and string `stdout` protocols (e.g., `[TRANSCRIPTION_FAILED]`) so that the Node listener in `TranscriptionService.js` interprets status indicators natively.

### Phase 2: Standalone Diarization Script
Because removing WhisperX breaks the `--diarize` flag hook, we must spin up a lightweight alternative purely for post-meeting diarization.
1. **Create `diarize.py`:** Write a dedicated script running the core `pyannote.audio` diarization pipeline natively over the stitched `complete_audio.wav` file.
2. **Alignment & Word Merging:** Re-implement basic timeline overlap logic (mapping `faster-whisper` timestamp bounds with PyAnnote's speaker boundary boundaries) effectively replicating `assign_word_speakers()`.
3. **Node Router Overhaul:** Modify `TranscriptionService.js` (near line 1437) to redirect the `--diarize` child process spawn from `transcribe-whisper.py --diarize` to point towards the new `diarize.py` entrypoint.

### Phase 3: Hardware Scalability & Deployment Profiles
1. Surface modular environment properties mapping hardware constraints, bridging Node's `ModelPreloader.js` to dynamic execution:
   - `FAST_WHISPER_DEVICE` (`cpu`/`cuda`)
   - `FAST_WHISPER_COMPUTE_TYPE` (`int8`, `float16`)
2. Maintain `VoiceEmbeddingService.py` without disruption; since its `SpeechBrain` biometric analysis relies exclusively on extracted audio WAV chunks cut by `ffmpeg`, it avoids all downstream impacts from the Whisper framework toggle.

---

## 4. Open Questions Resolved
- **"Do we still require diarization in this process, or can it be handled separately?"**
  *Resolved:* Yes, diarization is strictly an asynchronous post-meeting computation run exclusively over the stitched meeting audio payload. Live transient transcription chunks bypass it entirely. This guarantees we can safely detach it into a dedicated script (`diarize.py`).
- **"What does this mean for our newly constructed Voice Fingerprinting pipeline?"**
  *Resolved:* Zero impact. `SpeakerMatchingEngine.js` triggers distinct FFmpeg segment slices based securely on diarized timestamp geometries and delegates extraction completely asynchronously. Native Whisper migrations will impose no breaks against identity verification processing.
