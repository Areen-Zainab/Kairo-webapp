#!/usr/bin/env python3
# transcribe-whisper.py
#
# Modes:
# 1) One-shot: python transcribe-whisper.py path/to/file
# 2) Streaming: python transcribe-whisper.py  (then send file paths on stdin, one per line; prints one line of text per path)

import sys
import os

try:
    import whisperx
except Exception as e:
    print("Failed importing whisperx: " + str(e), file=sys.stderr)
    sys.exit(3)

import torch
device = "cuda" if torch.cuda.is_available() else "cpu"

def load_model():
    model_size = os.environ.get("WHISPERX_MODEL", "small")
    return whisperx.load_model(model_size, device=device, compute_type="float32")


def transcribe_file(model, audio_path: str) -> str:
    try:
        if not os.path.exists(audio_path):
            return ""
        result = model.transcribe(audio_path)
        return result.get("text", "").strip()
    except Exception as e:
        print("Transcription failed: " + str(e), file=sys.stderr)
        return ""

def run_one_shot(path_arg: str) -> int:
    if not os.path.exists(path_arg):
        print("File not found: " + path_arg, file=sys.stderr)
        return 2
    model = load_model()
    text = transcribe_file(model, path_arg)
    print(text)
    return 0

def run_streaming() -> int:
    model = load_model()
    try:
        for line in sys.stdin:
            p = line.strip()
            if not p:
                continue
            if p.upper() == "EXIT":
                break
            text = transcribe_file(model, p)
            # print a single-line response per path
            print(text, flush=True)
    except KeyboardInterrupt:
        pass
    return 0

def main():
    if len(sys.argv) >= 2:
        code = run_one_shot(sys.argv[1])
        sys.exit(code)
    else:
        code = run_streaming()
        sys.exit(code)

if __name__ == "__main__":
    main()
