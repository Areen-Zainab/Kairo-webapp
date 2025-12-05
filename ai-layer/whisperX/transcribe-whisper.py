#!/usr/bin/env python3
# transcribe-whisper.py
# Usage: 
#   Command-line mode: python transcribe-whisper.py path/to/file.mp3
#   Streaming mode: python transcribe-whisper.py (reads from stdin)

# ============================================================================
# FIX: Prevent PyTorch resource deadlock on Windows
# ============================================================================
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"

# Set threading before importing torch/transformers
import sys
import os

# Add ffmpeg to PATH if it's in the current directory
current_dir = os.path.dirname(os.path.abspath(__file__))
os.environ["PATH"] = current_dir + os.pathsep + os.environ["PATH"]

# Load whisperx (speech-to-text)
try:
    import torch
    torch.set_num_threads(1)  # Prevent threading conflicts
    import whisperx
    import torch
except Exception as e:
    print(f"Failed importing dependencies: {e}", file=sys.stderr)
    sys.exit(3)

# Select GPU if available, else fallback to CPU
device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "float16" if device == "cuda" else "int8"

# Model configuration
model_size = "small"  # Options: tiny, base, small, medium, large-v2
model = None

print(f"[Kairo Transcription] Device: {device}", file=sys.stderr)
print(f"[Kairo Transcription] Model: {model_size}", file=sys.stderr)

def transcribe_audio(audio_path):
    """Transcribe a single audio file and return the text."""
    global model
    
    if not os.path.exists(audio_path):
        print(f"[Error] File not found: {audio_path}", file=sys.stderr)
        return None
    
    try:
        # Load model if not already loaded
        if model is None:
            print("[Kairo] Loading WhisperX model...", file=sys.stderr)
            model = whisperx.load_model(model_size, device=device, compute_type=compute_type)
            print("[Kairo] ✓ Model loaded successfully", file=sys.stderr)
        
        # Load audio
        print(f"[Kairo] Processing: {audio_path}", file=sys.stderr)
        audio = whisperx.load_audio(audio_path)
        
        # Transcribe audio
        result = model.transcribe(audio, batch_size=16)
        
        # Extract text from segments
        if "segments" in result:
            text = " ".join([seg["text"].strip() for seg in result["segments"]])
        else:
            text = result.get("text", "")
        
        print(f"[Kairo] ✓ Transcription complete. Language: {result.get('language', 'unknown')}", file=sys.stderr)
        
        return text.strip()
        
    except Exception as e:
        print(f"[Error] Transcription failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return None

def main():
    """Main execution function"""
    try:
        # Determine mode: command-line argument or stdin streaming
        streaming_mode = len(sys.argv) < 2
        
        if streaming_mode:
            print("[Kairo] Starting streaming mode (reading from stdin)...", file=sys.stderr)
            print("[Kairo] Send audio file paths, one per line. Type 'EXIT' to quit.", file=sys.stderr)
            
            # Streaming mode: read file paths from stdin
            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue
                if line.upper() == "EXIT":
                    print("[Kairo] Exiting...", file=sys.stderr)
                    break
                
                text = transcribe_audio(line)
                if text:
                    # Output only the transcription text to stdout
                    print(text)
                    sys.stdout.flush()
                else:
                    print("", file=sys.stdout)  # Empty line on failure
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
        print("\n[Kairo] Interrupted by user", file=sys.stderr)
        sys.exit(0)
    except Exception as e:
        print(f"[Error] {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()