import sys
import json
from pathlib import Path
from backend.config import GEMINI_API_KEY
from backend.models.transcript import Segment
from google import genai
from google.genai import types

sys.stdout.reconfigure(encoding='utf-8')

def test_gemini_extraction():
    client = genai.Client(api_key=GEMINI_API_KEY)
    wav_path = Path("storage/audio/test_1e4d.wav")
    assert wav_path.exists()
    
    with open(wav_path, "rb") as f:
        audio_data = f.read()

    prompt = """You are ReelMind's Chief Audio Transcriber and Multilingual Broadsheet Editor.
Analyze this entire audio recording extracted from a video reel.

TASK & ACCURACY REQUIREMENTS:
1. IDENTIFY SPOKEN LANGUAGE: Accurately identify the language(s) spoken (e.g. Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, English, or Code-Switching).
2. FINE-GRAINED SEGMENTATION: Divide the audio into natural, fine-grained phrase-level or sentence-level segments (typically 1.5 to 5.0 seconds each).
   Provide realistic start and end timestamps in seconds (float) matching the exact spoken timeline.
   CRITICAL: NEVER collapse the entire audio into one giant segment. Every spoken sentence, phrase, or clause separated by natural pauses must have its own distinct segment.
3. NATIVE SCRIPT VERBATIM ACCURACY: Transcribe each segment with 100% orthographic and grammatical accuracy in its authentic native script (e.g. Telugu script for Telugu, Devanagari for Hindi).
   - Never output phonetic gibberish or distorted characters.
   - For Telugu: ensure words like "రిస్క్ తీసుకోండి", "ఫెయిల్ అయితే సెలబ్రేట్ చేసుకోండి", "భయపడేది ఏమీ లేదు", "వదిలిపెట్టకండి" etc. are spelled properly with correct consonants, vowel signs, and spaces.
4. DUAL-TRACK UNIVERSAL TRANSLATION: For each segment, provide a fluent and faithful English translation in the 'translation' field.
5. BROADSHEET EDITORIAL: Provide an all-caps newspaper headline ('headline') and 2 to 4 bullet points ('summary_bullets').

Respond ONLY with valid JSON matching this exact schema:
{
  "language": "Telugu",
  "languages": ["Telugu"],
  "headline": "HEADLINE IN CAPITAL LETTERS",
  "summary_bullets": ["Key point 1", "Key point 2"],
  "segments": [
    {
      "id": 1,
      "start": 0.0,
      "end": 2.8,
      "language": "te",
      "text": "original native script text",
      "translation": "fluent English translation"
    }
  ]
}
"""

    models = ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.8-flash"]
    result = None
    for model_name in models:
        try:
            print(f"Trying {model_name}...")
            res = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(data=audio_data, mime_type="audio/wav"),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )
            raw_text = res.text.strip()
            data = json.loads(raw_text)
            result = data
            print(f"Successfully processed with {model_name}")
            break
        except Exception as e:
            print(f"Model {model_name} failed: {e}")

    assert result is not None
    assert "segments" in result
    assert len(result["segments"]) > 1, f"Expected fine-grained segments, got {len(result['segments'])}"
    for s in result["segments"]:
        print(f"[{s['start']}s - {s['end']}s] {s['text']} | {s['translation']}")
    print("ALL ASSERTIONS PASSED!")

if __name__ == "__main__":
    test_gemini_extraction()
