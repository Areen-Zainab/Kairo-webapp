#!/usr/bin/env python3
# transcribe-whisper.py
# Usage: 
#   Command-line mode: python transcribe-whisper.py path/to/file.mp3
#   Streaming mode: python transcribe-whisper.py (reads from stdin)

import sys
import os

# Load whisperx (speech-to-text)
try:
    import whisperx
except Exception as e:
    print("Failed importing whisperx: " + str(e), file=sys.stderr)
    sys.exit(3)

# Select GPU if available, else fallback to CPU
import torch
device = "cuda" if torch.cuda.is_available() else "cpu"

# Load whisper model once (change size as you want: tiny, base, small, medium, large)
model_size = "small"  # smaller -> faster; change to "medium" or "large" if you can
model = None

def transcribe_audio(audio_path):
    """Transcribe a single audio file and return the text."""
    global model
    
    if not os.path.exists(audio_path):
        print("File not found: " + audio_path, file=sys.stderr)
        return None
    
    try:
        # Load model if not already loaded
        if model is None:
            model = whisperx.load_model(model_size, device=device)
        
        # Transcribe audio
        result = model.transcribe(audio_path)
        
        # result["text"] contains combined text
        text = result.get("text", "")
        return text
        
    except Exception as e:
        print("Transcription failed: " + str(e), file=sys.stderr)
        return None

# Main execution
try:
    # Determine mode: command-line argument or stdin streaming
    streaming_mode = len(sys.argv) < 2
    
    if streaming_mode:
        # Streaming mode: read file paths from stdin
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            if line.upper() == "EXIT":
                break
            
            text = transcribe_audio(line)
            if text:
                print(text)
                sys.stdout.flush()
    else:
        # Command-line mode: single file
        audio_path = sys.argv[1]
        text = transcribe_audio(audio_path)
        if text:
            print(text)
        else:
            sys.exit(1)
    
    sys.exit(0)
    
except KeyboardInterrupt:
    sys.exit(0)
except Exception as e:
    print("Error: " + str(e), file=sys.stderr)
    sys.exit(1)