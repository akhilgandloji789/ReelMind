import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from backend.services.transcription_service import (
    analyze_audio_gemini,
    transcribe_and_analyze_audio,
    transcribe_audio_groq,
    _split_words_into_segments,
    TranscriptionError
)
from backend.models.transcript import Segment

def test_missing_audio_raises_error():
    bad_path = Path("storage/audio/non_existent_audio_file_123.wav")
    with pytest.raises(TranscriptionError) as exc_info:
        analyze_audio_gemini(bad_path)
    assert "missing or empty" in str(exc_info.value).lower()

def test_empty_audio_raises_error(tmp_path):
    empty_file = tmp_path / "empty_test.wav"
    empty_file.write_bytes(b"")
    with pytest.raises(TranscriptionError) as exc_info:
        analyze_audio_gemini(empty_file)
    assert "missing or empty" in str(exc_info.value).lower()

def test_anti_collapse_word_splitting():
    words = [
        {"word": "టేక్", "start": 0.0, "end": 0.5},
        {"word": "రిస్క్", "start": 0.5, "end": 1.2},
        {"word": "తీసుకోండి.", "start": 1.2, "end": 2.5},
        {"word": "ఫెయిల్", "start": 2.8, "end": 3.4},
        {"word": "అయితే", "start": 3.4, "end": 4.1},
        {"word": "సెలబ్రేట్", "start": 4.1, "end": 4.8},
        {"word": "చేసుకోండి.", "start": 4.8, "end": 5.9},
        {"word": "భయపడేది", "start": 6.0, "end": 6.8},
        {"word": "ఏమీ", "start": 6.8, "end": 7.4},
        {"word": "లేదు.", "start": 7.4, "end": 8.5},
    ]
    segments = _split_words_into_segments(words, default_lang="te")
    assert len(segments) >= 2, f"Expected multiple split segments, got {len(segments)}"
    for seg in segments:
        assert seg.end > seg.start
        assert len(seg.text) > 0
        assert seg.id >= 1

def test_real_audio_gemini_analysis():
    wav_path = Path("storage/audio/test_1e4d.wav")
    if not wav_path.exists():
        pytest.skip("Audio file test_1e4d.wav not present")

    result = analyze_audio_gemini(wav_path)

    # 1. Must produce multiple fine-grained segments (NOT collapsed into 1 giant segment)
    assert len(result["segments"]) > 1, f"Expected fine-grained segments, got {len(result['segments'])}"
    assert result["duration"] > 10.0
    
    # 2. Must produce Telugu script
    assert "Telugu" in result["languages"] or result["language"].lower() in ("te", "telugu")
    
    # 3. Check segment properties
    for idx, seg in enumerate(result["segments"]):
        assert seg.id == idx + 1
        assert seg.end > seg.start
        assert len(seg.text.strip()) > 0
        assert seg.translation is not None and len(seg.translation.strip()) > 0
        
    # 4. Check broadsheet editorial outputs
    assert result.get("headline") is not None
    assert len(result.get("summary_bullets", [])) > 0
    assert len(result["raw_transcript"]) > 0
    assert len(result["english_transcript"]) > 0

def test_transcribe_and_analyze_audio_routing():
    wav_path = Path("storage/audio/test_1e4d.wav")
    if not wav_path.exists():
        pytest.skip("Audio file test_1e4d.wav not present")

    # When Gemini is enabled, transcribe_and_analyze_audio uses Gemini
    result = transcribe_and_analyze_audio(wav_path)
    assert result["provider"] == "gemini"
    assert len(result["segments"]) > 1

def test_large_audio_triggers_files_api(tmp_path):
    import json
    big_file = tmp_path / "big_audio.wav"
    with open(big_file, "wb") as f:
        f.seek(19 * 1024 * 1024)
        f.write(b"\0")
    
    with patch("backend.services.transcription_service.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_file_ref = MagicMock()
        mock_file_ref.name = "files/test_123"
        mock_client.files.upload.return_value = mock_file_ref
        
        mock_res = MagicMock()
        mock_res.text = json.dumps({
            "language": "Hindi",
            "headline": "TEST HEADLINE",
            "summary_bullets": ["Bullet 1"],
            "segments": [{"id": 1, "start": 0.0, "end": 2.5, "language": "hi", "text": "परीक्षण", "translation": "test"}]
        })
        mock_client.models.generate_content.return_value = mock_res
        
        result = analyze_audio_gemini(big_file)
        assert mock_client.files.upload.called
        assert mock_client.files.delete.called
        assert result["language"] == "Hindi"

def test_summarize_languages_deduplication():
    from backend.services.language_detector import summarize_languages
    langs = summarize_languages(["hi", "hindi", "te", "Telugu"], primary_lang="Hindi")
    assert langs == ["Hindi", "Telugu"]

