from fastapi import APIRouter, HTTPException
from backend.models.transcript import EvaluationRequest, EvaluationResult
from backend.services.evaluation_service import compute_evaluation_metrics
from backend.services.job_manager import get_job

router = APIRouter(prefix="/api/eval", tags=["evaluation"])

@router.post("/compare", response_model=EvaluationResult)
async def compare_transcript(request: EvaluationRequest):
    """
    Compares ground truth transcript against ReelMind hypothesis.
    Computes Word Error Rate (WER) and Character Error Rate (CER) and returns visual diff.
    """
    hypothesis = request.hypothesis or ""
    
    # If transcription_id provided, fetch hypothesis from job result
    if request.transcription_id:
        job = get_job(request.transcription_id)
        if not job:
            raise HTTPException(status_code=404, detail="Transcription ID not found for evaluation.")
        hypothesis = job.corrected_transcript or job.raw_transcript

    if not hypothesis and not request.hypothesis:
        raise HTTPException(status_code=400, detail="Hypothesis transcript is missing. Provide either hypothesis or transcription_id.")

    metrics = compute_evaluation_metrics(
        ground_truth=request.ground_truth,
        hypothesis=hypothesis
    )
    return metrics
