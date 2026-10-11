import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.language_detector import detect_segment_language, summarize_languages, get_language_display_name
from backend.services.evaluation_service import compute_evaluation_metrics
from backend.services.video_processor import validate_video_file, VideoProcessingError

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["ffmpeg_available"] is True
    assert data["groq_configured"] is True
    assert data["gemini_configured"] is True

def test_language_detector_pure_english():
    text = "Today I am going to explain React hooks and state management."
    lang = detect_segment_language(text)
    assert lang == "en"

def test_language_detector_pure_hindi():
    text = "आज हम जावा और रिएक्ट के बारे में सीखेंगे।"
    lang = detect_segment_language(text)
    assert lang in ("hi", "mixed")

def test_language_detector_code_switching_telugu():
    text = "Today మనం Java లో arrays గురించి నేర్చుకుందాం."
    lang = detect_segment_language(text)
    assert lang in ("te", "mixed")
    
    summary = summarize_languages([lang], primary_lang="te")
    assert "Telugu" in summary

def test_evaluation_metrics_identical():
    ground_truth = "Today we will learn about React components and Docker containers"
    hypothesis = "Today we will learn about React components and Docker containers"
    metrics = compute_evaluation_metrics(ground_truth, hypothesis)
    assert metrics.wer == 0.0
    assert metrics.cer == 0.0
    assert metrics.substitutions == 0
    assert metrics.deletions == 0
    assert metrics.insertions == 0

def test_evaluation_metrics_mismatch():
    ground_truth = "Today we deploy Docker on Kubernetes"
    hypothesis = "Today we deploy docker on cubernetis"
    metrics = compute_evaluation_metrics(ground_truth, hypothesis)
    assert metrics.wer > 0.0
    assert "cubernetis" in metrics.diff_html

def test_video_validator_unsupported_extension(tmp_path):
    bad_file = tmp_path / "sample.txt"
    bad_file.write_text("not a video")
    with pytest.raises(VideoProcessingError) as exc_info:
        validate_video_file(bad_file)
    assert "Unsupported video format" in str(exc_info.value)

def test_ask_question_job_not_found():
    response = client.post("/api/transcription/non-existent-id/ask", json={"question": "What is this reel about?"})
    assert response.status_code == 404

def test_segment_translation_field():
    from backend.models.transcript import Segment
    seg = Segment(id=1, start=0.0, end=3.0, language="te", text="ఇది ఒక పరీక్ష", translation="This is a test")
    assert seg.translation == "This is a test"
    assert seg.text == "ఇది ఒక పరీక్ష"
