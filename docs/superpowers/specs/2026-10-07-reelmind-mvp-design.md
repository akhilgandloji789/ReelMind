# ReelMind MVP - Technical Design Specification

**Date:** 2026-10-07  
**Project:** ReelMind  
**Goal:** Build the first MVP of ReelMind as a web application whose only job is to accurately transcribe short-form videos/Reels.

---

## 1. System Overview & Scope

ReelMind is a dedicated transcription validation system for short-form video (Instagram Reels, YouTube Shorts, TikTok, uploaded MP4/MOV/WebM). It accurately detects languages, handles multilingual speech and code-switching (e.g., Indian languages mixed with English), preserves technical terms without distortion or hallucination, provides timestamped interactive transcripts, and provides a developer evaluation suite for Word Error Rate (WER) and Character Error Rate (CER).

**Non-Goals for MVP:**
- Categorization, recommendation systems, knowledge graphs, RAG agents, or model training.

---

## 2. Architecture & Data Flow

### 2.1 Backend (Python + FastAPI)
```text
backend/
├── main.py                          # FastAPI application & CORS setup
├── config.py                        # Environment variables & constants
├── routes/
│   ├── upload.py                    # File upload & URL submission routes
│   ├── transcription.py             # Status polling & transcript retrieval
│   └── evaluation.py                # Ground truth comparison & WER/CER
├── services/
│   ├── video_processor.py           # yt-dlp URL download & video validation
│   ├── audio_processor.py           # FFmpeg audio extraction & loudnorm
│   ├── transcription_service.py     # Groq Whisper Large v3 STT
│   ├── language_detector.py         # Code-switching & script detection
│   └── transcript_processor.py      # Gemini Flash technical cleanup (no rewriting)
├── models/
│   └── transcript.py                # Pydantic schemas for jobs & transcripts
└── storage/
    ├── uploads/                     # Temporary uploaded/downloaded videos
    ├── audio/                       # Extracted preprocessed audio files
    └── transcripts/                 # JSON persisted transcript objects
```

### 2.2 Frontend (Next.js 14+ / React + TypeScript + Tailwind CSS)
```text
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout with dark mode aesthetic
│   │   ├── page.tsx                 # Landing & upload / transcript results view
│   │   └── eval/
│   │       └── page.tsx             # Developer evaluation suite (Ground Truth vs ReelMind)
│   ├── components/
│   │   ├── VideoUploader.tsx        # Drag-and-drop & URL input tab
│   │   ├── ProcessingTracker.tsx    # Live stage progress indicator
│   │   ├── VideoPlayer.tsx          # HTML5 video player with synchronized seek
│   │   ├── TranscriptView.tsx       # Timestamped segments, language tags, search
│   │   ├── TranscriptToolbar.tsx    # Copy, Download (TXT, JSON, SRT), Raw/Corrected toggle
│   │   └── AccuracyEvaluator.tsx    # WER/CER metric calculator and diff view
│   └── lib/
│       ├── api.ts                   # Backend API client
│       └── utils.ts                 # Time formatting & export helpers
```

---

## 3. Core Processing Pipeline

1. **Ingestion & Validation:**
   - Supports MP4, MOV, WebM (max size 100MB, duration limit 5 mins).
   - Video URL ingestion via modular `yt-dlp` service. If a URL is restricted or private, returns: *"This Reel could not be retrieved directly due to platform restrictions. Please download and upload the video file instead."*
2. **Audio Preprocessing (`FFmpeg`):**
   - Command: `ffmpeg -i input.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 -af loudnorm output.wav`
   - Normalizes audio volume (handling loud background music or quiet speech), downmixes to 16kHz mono WAV for Whisper.
3. **Speech Recognition (`Groq Whisper Large v3`):**
   - Transcribes audio using `whisper-large-v3` with `verbose_json` response containing segment-level and word-level timestamps.
   - Detects primary spoken language.
4. **Mixed-Language & Code-Switching Detection:**
   - Detects script changes within segments (e.g. Telugu `\u0C00-\u0C7F`, Devanagari `\u0900-\u097F`, Latin).
   - Assigns language tags per segment (`en`, `te`, `hi`, `mixed`).
5. **Quality Preservation Pipeline (`Gemini Flash`):**
   - Corrects obvious phonetic mis-recognitions of technical terms (e.g. Docker, Kubernetes, React, Spring Boot, API, SQL) strictly without rewriting or summarizing.
   - Stores both `raw_transcript` and `corrected_transcript`.
6. **Persistence & Serving:**
   - Persists transcript JSON to `storage/transcripts/{job_id}.json`.
   - Video served via FastAPI static mount so the frontend player can seek synchronously.

---

## 4. Data Models

```python
class Segment(BaseModel):
    id: int
    start: float
    end: float
    language: str
    text: str

class TranscriptResult(BaseModel):
    id: str
    source_type: str  # "upload" | "url"
    filename: str
    video_url: Optional[str] = None
    duration: float
    languages: List[str]
    segments: List[Segment]
    raw_transcript: str
    corrected_transcript: str
    created_at: str
    status: str       # "queued" | "extracting_audio" | "normalizing_audio" | "transcribing" | "correcting" | "completed" | "failed"
    error: Optional[str] = None
```

---

## 5. Developer Evaluation Suite (`/eval`)

- Input: Video file or existing transcription ID + Ground Truth text.
- Calculates:
  - **Word Error Rate (WER)**: `(Insertions + Deletions + Substitutions) / Total Ground Truth Words`
  - **Character Error Rate (CER)**
  - Processing Latency (seconds)
  - Diff view highlighting mismatched terms (especially technical terms and regional words).

---

## 6. Error Handling Strategy

- User-friendly errors:
  - "No speech was detected in this video. The Reel may contain only music or ambient audio."
  - "The video file format is unsupported or the file is corrupted."
  - "The Reel could not be retrieved from this URL. Please upload the video directly."
- Resilience:
  - If Gemini cleanup fails (e.g. rate limit), falls back seamlessly to `raw_transcript` so transcription is never lost.
  - Automatic cleanup of temporary audio/video files.
