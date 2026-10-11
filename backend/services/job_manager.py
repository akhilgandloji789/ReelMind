import os
import json
import time
import threading
import logging
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime

from backend.config import UPLOADS_DIR, AUDIO_DIR, TRANSCRIPTS_DIR
from backend.models.transcript import TranscriptResult, Segment, SourceInfo
from backend.services.video_processor import validate_video_file, get_video_info, VideoProcessingError
from backend.services.audio_processor import extract_audio, cleanup_file, AudioProcessingError
from backend.services.transcription_service import transcribe_and_analyze_audio, transcribe_audio_groq, TranscriptionError
from backend.services.transcript_processor import refine_and_translate_transcript, refine_transcript_with_gemini

logger = logging.getLogger(__name__)

# In-memory registry for live active jobs
ACTIVE_JOBS: Dict[str, TranscriptResult] = {}

def get_job(job_id: str) -> Optional[TranscriptResult]:
    # 1. If actively processing in memory, return live in-memory state so intermediate progress is never clobbered
    if job_id in ACTIVE_JOBS:
        mem_job = ACTIVE_JOBS[job_id]
        if mem_job.status not in ("completed", "failed"):
            return mem_job

    # 2. Check disk for completed, failed, or restored jobs
    transcript_file = TRANSCRIPTS_DIR / f"{job_id}.json"
    if transcript_file.exists():
        try:
            with open(transcript_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                result = TranscriptResult(**data)
                ACTIVE_JOBS[job_id] = result
                return result
        except Exception as e:
            logger.error(f"Error loading transcript file {transcript_file}: {e}")

    if job_id in ACTIVE_JOBS:
        return ACTIVE_JOBS[job_id]
    return None

def save_job_to_disk(job: TranscriptResult) -> None:
    transcript_file = TRANSCRIPTS_DIR / f"{job.id}.json"
    try:
        with open(transcript_file, "w", encoding="utf-8") as f:
            json.dump(job.model_dump(), f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Failed to save transcript {job.id} to disk: {e}")

def run_transcription_pipeline(
    job_id: str,
    video_path: Path,
    source_type: str,
    original_name: str,
    video_url: Optional[str] = None,
    language: Optional[str] = None
):
    """
    Executes the real multi-stage transcription pipeline:
    1. Video Validation
    2. FFmpeg Audio Extraction & Loudnorm
    3. Groq Whisper Large v3 STT & Language Detection
    4. Gemini Flash Technical Term Quality Refinement
    5. Finalization & Persistence
    """
    job = ACTIVE_JOBS.get(job_id)
    if not job:
        return

    audio_wav_path = AUDIO_DIR / f"{job_id}.wav"

    try:
        # Stage 1: Video Validation
        job.status = "validating"
        job.stage_message = "Validating video format and audio track..."
        job.progress_percent = 20
        save_job_to_disk(job)

        validate_video_file(video_path)
        video_info = get_video_info(video_path)
        job.duration = round(video_info.get("duration", 0.0), 2)
        save_job_to_disk(job)

        # Stage 2: Audio Extraction & Preprocessing
        job.status = "extracting_audio"
        job.stage_message = "Extracting audio and applying loudness normalization..."
        job.progress_percent = 40
        save_job_to_disk(job)

        audio_info = extract_audio(video_path, audio_wav_path)
        if not job.duration or job.duration == 0.0:
            job.duration = round(audio_info.get("duration_approx", 0.0), 2)
        save_job_to_disk(job)

        # Stage 3: Audio Analysis & Speech Recognition
        job.status = "transcribing"
        job.stage_message = "Analyzing audio acoustics & transcribing speech..."
        job.progress_percent = 65
        save_job_to_disk(job)

        stt_result = transcribe_and_analyze_audio(audio_wav_path, language=language)
        job.raw_transcript = stt_result["raw_transcript"]
        job.languages = stt_result["languages"]
        job.segments = stt_result["segments"]
        if stt_result.get("duration"):
            job.duration = round(stt_result["duration"], 2)
        save_job_to_disk(job)

        # Stage 4: Dual-Track Editorial Enrichment & Translation
        job.status = "correcting"
        job.stage_message = "Typesetting dual-track translation & executive wire..."
        job.progress_percent = 85
        save_job_to_disk(job)

        # If Gemini already performed native dual-track translation and editorial typesetting
        if stt_result.get("provider") == "gemini" and stt_result.get("headline") and stt_result.get("english_transcript"):
            job.corrected_transcript = stt_result.get("corrected_transcript") or job.raw_transcript
            job.english_transcript = stt_result.get("english_transcript")
            job.headline = stt_result.get("headline")
            job.summary_bullets = stt_result.get("summary_bullets") or []
        else:
            c_text, c_segs, eng_text, headline, bullets = refine_and_translate_transcript(
                job.raw_transcript,
                job.segments
            )
            job.corrected_transcript = c_text
            job.segments = c_segs
            job.english_transcript = eng_text
            job.headline = headline
            job.summary_bullets = bullets

        from backend.services.language_detector import summarize_languages
        job.languages = summarize_languages(
            [s.language for s in job.segments],
            primary_lang=stt_result.get("language", "en")
        )

        # Stage 5: Completion
        job.status = "completed"
        job.stage_message = "Transcription complete!"
        job.progress_percent = 100
        save_job_to_disk(job)

    except VideoProcessingError as e:
        job.status = "failed"
        job.error = str(e)
        job.stage_message = str(e)
        save_job_to_disk(job)
        logger.warning(f"VideoProcessingError for job {job_id}: {e}")
    except AudioProcessingError as e:
        job.status = "failed"
        job.error = str(e)
        job.stage_message = str(e)
        save_job_to_disk(job)
        logger.warning(f"AudioProcessingError for job {job_id}: {e}")
    except TranscriptionError as e:
        job.status = "failed"
        job.error = str(e)
        job.stage_message = str(e)
        save_job_to_disk(job)
        logger.warning(f"TranscriptionError for job {job_id}: {e}")
    except Exception as e:
        job.status = "failed"
        job.error = f"An unexpected error occurred during processing: {str(e)}"
        job.stage_message = job.error
        save_job_to_disk(job)
        logger.error(f"Unexpected error in pipeline for job {job_id}: {e}", exc_info=True)
    finally:
        # Cleanup temporary WAV file (keep video file for player playback)
        cleanup_file(audio_wav_path)
        save_job_to_disk(job)

def start_transcription_job(
    job_id: str,
    video_path: Path,
    source_type: str,
    original_name: str,
    video_url: Optional[str] = None,
    language: Optional[str] = None
):
    """Launches pipeline in dedicated background worker thread."""
    thread = threading.Thread(
        target=run_transcription_pipeline,
        args=(job_id, video_path, source_type, original_name, video_url, language),
        daemon=True
    )
    thread.start()
