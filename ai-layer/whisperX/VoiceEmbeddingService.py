#!/usr/bin/env python3
"""
VoiceEmbeddingService.py
Phase 2: Speaker Identification — Voice Fingerprint Engine

Canonical storage (must match Prisma `UserVoiceEmbedding.embedding`):
  pgvector **vector(192)** — SpeechBrain ECAPA-TDNN outputs 192-dim natively; if the
  pyannote fallback yields 256-dim, `generate_embedding` trims or zero-pads to 192
  before JSON output and DB insert (see Dimension Guard below).

Responsibilities:
  1. Load an audio file (signup sample OR meeting segment)
  2. Validate Signal-to-Noise Ratio (reject noisy audio)
  3. Generate a normalized L2 speaker embedding (192 floats for DB) — prefer
     SpeechBrain ECAPA-TDNN (192-dim); optional pyannote ResNet34 (256-dim → normalized to 192)
  4. Compare two embeddings via cosine similarity
  5. Output results as JSON to stdout (stderr for logs)

Usage:
  # Generate embedding from an audio file:
  python VoiceEmbeddingService.py embed <audio_path>

  # Compare two audio files (returns cosine similarity):
  python VoiceEmbeddingService.py compare <audio_path_1> <audio_path_2>

  # Validate audio quality only:
  python VoiceEmbeddingService.py validate <audio_path>

Output format (stdout, JSON):
  { "status": "ok", "embedding": [...192 floats...], "dimensions": 192, "snr_db": 22.4 }
  { "status": "error", "reason": "snr_too_low", "snr_db": 8.1, "threshold": 15.0 }
  { "status": "ok", "similarity": 0.91, "identified": true }
"""

import os
import sys
import json
import numpy as np
import warnings

# Hide noisy third-party warnings (torchaudio/speechbrain/hf hub) unless they become real errors.
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

# Prevent PyTorch threading deadlock on Windows
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"

# Fix Windows UTF-8 console output
if sys.platform == "win32":
    import io
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    else:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# --- Logging helpers (always to stderr so stdout is clean JSON) ---
def log(msg):
    print(f"[VoiceEmbedding] {msg}", file=sys.stderr, flush=True)

def emit(data: dict):
    """Emit JSON result to stdout and flush."""
    print(json.dumps(data, ensure_ascii=False), flush=True)


# ============================================================
# SNR VALIDATION
# ============================================================
SNR_THRESHOLD_DB = 6.0    # (Frontend enforces 15dB; backend keeps forgiving SNR but still rejects too-short)
MIN_DURATION_SEC = 15.0   # Hard safety: never accept/enroll shorter than 15s
RECOMMENDED_DURATION_SEC = 30.0

def compute_snr(audio_np: np.ndarray, sample_rate: int) -> float:
    """
    Estimate Signal-to-Noise Ratio using a simple energy-based approach.
    
    Method: 
      - Sort audio frames by energy
      - Bottom 10% = noise floor estimate
      - Top 90% = signal estimate
      - SNR = 10 * log10(signal_power / noise_power)
    
    Returns SNR in dB. Higher is better (>15dB = acceptable for embeddings).
    """
    # Use short frames (25ms windows)
    frame_length = int(sample_rate * 0.025)
    if len(audio_np) < frame_length * 2:
        return 0.0

    # Split audio into frames and compute per-frame energy
    num_frames = len(audio_np) // frame_length
    frames = audio_np[:num_frames * frame_length].reshape(num_frames, frame_length)
    energies = np.mean(frames ** 2, axis=1)

    if np.max(energies) == 0:
        return 0.0

    # Sort energies: bottom 10% = noise, rest = signal
    sorted_energies = np.sort(energies)
    noise_cutoff = max(1, int(num_frames * 0.10))
    noise_power = np.mean(sorted_energies[:noise_cutoff]) + 1e-10
    signal_power = np.mean(sorted_energies[noise_cutoff:]) + 1e-10

    snr_db = 10.0 * np.log10(signal_power / noise_power)
    return float(snr_db)


def validate_audio(audio_np: np.ndarray, sample_rate: int, audio_path: str):
    """
    Validate audio quality. Returns (is_valid, snr_db, reason).
    """
    duration_sec = len(audio_np) / sample_rate
    
    # Check duration
    if duration_sec < MIN_DURATION_SEC:
        return False, 0.0, f"audio_too_short (got {duration_sec:.1f}s, need ≥{MIN_DURATION_SEC}s)"
    
    # Check SNR
    snr_db = compute_snr(audio_np, sample_rate)
    if snr_db < SNR_THRESHOLD_DB:
        return False, snr_db, f"snr_too_low (got {snr_db:.1f}dB, need ≥{SNR_THRESHOLD_DB}dB)"
    
    return True, snr_db, "ok"


# ============================================================
# AUDIO LOADING (via torchaudio with ffmpeg fallback)
# ============================================================
TARGET_SAMPLE_RATE = 16000  # 16kHz mono — standard for speaker models

def load_audio(audio_path: str):
    """
    Load audio file and resample to 16kHz mono with automatic gain normalization.
    Tries torchaudio first, silently falls back to ffmpeg for browser formats (WebM/OGG).
    Only logs an error if all methods fail.
    """
    import torch
    import torchaudio
    import subprocess

    # 1. Try torchaudio (silent — browser WebM often fails here on Windows)
    try:
        waveform, sr = torchaudio.load(audio_path)
    except Exception:
        # 2. FFmpeg fallback — handles WebM, OGG and other browser-recorded formats
        tmpfile = audio_path + ".resampled.wav"
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", audio_path, "-ac", "1", "-ar", str(TARGET_SAMPLE_RATE), tmpfile],
                check=True, capture_output=True
            )
            waveform, sr = torchaudio.load(tmpfile)
            if os.path.exists(tmpfile): os.remove(tmpfile)
        except Exception as e2:
            raise Exception(f"Failed to load audio (all methods exhausted): {e2}")

    # 3. Resample if needed
    if sr != TARGET_SAMPLE_RATE:
        import torchaudio.transforms as T
        resampler = T.Resample(sr, TARGET_SAMPLE_RATE)
        waveform = resampler(waveform)
    
    # Convert to mono if multi-channel
    if waveform.shape[0] > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)
        
    # Normalize gain to ensure signal is strong (Auto-Gain) 
    # Helps with "Background noise is too high" due to low levels
    max_amp = torch.max(torch.abs(waveform))
    if max_amp > 1e-6:
        waveform = waveform / max_amp * 0.9 # Target 0.9 peak
        
    return waveform.squeeze().numpy().astype(np.float32), TARGET_SAMPLE_RATE


# ============================================================
# EMBEDDING GENERATION
# ============================================================
_encoder = None

def get_encoder():
    """
    Lazy-load the speaker embedding model.
    
    Strategy:
      1. Try SpeechBrain ECAPA-TDNN (192-dim, most accurate)
      2. Fallback to pyannote Embedding (256-dim)
      3. Fallback to lightweight MFCC mean (64-dim, for testing only)
    """
    global _encoder
    if _encoder is not None:
        return _encoder

    # --- Option 1: SpeechBrain ECAPA-TDNN ---
    try:
        from speechbrain.inference.speaker import EncoderClassifier
        log("Loading SpeechBrain ECAPA-TDNN encoder...")
        classifier = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            run_opts={"device": "cpu"}
        )
        _encoder = ("speechbrain", classifier)
        log("SpeechBrain ECAPA-TDNN encoder ready (192-dim)")
        return _encoder
    except Exception as e:
        log(f"SpeechBrain not available: {e}")

    # --- Option 2: Pyannote Embedding ---
    try:
        from pyannote.audio import Inference, Model
        log("Loading pyannote speaker embedding model...")
        model = Model.from_pretrained("pyannote/wespeaker-voxceleb-resnet34-LM")
        inference = Inference(model, window="whole")
        _encoder = ("pyannote", inference)
        log("pyannote ResNet34 encoder ready (256-dim)")
        return _encoder
    except Exception as e:
        log(f"pyannote Inference not available: {e}")

    # --- Option 3: MFCC fallback (development/testing only) ---
    log("WARNING: Using MFCC fallback encoder (dev mode only, not suitable for production)")
    _encoder = ("mfcc", None)
    return _encoder


def generate_embedding(audio_np: np.ndarray, sample_rate: int) -> np.ndarray:
    """
    Generate a normalized L2 speaker embedding vector.
    
    Returns a 1D numpy array (normalized to unit length).
    Dimension depends on available encoder:
      - SpeechBrain ECAPA: 192-dim
      - pyannote ResNet34: 256-dim  
      - MFCC fallback: 64-dim
    """
    import torch

    encoder_type, encoder = get_encoder()

    if encoder_type == "speechbrain":
        # SpeechBrain expects a tensor of shape [1, samples]
        waveform = torch.tensor(audio_np).unsqueeze(0)
        with torch.no_grad():
            embedding = encoder.encode_batch(waveform)
        vec = embedding.squeeze().numpy()

    elif encoder_type == "pyannote":
        # pyannote Inference accepts a dict with waveform + sample_rate
        waveform = torch.tensor(audio_np).unsqueeze(0)
        embedding = encoder({"waveform": waveform, "sample_rate": sample_rate})
        vec = np.array(embedding).flatten()

    else:
        # MFCC fallback
        import torchaudio.transforms as T
        waveform = torch.tensor(audio_np).unsqueeze(0)
        mfcc = T.MFCC(sample_rate=sample_rate, n_mfcc=64)(waveform)
        vec = mfcc.mean(dim=-1).squeeze().numpy()

    # Dimension Guard: Ensure we match the DB (pgvector(192))
    if len(vec) != 192:
        log(f"WARNING: Embedding dimension mismatch! Expected 192, got {len(vec)}. Mapping to 192...")
        # Simple padding or trimming if absolutely necessary (though SpeechBrain is 192)
        if len(vec) > 192:
            vec = vec[:192]
        else:
            vec = np.pad(vec, (0, 192 - len(vec)), 'constant')
            
    # L2 normalize to unit sphere for cosine similarity
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.astype(np.float32)


# ============================================================
# COSINE SIMILARITY
# ============================================================

def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """
    Compute cosine similarity between two L2-normalized vectors.
    Returns value in [-1, 1]. 1.0 = identical, 0.0 = unrelated.
    """
    dot = float(np.dot(vec_a, vec_b))
    norm_a = float(np.linalg.norm(vec_a))
    norm_b = float(np.linalg.norm(vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ============================================================
# COMMANDS
# ============================================================

CONFIDENCE_THRESHOLD = 0.82  # Must match Tier 1 threshold in the master plan

def cmd_embed(audio_path: str):
    """
    Generate and return an embedding for a single audio file.
    Validates SNR before processing.
    """
    log(f"Embedding: {os.path.basename(audio_path)}")
    
    try:
        audio_np, sr = load_audio(audio_path)
        is_valid, snr_db, reason = validate_audio(audio_np, sr, audio_path)
        
        if not is_valid:
            emit({
                "status": "error",
                "reason": reason,
                "snr_db": round(snr_db, 2),
                "threshold_db": SNR_THRESHOLD_DB,
                "action": "please_re_record_in_quieter_environment"
            })
            return

        embedding = generate_embedding(audio_np, sr)
        duration_sec = len(audio_np) / sr

        emit({
            "status": "ok",
            "embedding": embedding.tolist(),
            "dimensions": len(embedding),
            "snr_db": round(snr_db, 2),
            "duration_sec": round(duration_sec, 2),
            "sample_rate": sr
        })
        log(f"Embedding complete: {len(embedding)}-dim, SNR={snr_db:.1f}dB, dur={duration_sec:.1f}s")

    except FileNotFoundError as e:
        emit({"status": "error", "reason": "file_not_found", "details": str(e)})
    except Exception as e:
        emit({"status": "error", "reason": "processing_failed", "details": str(e)})
        import traceback; traceback.print_exc(file=sys.stderr)


def cmd_compare(audio_path_1: str, audio_path_2: str):
    """
    Compare two audio files and return cosine similarity + identification decision.
    Used by Tier 1 matching engine.
    """
    log(f"Comparing: {os.path.basename(audio_path_1)} vs {os.path.basename(audio_path_2)}")

    try:
        audio1, sr1 = load_audio(audio_path_1)
        audio2, sr2 = load_audio(audio_path_2)

        # Validate both files
        valid1, snr1, reason1 = validate_audio(audio1, sr1, audio_path_1)
        valid2, snr2, reason2 = validate_audio(audio2, sr2, audio_path_2)

        if not valid1:
            emit({"status": "error", "reason": f"file1_invalid: {reason1}", "snr_db": round(snr1, 2)})
            return
        if not valid2:
            emit({"status": "error", "reason": f"file2_invalid: {reason2}", "snr_db": round(snr2, 2)})
            return

        emb1 = generate_embedding(audio1, sr1)
        emb2 = generate_embedding(audio2, sr2)
        similarity = cosine_similarity(emb1, emb2)
        identified = similarity >= CONFIDENCE_THRESHOLD

        emit({
            "status": "ok",
            "similarity": round(similarity, 4),
            "identified": identified,
            "confidence_threshold": CONFIDENCE_THRESHOLD,
            "tier": 1,
            "snr_file1_db": round(snr1, 2),
            "snr_file2_db": round(snr2, 2)
        })
        log(f"Similarity: {similarity:.4f} ({'MATCH' if identified else 'NO MATCH'})")

    except FileNotFoundError as e:
        emit({"status": "error", "reason": "file_not_found", "details": str(e)})
    except Exception as e:
        emit({"status": "error", "reason": "comparison_failed", "details": str(e)})
        import traceback; traceback.print_exc(file=sys.stderr)


def cmd_validate(audio_path: str):
    """
    Validate audio quality only (no embedding). Fast check before recording acceptance.
    """
    log(f"Validating: {os.path.basename(audio_path)}")
    try:
        audio_np, sr = load_audio(audio_path)
        is_valid, snr_db, reason = validate_audio(audio_np, sr, audio_path)
        duration_sec = len(audio_np) / sr

        emit({
            "status": "ok" if is_valid else "rejected",
            "valid": is_valid,
            "snr_db": round(snr_db, 2),
            "threshold_db": SNR_THRESHOLD_DB,
            "duration_sec": round(duration_sec, 2),
            "recommended_duration_sec": RECOMMENDED_DURATION_SEC,
            "reason": reason,
            "action": "accepted" if is_valid else "please_re_record_in_quieter_environment"
        })
    except FileNotFoundError as e:
        emit({"status": "error", "reason": "file_not_found", "details": str(e)})
    except Exception as e:
        emit({"status": "error", "reason": "validation_failed", "details": str(e)})


# ============================================================
# MAIN
# ============================================================

def main():
    if len(sys.argv) < 3:
        emit({
            "status": "error",
            "reason": "usage",
            "usage": {
                "embed": "python VoiceEmbeddingService.py embed <audio_path>",
                "compare": "python VoiceEmbeddingService.py compare <audio1> <audio2>",
                "validate": "python VoiceEmbeddingService.py validate <audio_path>"
            }
        })
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "embed":
        cmd_embed(sys.argv[2])
    elif command == "compare":
        if len(sys.argv) < 4:
            emit({"status": "error", "reason": "compare requires two audio paths"})
            sys.exit(1)
        cmd_compare(sys.argv[2], sys.argv[3])
    elif command == "validate":
        cmd_validate(sys.argv[2])
    else:
        emit({"status": "error", "reason": f"unknown command '{command}'", "valid_commands": ["embed", "compare", "validate"]})
        sys.exit(1)


if __name__ == "__main__":
    main()
