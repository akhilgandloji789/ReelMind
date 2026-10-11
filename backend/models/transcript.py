from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class Segment(BaseModel):
    id: int
    start: float
    end: float
    language: str = "en"
    text: str                                    # Original spoken speech (native script or verbatim)
    translation: Optional[str] = None           # Universal English translation for global reach

class SourceInfo(BaseModel):
    type: str  # "upload" or "url"
    filename: Optional[str] = None
    url: Optional[str] = None

class TranscriptResult(BaseModel):
    id: str
    source: SourceInfo
    video_filename: Optional[str] = None
    duration: float = 0.0
    languages: List[str] = Field(default_factory=list)
    segments: List[Segment] = Field(default_factory=list)
    raw_transcript: str = ""
    corrected_transcript: str = ""
    english_transcript: Optional[str] = None
    headline: Optional[str] = None
    summary_bullets: List[str] = Field(default_factory=list)
    created_at: str = ""
    status: str = "queued"
    stage_message: str = "Initializing..."
    progress_percent: int = 0
    error: Optional[str] = None

class JobStatusResponse(BaseModel):
    id: str
    status: str
    stage_message: str
    progress_percent: int
    error: Optional[str] = None
    result: Optional[TranscriptResult] = None

class AskQuestionRequest(BaseModel):
    question: str

class AskQuestionResponse(BaseModel):
    answer: str
    citations: List[Dict[str, Any]] = Field(default_factory=list)

class EvaluationRequest(BaseModel):
    ground_truth: str
    hypothesis: Optional[str] = None
    transcription_id: Optional[str] = None

class EvaluationResult(BaseModel):
    wer: float
    cer: float
    ground_truth_words: int
    hypothesis_words: int
    substitutions: int
    deletions: int
    insertions: int
    diff_html: str
    latency_seconds: Optional[float] = None
