import json
import pytest
from pathlib import Path
from google import genai
from google.genai import types
from backend.config import GEMINI_API_KEY

def test_gemini_audio_direct():
    if not GEMINI_API_KEY:
        pytest.skip("GEMINI_API_KEY not configured")
    wav_path = Path('storage/audio/test_1e4d.wav')
    if not wav_path.exists():
        pytest.skip("Audio file test_1e4d.wav not present")

    client = genai.Client(api_key=GEMINI_API_KEY)
    with open(wav_path, 'rb') as f:
        audio_data = f.read()

    prompt = "Transcribe and analyze this audio. Return JSON with 'segments' and 'language'."

    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=[
            types.Part.from_bytes(data=audio_data, mime_type="audio/wav"),
            prompt
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.1,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
        )
    )
    parsed = json.loads(response.text)
    assert "segments" in parsed or "language" in parsed
