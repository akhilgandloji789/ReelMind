import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from backend.services.transcription_service import (
    transcribe_audio_groq,
    MAX_UNIFIED_DURATION,
    CHUNK_DURATION,
    TranscriptionError
)

def test_chunk_duration_constant():
    assert MAX_UNIFIED_DURATION >= 60.0
    assert CHUNK_DURATION >= 30.0

def test_missing_audio_file():
    bad_path = Path("storage/audio/non_existent_file.wav")
    with pytest.raises(TranscriptionError) as exc_info:
        transcribe_audio_groq(bad_path)
    assert "missing or empty" in str(exc_info.value).lower()

def test_empty_audio_file(tmp_path):
    empty_file = tmp_path / "empty.wav"
    empty_file.write_bytes(b"")
    with pytest.raises(TranscriptionError) as exc_info:
        transcribe_audio_groq(empty_file)
    assert "missing or empty" in str(exc_info.value).lower()
