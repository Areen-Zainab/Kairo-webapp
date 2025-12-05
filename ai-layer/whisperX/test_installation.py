#!/usr/bin/env python3
"""
Test script to verify WhisperX installation
Run with: python test_installation.py
"""

import sys
import os

# Set environment variable BEFORE importing whisperx to disable Pyannote
os.environ["WHISPERX_DISABLE_PYANNOTE"] = "1"

print("=" * 60)
print("WhisperX Installation Test")
print("=" * 60)
print()

# Test 1: Python version
print("1. Checking Python version...")
print(f"   Python version: {sys.version}")
python_version = sys.version_info
if python_version.major == 3 and python_version.minor >= 8:
    print("   [OK] Python version is compatible (3.8+)")
else:
    print(f"   [ERROR] Python version {python_version.major}.{python_version.minor} may not be compatible")
print()

# Test 2: Import torch
print("2. Testing PyTorch import...")
try:
    import torch
    print(f"   [OK] PyTorch imported successfully")
    print(f"   PyTorch version: {torch.__version__}")
    print(f"   CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"   CUDA version: {torch.version.cuda}")
        print(f"   GPU device: {torch.cuda.get_device_name(0)}")
    else:
        print(f"   Using CPU (no GPU detected)")
except ImportError as e:
    print(f"   [ERROR] Failed to import PyTorch: {e}")
    print("   Install with: pip install torch torchaudio torchvision")
    sys.exit(1)
except Exception as e:
    print(f"   [ERROR] Error importing PyTorch: {e}")
    sys.exit(1)
print()

# Test 3: Import torchaudio
print("3. Testing torchaudio import...")
try:
    import torchaudio
    print(f"   [OK] torchaudio imported successfully")
    print(f"   torchaudio version: {torchaudio.__version__}")
except ImportError as e:
    print(f"   [ERROR] Failed to import torchaudio: {e}")
    print("   Install with: pip install torchaudio")
    sys.exit(1)
except Exception as e:
    print(f"   [ERROR] Error importing torchaudio: {e}")
    sys.exit(1)
print()

# Test 4: Import faster-whisper
print("4. Testing faster-whisper import...")
try:
    import faster_whisper
    print(f"   [OK] faster-whisper imported successfully")
    print(f"   faster-whisper version: {faster_whisper.__version__}")
except ImportError as e:
    print(f"   [ERROR] Failed to import faster-whisper: {e}")
    print("   Install with: pip install faster-whisper")
    sys.exit(1)
except Exception as e:
    print(f"   [ERROR] Error importing faster-whisper: {e}")
    sys.exit(1)
print()

# Test 5: Import whisperx
print("5. Testing WhisperX import...")
try:
    import whisperx
    print(f"   [OK] WhisperX imported successfully")
    try:
        print(f"   WhisperX version: {whisperx.__version__}")
    except:
        print(f"   WhisperX version: (unknown)")
except ImportError as e:
    print(f"   [ERROR] Failed to import WhisperX: {e}")
    print("   Install with: pip install whisperx")
    sys.exit(1)
except Exception as e:
    print(f"   [ERROR] Error importing WhisperX: {e}")
    sys.exit(1)
print()

# Test 6: Check for omegaconf (needed for PyTorch 2.6+)
print("6. Testing omegaconf import (for PyTorch 2.6+ compatibility)...")
try:
    from omegaconf.listconfig import ListConfig
    print(f"   [OK] omegaconf imported successfully")
except ImportError as e:
    print(f"   [WARNING] omegaconf not found: {e}")
    print("   This may cause issues with PyTorch 2.6+. Install with: pip install omegaconf")
except Exception as e:
    print(f"   [WARNING] Error importing omegaconf: {e}")
print()

# Test 7: Test PyTorch safe globals (PyTorch 2.6+)
print("7. Testing PyTorch 2.6+ safe globals configuration...")
try:
    import collections
    torch_version = torch.__version__.split('.')
    major, minor = int(torch_version[0]), int(torch_version[1])
    
    if major > 2 or (major == 2 and minor >= 6):
        print(f"   PyTorch {torch.__version__} detected (2.6+)")
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
            print(f"   [OK] Safe globals configured successfully")
        except ImportError as e:
            print(f"   [WARNING] Could not import omegaconf classes: {e}")
        except Exception as e:
            print(f"   [WARNING] Could not configure safe globals: {e}")
            print("   This may cause model loading issues")
    else:
        print(f"   PyTorch {torch.__version__} - safe globals not needed")
except Exception as e:
    print(f"   [WARNING] Error testing safe globals: {e}")
print()

# Test 7.5: Configure monkey-patch for torch.load
print("7.5. Configuring torch.load monkey-patch (PyTorch 2.6+ fallback)...")
try:
    torch_version = torch.__version__.split('.')
    major, minor = int(torch_version[0]), int(torch_version[1])
    
    if major > 2 or (major == 2 and minor >= 6):
        _original_torch_load = torch.load
        def _patched_torch_load(*args, **kwargs):
            """Patched torch.load that sets weights_only=False for trusted model sources."""
            # Always override weights_only to False for compatibility with PyTorch 2.6+
            kwargs['weights_only'] = False
            return _original_torch_load(*args, **kwargs)
        torch.load = _patched_torch_load
        print(f"   [OK] torch.load monkey-patch configured")
    else:
        print(f"   PyTorch {torch.__version__} - monkey-patch not needed")
except Exception as e:
    print(f"   [WARNING] Could not configure monkey-patch: {e}")
print()

# Test 8: Test loading a small WhisperX model
print("8. Testing WhisperX model loading (this may take a minute)...")
try:
    # Environment variable is already set at the top of the script
    print("   [OK] Environment variable WHISPERX_DISABLE_PYANNOTE is set")
    
    # Try to load the smallest model
    print("   Attempting to load 'tiny' model...")
    device = "cpu"
    compute_type = "int8"
    
    model = whisperx.load_model("tiny", device=device, compute_type=compute_type)
    print(f"   [OK] Model loaded successfully!")
    print(f"   Model device: {device}")
    print(f"   Compute type: {compute_type}")
    
    # Check VAD model
    if hasattr(model, 'vad_model'):
        vad_type = type(model.vad_model).__name__
        if isinstance(model.vad_model, str):
            print(f"   [WARNING] VAD model is a string: '{model.vad_model}' (this may cause issues)")
        else:
            print(f"   [OK] VAD model type: {vad_type}")
    else:
        print(f"   [INFO] No VAD model attribute found")
    
    del model  # Clean up
    print("   [OK] Model test completed successfully")
    
except Exception as e:
    print(f"   [ERROR] Failed to load model: {e}")
    import traceback
    print("   Error details:")
    traceback.print_exc()
    sys.exit(1)
print()

# Test 9: Check ffmpeg
print("9. Testing ffmpeg availability...")
import subprocess
try:
    # Check if ffmpeg is in the current directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    ffmpeg_path = os.path.join(current_dir, "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
    
    if os.path.exists(ffmpeg_path):
        print(f"   [OK] ffmpeg found in script directory: {ffmpeg_path}")
    else:
        # Try system ffmpeg
        result = subprocess.run(["ffmpeg", "-version"], 
                              capture_output=True, 
                              text=True, 
                              timeout=5)
        if result.returncode == 0:
            print(f"   [OK] ffmpeg found in system PATH")
            version_line = result.stdout.split('\n')[0]
            print(f"   {version_line}")
        else:
            print(f"   [WARNING] ffmpeg not found in system PATH")
            print(f"   Make sure ffmpeg.exe is in the same directory as the script")
except Exception as e:
    print(f"   [WARNING] Could not verify ffmpeg: {e}")
print()

# Summary
print("=" * 60)
print("Installation Test Summary")
print("=" * 60)
print("[OK] All core dependencies are installed and working!")
print()
print("If all tests passed, WhisperX should work correctly.")
print("If you see any [ERROR] or [WARNING] messages, address those issues first.")
print()
print("Next steps:")
print("1. Try running: python transcribe-whisper.py <audio_file>")
print("2. If you get errors, check the error messages above")
print("=" * 60)

