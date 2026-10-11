import json
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException

from backend.config import TRANSCRIPTS_DIR
from backend.models.transcript import JobStatusResponse, TranscriptResult, AskQuestionRequest, AskQuestionResponse
from backend.services.job_manager import get_job
from backend.services.transcript_processor import answer_inquiry_desk

router = APIRouter(prefix="/api", tags=["transcription"])

@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Polls real backend processing state and progress."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found.")
    
    return JobStatusResponse(
        id=job.id,
        status=job.status,
        stage_message=job.stage_message,
        progress_percent=job.progress_percent,
        error=job.error,
        result=job if job.status in ("completed", "failed") else None
    )

@router.get("/transcription/{job_id}", response_model=TranscriptResult)
async def get_transcription(job_id: str):
    """Retrieves complete transcription data for a completed job."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found.")
    return job

@router.post("/transcription/{job_id}/ask", response_model=AskQuestionResponse)
async def ask_question_about_transcription(job_id: str, request: AskQuestionRequest):
    """Answers user inquiries in any language based on the reel transcript."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Transcription job not found.")
    
    if not job.segments:
        raise HTTPException(status_code=400, detail="Transcription has no segments to query.")
    
    res = answer_inquiry_desk(
        segments=job.segments,
        question=request.question,
        headline=job.headline
    )
    return AskQuestionResponse(
        answer=res["answer"],
        citations=res.get("citations", [])
    )

@router.get("/transcriptions", response_model=List[dict])
async def list_transcriptions():
    """Lists all saved transcripts from disk."""
    items = []
    for file_path in TRANSCRIPTS_DIR.glob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                items.append({
                    "id": data.get("id"),
                    "source": data.get("source"),
                    "duration": data.get("duration"),
                    "languages": data.get("languages", []),
                    "created_at": data.get("created_at"),
                    "status": data.get("status"),
                    "headline": data.get("headline")
                })
        except Exception:
            continue
    # Sort by created_at descending
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return items
