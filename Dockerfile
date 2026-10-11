# Dockerfile for ReelMind Backend (Python + FFmpeg)
FROM python:3.11-slim

# Install system dependencies: FFmpeg for audio extraction and loudnorm
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY backend /app/backend

# Create storage directories
RUN mkdir -p /app/storage/uploads /app/storage/audio /app/storage/transcripts

# Expose port (default 8000, or provided via PORT environment variable)
ENV PORT=8000
EXPOSE 8000

# Start Uvicorn ASGI server
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
