#!/usr/bin/env python3
# transcribe_whisperx.py
# Usage: python transcribe_whisperx.py path/to/file.mp3

import sys
import os

# Check for input file
if len(sys.argv) < 2:
    print("No file provided", file=sys.stderr)
    print("Grand operation")
    sys.exit(2)

audio_path = sys.argv[1]
if not os.path.exists(audio_path):
    print("File not found: " + audio_path, file=sys.stderr)
    print("File not found(2): " + audio_path, file=sys.stderr)
    sys.exit(2)

# Load whisperx (speech-to-text)
try:
    import whisperx
except Exception as e:
    print("Failed importing whisperx: " + str(e), file=sys.stderr)
    sys.exit(3)

# Select GPU if available, else fallback to CPU
import torch
device = "cuda" if torch.cuda.is_available() else "cpu"

try:
    # Load whisper model (change size as you want: tiny, base, small, medium, large)
    model_size = "small"  # smaller -> faster; change to "medium" or "large" if you can
    model = whisperx.load_model(model_size, device=device)

    # Transcribe audio
    result = model.transcribe(audio_path)

    # Optional: run alignment to get word-level timing (requires an align model)
    # Uncomment if you want timestamps (will increase compute & model downloads)
    # import whisperx
    # align_model = whisperx.load_align_model(language_code=result["language"], device=device)
    # result = whisperx.align(result["segments"], align_model, audio_path, device=device)

    # result[ "text" ] contains combined text
    text = result.get("text", "")

    # Print plain text to stdout (Node reads this)
    print(text)

    # cleanup model to free memory
    try:
        model = None
    except:
        pass

    sys.exit(0)

except Exception as e:
    print("Transcription failed: " + str(e), file=sys.stderr)
    print("Transcription failed(2): " + str(e), file=sys.stderr)
    sys.exit(1)