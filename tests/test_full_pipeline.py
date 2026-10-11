import pytest
from pathlib import Path
from backend.services.audio_processor import extract_audio, cleanup_file
from backend.services.transcription_service import transcribe_audio_groq
from backend.services.transcript_processor import refine_transcript_with_gemini

def test_full_transcription_pipeline_on_real_video():
    video_path = Path("storage/uploads/188d99b0-d268-43bf-92bc-a24de653df1d.mp4")
    if not video_path.exists():
        pytest.skip("Video file 188d99b0 not present")
        
    temp_wav = Path("storage/audio/test_e2e_verify.wav")
    try:
        audio_info = extract_audio(video_path, temp_wav)
        assert temp_wav.exists()
        assert audio_info["duration_approx"] > 10.0
        
        result = transcribe_audio_groq(temp_wav)
        assert len(result["segments"]) > 0
        assert result["duration"] > 10.0
        assert len(result["raw_transcript"]) > 0
        
        # Verify first segment starts near 0
        first_seg = result["segments"][0]
        assert first_seg.start <= 2.0
        
        # Verify last segment reaches near end of audio
        last_seg = result["segments"][-1]
        assert last_seg.end >= result["duration"] - 3.0
        
        # Verify Gemini refinement
        refined_text, refined_segs = refine_transcript_with_gemini(
            result["raw_transcript"],
            result["segments"]
        )
        assert len(refined_segs) == len(result["segments"])
        assert len(refined_text) > 0
    finally:
        cleanup_file(temp_wav)
