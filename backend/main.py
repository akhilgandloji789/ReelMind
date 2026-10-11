import os
import subprocess
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import UPLOADS_DIR, GROQ_API_KEY, GEMINI_API_KEY
from backend.routes.upload import router as upload_router
from backend.routes.transcription import router as transcription_router
from backend.routes.evaluation import router as evaluation_router
from backend.routes.inbox import router as inbox_router
from backend.routes.sunday import router as sunday_router

app = FastAPI(
    title="ReelMind API",
    description="High-Accuracy Multilingual Short-Form Video / Reel Transcription Engine",
    version="1.0.0"
)

# CORS configuration to allow local frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount video upload storage for HTML5 video player streaming
app.mount("/storage/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Include API routers
app.include_router(upload_router)
app.include_router(transcription_router)
app.include_router(evaluation_router)
app.include_router(inbox_router)
app.include_router(sunday_router)

@app.get("/api/health")
def health_check():
    # Check ffmpeg availability
    ffmpeg_ok = False
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        ffmpeg_ok = True
    except Exception:
        pass

    return {
        "status": "healthy",
        "service": "ReelMind Backend",
        "ffmpeg_available": ffmpeg_ok,
        "groq_configured": bool(GROQ_API_KEY),
        "gemini_configured": bool(GEMINI_API_KEY)
    }

if __name__ == "__main__":
    import uvicorn
    from backend.config import BACKEND_HOST, BACKEND_PORT
    uvicorn.run("backend.main:app", host=BACKEND_HOST, port=BACKEND_PORT, reload=True)
