# ReelMind MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and launch the ReelMind MVP on localhost — an AI web application that accurately transcribes short-form videos/Reels with multilingual support, code-switching, technical term preservation, interactive timestamped video playback, and a developer accuracy evaluation suite.

**Architecture:** Python FastAPI backend with modular FFmpeg audio processing, Groq Whisper Large v3 STT, Gemini Flash transcript refinement, and Next.js + TypeScript + Tailwind CSS responsive frontend.

**Tech Stack:** FastAPI, FFmpeg, Groq Whisper, Google Gemini API, Next.js 14, TypeScript, Tailwind CSS, Lucide icons, jiwer.

**Spec:** `docs/superpowers/specs/2026-10-07-reelmind-mvp-design.md`

## Global Constraints
- Accurate multilingual transcription without auto-translating (Telugu remains Telugu, Hindi remains Hindi, etc.).
- Robust code-switching handling (mixed Indian languages and English).
- Preservation of technical terminology (Java, Spring Boot, React, Python, API, SQL, Docker, Kubernetes, etc.).
- Non-blocking async background job processing with real stage indicators.
- Developer accuracy evaluation page (/eval) computing WER and CER.
- Store both `raw_transcript` and `corrected_transcript`.

---

### Task 1: Backend Foundation & Configuration
- Create virtual environment / dependencies file `backend/requirements.txt`.
- Create `.env` and `.env.example` with the user's Groq and Gemini API keys.
- Create directory structure for storage (`uploads`, `audio`, `transcripts`).

### Task 2: Media Processing & Audio Pipeline
- Implement `backend/services/video_processor.py` for file validation and yt-dlp URL ingestion.
- Implement `backend/services/audio_processor.py` for FFmpeg 16kHz mono audio extraction and `loudnorm` volume normalization.
- Write unit tests for audio extraction.

### Task 3: Transcription & Code-Switching Services
- Implement `backend/services/transcription_service.py` using Groq Whisper Large v3 (`verbose_json` format).
- Implement `backend/services/language_detector.py` for multi-script and code-switching detection.
- Implement `backend/services/transcript_processor.py` for Gemini Flash technical term correction (preserving original words without summarizing).

### Task 4: Evaluation Service & FastAPI Application Endpoints
- Implement `backend/services/evaluation_service.py` to calculate WER, CER, and word diffs.
- Implement Pydantic models in `backend/models/transcript.py`.
- Implement API routes:
  - `backend/routes/upload.py`: upload video and ingest URL.
  - `backend/routes/transcription.py`: job progress and transcript retrieval.
  - `backend/routes/evaluation.py`: ground truth evaluation endpoint.
- Implement `backend/main.py` with static media serving and CORS.
- Write API integration tests.

### Task 5: Next.js Frontend Application
- Scaffold Next.js TypeScript app in `frontend/`.
- Install Tailwind CSS and Lucide React icons.
- Build Landing & Video Uploader component (drag-and-drop & URL input).
- Build Processing Tracker component with genuine backend progress stages.
- Build Interactive Transcript Player component with video seek synchronization, language badges, copy, and download (TXT, JSON, SRT).
- Build Developer Evaluation Suite (`frontend/src/app/eval/page.tsx`).

### Task 6: End-to-End Verification & Localhost Deployment
- Run backend and frontend verification tests.
- Start FastAPI backend daemon on `http://localhost:8000`.
- Start Next.js frontend daemon on `http://localhost:3000`.
- Verify the complete user journey and deliver the working localhost link.
