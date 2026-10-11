# ReelMind (MVP)

> **Turn any Reel into accurate, searchable text.**

ReelMind is a dedicated transcription and validation web application built specifically for short-form video (Instagram Reels, YouTube Shorts, TikTok, and direct video uploads). It specializes in accurate multilingual transcription, code-switching (mixed Indian languages and English), preservation of technical terminology, and interactive timestamped video playback.

---

## 🌟 Key Features

1. **Multilingual & Mixed-Language Speech Recognition:**
   - Detects spoken languages automatically (Telugu, Hindi, Tamil, English, Japanese, Spanish, etc.).
   - Preserves regional speech in its original language without forcing unwanted auto-translation.
   - Robustly handles code-switching (e.g. *"Today మనం Java లో arrays గురించి నేర్చుకుందాం."*).
2. **Technical Terminology Preservation:**
   - Preserves names and technical terms (e.g. *Docker, Kubernetes, React, Python, Spring Boot, API, SQL, GitHub, ChatGPT*) without phonetic distortions.
3. **Dual Transcript Views:**
   - **Corrected (High-Quality):** Obvious phonetic glitches on technical jargon are refined using Gemini Flash without summarizing or rewriting spoken sentences.
   - **Raw Whisper:** Full verbatim transcript directly from Whisper Large v3.
4. **Interactive Video & Synchronized Timestamps:**
   - HTML5 video player synchronized with transcript segments.
   - Click any timestamp (e.g. `00:04`) to jump through the video in real-time.
   - Real-time active segment highlighting during video playback.
5. **Copy & Export Options:**
   - One-click Copy Transcript to clipboard.
   - Download as Plain Text (`.txt`), Structured Subtitles (`.srt`), or Full JSON data (`.json`).
6. **Real Processing State Display:**
   - Genuine stage-by-stage progress reflection (*Extracting audio* → *Normalizing audio* → *Transcribing speech* → *Detecting language & code-switching* → *Finalizing transcript*).
7. **Developer Accuracy Evaluation Suite (`/eval`):**
   - Compare manually entered Ground Truth against ReelMind transcripts.
   - Calculates Word Error Rate (WER), Character Error Rate (CER), substitutions, deletions, and insertions.
   - Visual token alignment diff highlighting errors.

---

## 🏗️ Architecture

```text
               Video / Reel (Upload or URL)
                            ↓
                    FFmpeg Pipeline
           (16kHz mono WAV + EBU R128 loudnorm)
                            ↓
               Groq Whisper Large v3 STT
            (Multilingual + Segment Timestamps)
                            ↓
               Language & Script Detection
                 (Code-Switching Tagging)
                            ↓
            Gemini Flash Quality Refinement
          (Strict rule: No rewriting/summarizing)
                            ↓
        Interactive Frontend & Synchronized Player
```

---

## ⚙️ Environment Variables

A `.env` file is located in the root and in `backend/`:

```env
# Speech-to-Text via Groq Whisper Large v3 (Free from https://console.groq.com)
GROQ_API_KEY=gsk_...

# Quality Correction via Google Gemini Flash (Free from https://aistudio.google.com/apikey)
GEMINI_API_KEY=AQ....

# Application Configuration
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
FRONTEND_PORT=3000
MAX_UPLOAD_SIZE_MB=100
MAX_DURATION_SECONDS=300
```

---

## 🚀 How to Run

### 1. Prerequisites
- Python 3.10+ (tested with Python 3.13)
- Node.js 18+ & npm
- FFmpeg (installed and accessible in PATH)

### 2. Run Backend (FastAPI)
```bash
# In the repository root:
.\backend\venv\Scripts\python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API and Swagger docs will be live at:
- **API Health:** `http://localhost:8000/api/health`
- **Swagger Docs:** `http://localhost:8000/docs`

### 3. Run Frontend (Next.js)
```bash
cd frontend
npm run dev
```
The frontend application will be live at:
- **Web App:** `http://localhost:3000`
- **Developer Accuracy Benchmark:** `http://localhost:3000/eval`

---

## 🧪 Testing

### Automated Backend & Pipeline Tests
Run the automated test suite verifying audio extraction, language detection, video validation, and accuracy metrics:
```bash
$env:PYTHONPATH="."
.\backend\venv\Scripts\pytest -v tests/test_backend.py
```

### End-to-End Pipeline Verification
Run live test with audio extraction, Groq Whisper STT, and Gemini refinement:
```bash
$env:PYTHONPATH="."
.\backend\venv\Scripts\python tests/verify_pipeline.py
```

---

## 📁 Supported Formats & Ingestion

- **Direct Uploads:** `.mp4`, `.mov`, `.webm`, `.mkv`, `.avi`, `.m4v` (up to 100MB / 5 minutes).
- **URL Ingestion:** Public Instagram Reels, YouTube Shorts, and TikTok URLs via modular `yt-dlp`. If a URL is restricted or private, the system alerts the user to upload the video file directly.

---

## 📄 License
MIT
