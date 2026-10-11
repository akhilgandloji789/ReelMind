import uuid
import threading
from pathlib import Path
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from backend.config import UPLOADS_DIR
from backend.models.transcript import TranscriptResult, SourceInfo
from backend.services.job_manager import ACTIVE_JOBS, start_transcription_job, run_transcription_pipeline, save_job_to_disk
from backend.services.video_processor import download_video_from_url, VideoProcessingError, SUPPORTED_EXTENSIONS

router = APIRouter(prefix="/api", tags=["upload"])

class UrlRequest(BaseModel):
    url: str
    language: Optional[str] = None

@router.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None)
):
    """Handles direct video upload (MP4, MOV, WebM, etc.)."""
    filename = file.filename or "video.mp4"
    ext = Path(filename).suffix.lower()
    
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Supported formats: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )

    job_id = str(uuid.uuid4())
    saved_filename = f"{job_id}{ext}"
    saved_video_path = UPLOADS_DIR / saved_filename

    try:
        # Stream save file to disk in chunks
        with open(saved_video_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):  # 1MB chunk
                f.write(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded video: {str(e)}")

    # Clean language hint
    clean_lang = language.strip().lower() if language and language.strip() and language.strip().lower() != "auto" else None

    # Initialize job state
    job = TranscriptResult(
        id=job_id,
        source=SourceInfo(type="upload", filename=filename),
        video_filename=saved_filename,
        created_at=datetime.utcnow().isoformat(),
        status="queued",
        stage_message="Video uploaded. Queued for audio extraction...",
        progress_percent=5
    )
    ACTIVE_JOBS[job_id] = job
    save_job_to_disk(job)

    # Launch pipeline in background thread
    start_transcription_job(
        job_id=job_id,
        video_path=saved_video_path,
        source_type="upload",
        original_name=filename,
        language=clean_lang
    )

    return {
        "job_id": job_id,
        "status": "queued",
        "video_filename": saved_filename,
        "message": "Video uploaded successfully. Transcription started."
    }

def _process_url_job_thread(job_id: str, url: str, language: Optional[str] = None):
    """Background runner for URL ingestion then transcription."""
    job = ACTIVE_JOBS.get(job_id)
    if not job:
        return
    
    job.status = "downloading_url"
    job.stage_message = "Retrieving Reel from URL..."
    job.progress_percent = 10
    save_job_to_disk(job)
    
    video_path = UPLOADS_DIR / f"{job_id}.mp4"
    
    try:
        info = download_video_from_url(url, video_path)
        job.video_filename = f"{job_id}.mp4"
        run_transcription_pipeline(
            job_id=job_id,
            video_path=video_path,
            source_type="url",
            original_name=info.get("title", "Reel"),
            video_url=url,
            language=language
        )
    except VideoProcessingError as e:
        job.status = "failed"
        job.error = str(e)
        job.stage_message = str(e)
        save_job_to_disk(job)
    except Exception as e:
        job.status = "failed"
        job.error = f"Failed to retrieve video: {str(e)}"
        job.stage_message = job.error
        save_job_to_disk(job)

@router.post("/transcribe-url")
def transcribe_url(request: UrlRequest):
    """Handles Reel / video URL ingestion via modular yt-dlp layer."""
    url_str = str(request.url).strip()
    if not url_str.startswith("http://") and not url_str.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid URL. Please provide a valid HTTP/HTTPS URL.")

    clean_lang = request.language.strip().lower() if request.language and request.language.strip() and request.language.strip().lower() != "auto" else None

    job_id = str(uuid.uuid4())
    job = TranscriptResult(
        id=job_id,
        source=SourceInfo(type="url", url=url_str),
        created_at=datetime.utcnow().isoformat(),
        status="queued",
        stage_message="Queued for URL retrieval...",
        progress_percent=5
    )
    ACTIVE_JOBS[job_id] = job
    save_job_to_disk(job)

    # Launch background thread
    t = threading.Thread(
        target=_process_url_job_thread,
        args=(job_id, url_str, clean_lang),
        daemon=True
    )
    t.start()

    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Reel URL submitted. Retrieving media..."
    }
