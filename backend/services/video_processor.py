import os
import re
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional

SUPPORTED_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"}

class VideoProcessingError(Exception):
    pass

def validate_video_file(file_path: Path, max_size_mb: int = 100) -> None:
    if not file_path.exists():
        raise VideoProcessingError("Video file does not exist.")
    
    ext = file_path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise VideoProcessingError(
            f"Unsupported video format: '{ext}'. Supported formats: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )
    
    size_mb = file_path.stat().st_size / (1024 * 1024)
    if size_mb > max_size_mb:
        raise VideoProcessingError(
            f"Video file size ({size_mb:.1f} MB) exceeds maximum allowed limit of {max_size_mb} MB."
        )

def get_video_info(video_path: Path) -> Dict[str, Any]:
    """Uses ffmpeg -i to extract duration and verify audio stream presence."""
    cmd = ["ffmpeg", "-nostdin", "-i", str(video_path)]
    result = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True)
    output = (result.stderr or "") + "\n" + (result.stdout or "")
    
    has_audio = "Audio:" in output
    if not has_audio:
        raise VideoProcessingError(
            "No audio track was detected in this video. The Reel may contain only silent video."
        )
    
    duration = 0.0
    dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", output)
    if dur_match:
        hours = float(dur_match.group(1))
        minutes = float(dur_match.group(2))
        seconds = float(dur_match.group(3))
        duration = hours * 3600 + minutes * 60 + seconds
    
    return {
        "duration": duration,
        "has_audio": has_audio,
        "size_bytes": video_path.stat().st_size
    }

def download_video_from_url(url: str, output_path: Path) -> Dict[str, Any]:
    """Downloads public video/Reel using yt-dlp with progressive MP4 preference and browser headers."""
    import yt_dlp
    
    ydl_opts = {
        'format': 'best[ext=mp4]/bestvideo+bestaudio/best',
        'outtmpl': str(output_path.with_suffix('')) + '.%(ext)s',
        'quiet': True,
        'no_warnings': True,
        'merge_output_format': 'mp4',
        'noplaylist': True,
        'retries': 5,
        'fragment_retries': 5,
        'socket_timeout': 30,
        'max_filesize': 100 * 1024 * 1024,  # 100MB limit
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-us,en;q=0.5',
        }
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            downloaded_filename = ydl.prepare_filename(info)
            final_path = Path(downloaded_filename)
            if not final_path.exists():
                mp4_path = final_path.with_suffix('.mp4')
                if mp4_path.exists():
                    final_path = mp4_path
            
            if final_path != output_path and final_path.exists():
                if output_path.exists():
                    output_path.unlink()
                final_path.rename(output_path)
            
            return {
                "title": info.get("title", "Reel"),
                "duration": float(info.get("duration") or 0.0),
                "path": output_path
            }
    except Exception as e:
        # Cleanup any leftover .part files
        try:
            for p in output_path.parent.glob(f"{output_path.stem}*.part"):
                p.unlink(missing_ok=True)
        except Exception:
            pass

        err_msg = str(e).lower()
        if "login" in err_msg or "cookie" in err_msg or "private" in err_msg or "bot" in err_msg:
            raise VideoProcessingError(
                "This Reel could not be retrieved directly due to platform privacy restrictions. Please upload the video file directly."
            )
        raise VideoProcessingError(
            f"Failed to retrieve video from the provided URL. Please verify the URL or upload the video file directly."
        )
