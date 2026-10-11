import os
import subprocess
from pathlib import Path
from typing import Dict, Any

class AudioProcessingError(Exception):
    pass

def extract_audio(video_path: Path, output_wav_path: Path) -> Dict[str, Any]:
    """
    Extracts and preprocesses audio from a video file using FFmpeg:
    - 16kHz sample rate (optimal for Whisper STT)
    - 1 channel (mono)
    - 16-bit PCM format
    - loudnorm audio filter to normalize speech against background music and varying volume levels
    - -nostdin to prevent Windows console blocking
    """
    if not video_path.exists():
        raise AudioProcessingError("Input video file does not exist.")
    
    output_wav_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Primary command with loudnorm filter
    cmd = [
        "ffmpeg",
        "-nostdin",
        "-y",
        "-i", str(video_path),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
        str(output_wav_path)
    ]
    
    try:
        subprocess.run(
            cmd,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            check=True
        )
    except subprocess.CalledProcessError:
        # Fallback without loudnorm in case of short or unusual audio streams
        fallback_cmd = [
            "ffmpeg",
            "-nostdin",
            "-y",
            "-i", str(video_path),
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            str(output_wav_path)
        ]
        try:
            subprocess.run(
                fallback_cmd,
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                check=True
            )
        except subprocess.CalledProcessError as err:
            raise AudioProcessingError(f"FFmpeg failed to extract audio: {err.stderr or str(err)}")
    
    if not output_wav_path.exists() or output_wav_path.stat().st_size == 0:
        raise AudioProcessingError("Extracted audio file is empty or missing.")
    
    size_bytes = output_wav_path.stat().st_size
    duration_approx = (size_bytes - 44) / 32000.0  # minus 44 byte WAV header
    
    return {
        "audio_path": output_wav_path,
        "size_bytes": size_bytes,
        "duration_approx": max(0.0, duration_approx)
    }

def cleanup_file(path: Path) -> None:
    """Safely removes temporary audio or video file."""
    try:
        if path and path.exists():
            path.unlink()
    except Exception:
        pass
