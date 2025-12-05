#!/usr/bin/env python3
# transcribe-whisper.py
# Usage:
#   Command-line mode: python transcribe-whisper.py path/to/file.mp3
#   Streaming mode: python transcribe-whisper.py (reads file paths from stdin)

import sys
import os
import io

# Fix Windows console encoding for Unicode output
if sys.platform == 'win32':
    # Set stdout to UTF-8 encoding to handle Unicode characters
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    else:
        # Fallback for older Python versions
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
    else:
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# --- Ensure ffmpeg in PATH if it's in the same directory as this script ---
current_dir = os.path.dirname(os.path.abspath(__file__))
os.environ["PATH"] = current_dir + os.pathsep + os.environ.get("PATH", "")

# --- PREVENT Pyannote VAD from being used (avoids HF auth / checkpoint issues) ---
# Set this before importing whisperx or any library that may load checkpoints.
os.environ["WHISPERX_DISABLE_PYANNOTE"] = "1"

# Import torch first to configure safe globals for PyTorch 2.6+
import torch
import collections

# Fix PyTorch 2.6+ weights_only issue by allowlisting safe globals
# This must be done before any torch.load calls (which happen in whisperx/pyannote)
try:
    import typing
    from omegaconf.listconfig import ListConfig
    from omegaconf.base import ContainerMetadata
    # Add all necessary classes that may be used in checkpoints
    torch.serialization.add_safe_globals([
        collections.defaultdict, 
        ListConfig,
        ContainerMetadata,
        typing.Any
    ])
except ImportError:
    # If omegaconf is not available, just add collections.defaultdict
    try:
        torch.serialization.add_safe_globals([collections.defaultdict])
    except AttributeError:
        pass
except AttributeError:
    # Older PyTorch versions don't have add_safe_globals
    pass

# Monkey-patch torch.load as a fallback for PyTorch 2.6+ weights_only issue
# This allows loading models from trusted sources (HuggingFace, etc.)
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    """Patched torch.load that sets weights_only=False for trusted model sources."""
    # Always override weights_only to False for compatibility with PyTorch 2.6+
    kwargs['weights_only'] = False
    return _original_torch_load(*args, **kwargs)

# Only patch if we're on PyTorch 2.6+ (which has weights_only defaulting to True)
if hasattr(torch, '__version__'):
    try:
        version_parts = torch.__version__.split('.')
        major, minor = int(version_parts[0]), int(version_parts[1])
        if major > 2 or (major == 2 and minor >= 6):
            torch.load = _patched_torch_load
    except (ValueError, IndexError):
        pass

# Configure logging to redirect WhisperX logs to stderr
import logging
logging.basicConfig(
    level=logging.WARNING,  # Only show warnings and errors
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr  # Redirect all logs to stderr
)

# Suppress WhisperX INFO and DEBUG logs (they're too verbose)
logging.getLogger('whisperx').setLevel(logging.WARNING)
logging.getLogger('whisperx.asr').setLevel(logging.WARNING)

# Now import whisperx
import whisperx

# Force CPU usage (no GPU)
device = "cpu"
compute_type = "int8"  # Use int8 for CPU (faster, lower memory)

# Model configuration
model_size = "base"  # tiny, base, small, medium, large-v2
model = None

print(f"[Kairo Transcription] Device: {device} (CPU-only mode)", file=sys.stderr)
print(f"[Kairo Transcription] Model: {model_size}", file=sys.stderr)
print(f"[Kairo Transcription] Compute type: {compute_type}", file=sys.stderr)


def load_whisperx_model():
    """Load WhisperX model with VAD properly configured."""
    global model
    if model is not None:
        return model

    print("[Kairo] Loading WhisperX model...", file=sys.stderr)
    try:
        # Load model without specifying vad_model parameter
        # With WHISPERX_DISABLE_PYANNOTE=1, it should use Silero VAD automatically
        model = whisperx.load_model(
            model_size,
            device=device,
            compute_type=compute_type,
        )
        
        # Check if vad_model is incorrectly set as a string and fix it
        if hasattr(model, 'vad_model') and isinstance(model.vad_model, str):
            print(f"[Warning] VAD model is a string '{model.vad_model}', attempting to fix...", file=sys.stderr)
            # Try to reload without VAD or with proper VAD initialization
            # For now, set it to None to disable VAD
            model.vad_model = None
        
        print("[Kairo] ✓ Model loaded successfully", file=sys.stderr)
        return model

    except Exception as e:
        print(f"[Error] Failed to load WhisperX model: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        raise


def transcribe_audio(audio_path):
    """Transcribe a single audio file and return the text (or None on failure)."""
    global model

    if not os.path.exists(audio_path):
        print(f"[Error] File not found: {audio_path}", file=sys.stderr)
        return None

    try:
        # Load model if not already loaded
        if model is None:
            load_whisperx_model()

        # Load audio (whisperx will handle common media containers via ffmpeg)
        print(f"[Kairo] Processing: {audio_path}", file=sys.stderr)
        audio = whisperx.load_audio(audio_path)

        # Transcribe audio
        # For CPU: use smaller batch size (4-8) to avoid memory issues
        batch_size = 4 if device == "cpu" else 16
        
        # Check if VAD model is a string (broken state) - use underlying model directly
        if hasattr(model, 'vad_model') and isinstance(model.vad_model, str):
            print("[Warning] VAD model is incorrectly set as string, using underlying Whisper model directly", file=sys.stderr)
            # Access the underlying faster-whisper model and transcribe directly
            # WhisperX wraps faster-whisper, so model.model should be the underlying model
            if hasattr(model, 'model'):
                underlying_model = model.model
                # Use faster-whisper's transcribe method directly
                segments, info = underlying_model.transcribe(audio, beam_size=5, language=None)
                # Convert segments to WhisperX format
                result = {
                    "segments": [{"text": segment.text.strip()} for segment in segments],
                    "language": info.language
                }
            else:
                # Fallback: try to fix vad_model by setting it to None
                original_vad = model.vad_model
                try:
                    model.vad_model = None
                    result = model.transcribe(audio, batch_size=batch_size)
                except:
                    # If that fails, restore and try one more time
                    model.vad_model = original_vad
                    result = model.transcribe(audio, batch_size=batch_size)
        else:
            result = model.transcribe(audio, batch_size=batch_size)

        # Extract text from segments if available
        if isinstance(result, dict) and "segments" in result:
            text = " ".join([seg.get("text", "").strip() for seg in result["segments"]])
        else:
            # Some versions return an object with .text or just a string
            text = ""
            if isinstance(result, dict):
                text = result.get("text", "") or ""
            elif hasattr(result, "text"):
                text = getattr(result, "text") or ""
            elif isinstance(result, str):
                text = result
            text = text.strip()

        print(f"[Kairo] ✓ Transcription complete. Language: {result.get('language', 'unknown') if isinstance(result, dict) else 'unknown'}", file=sys.stderr)
        return text.strip() if text else None

    except Exception as e:
        print(f"[Error] Transcription failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return None


def transcribe_audio_with_diarization(audio_path):
    """
    Transcribe audio with speaker diarization.
    Returns a dict with 'segments' (list of dicts with 'start', 'end', 'text', 'speaker') and 'language'.
    """
    global model, device
    
    if not os.path.exists(audio_path):
        print(f"[Error] File not found: {audio_path}", file=sys.stderr)
        return None

    try:
        # Load model if not already loaded
        if model is None:
            load_whisperx_model()
        
        # Load audio
        print(f"[Kairo] Processing for diarization: {audio_path}", file=sys.stderr)
        audio = whisperx.load_audio(audio_path)
        
        # Transcribe
        batch_size = 4 if device == "cpu" else 16
        result = model.transcribe(audio, batch_size=batch_size)
        
        # Perform diarization
        print("[Kairo] Performing speaker diarization...", file=sys.stderr)
        try:
            diarize_model = whisperx.DiarizationPipeline(use_auth_token=None, device=device)
            diarize_segments = diarize_model(audio)
            
            # Align transcription with diarization
            result = whisperx.assign_word_speakers(diarize_segments, result)
        except Exception as diarize_error:
            print(f"[Warning] Diarization failed, continuing without speaker labels: {diarize_error}", file=sys.stderr)
            # Continue without diarization - result will still have segments
        
        # Format output
        segments = []
        if "segments" in result:
            for seg in result["segments"]:
                segments.append({
                    "start": seg.get("start", 0.0),
                    "end": seg.get("end", 0.0),
                    "text": seg.get("text", "").strip(),
                    "speaker": seg.get("speaker", "SPEAKER_00")
                })
        
        return {
            "segments": segments,
            "language": result.get("language", "unknown")
        }
        
    except Exception as e:
        print(f"[Error] Diarization failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return None


def main():
    """Main execution function: CLI single-file mode or streaming mode (stdin)."""
    try:
        streaming_mode = len(sys.argv) < 2

        if streaming_mode:
            print("[Kairo] Starting streaming mode (reading from stdin)...", file=sys.stderr)
            print("[Kairo] Send audio file paths, one per line. Type 'EXIT' to quit.", file=sys.stderr)

            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue
                if line.upper() == "EXIT":
                    print("[Kairo] Exiting...", file=sys.stderr)
                    break
                
                # PRELOAD command: just load the model without transcribing
                if line.upper() == "PRELOAD":
                    print("[Kairo] Preloading model...", file=sys.stderr)
                    load_whisperx_model()
                    # Don't output anything to stdout - this would consume a resolver
                    # The model is loaded, ready for transcription requests
                    continue

                text = transcribe_audio(line)
                if text:
                    # Output only the transcription text to stdout
                    # Filter out any log-like messages that might have leaked
                    if not text.startswith(('2025-', '[', 'WARNING', 'INFO', 'DEBUG', 'ERROR')):
                        print(text)
                        sys.stdout.flush()
                    else:
                        # This looks like a log message, don't output it
                        print("", file=sys.stdout)
                        sys.stdout.flush()
                else:
                    # Empty line on failure to keep stream consistent
                    print("", file=sys.stdout)
                    sys.stdout.flush()
        else:
            # Command-line mode: single file
            audio_path = sys.argv[1]
            diarize_mode = len(sys.argv) > 2 and sys.argv[2] == '--diarize'
            
            if diarize_mode:
                # Diarization mode: output JSON with segments
                import json
                result = transcribe_audio_with_diarization(audio_path)
                if result:
                    # Output only JSON to stdout, all logs to stderr
                    print(json.dumps(result, ensure_ascii=False))
                    sys.stdout.flush()
                else:
                    sys.exit(1)
            else:
                # Regular transcription mode
                text = transcribe_audio(audio_path)
                if text:
                    print(text)
                else:
                    # non-zero exit on failure
                    sys.exit(1)

        sys.exit(0)

    except KeyboardInterrupt:
        print("\n[Kairo] Interrupted by user", file=sys.stderr)
        sys.exit(0)
    except Exception as e:
        print(f"[Error] {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
