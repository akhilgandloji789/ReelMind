import os
import re
import time
import subprocess
import logging
import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from groq import Groq
from google import genai
from google.genai import types
from backend.config import GROQ_API_KEY, GEMINI_API_KEY
from backend.models.transcript import Segment
from backend.services.language_detector import detect_segment_language, summarize_languages

try:
    from json_repair import repair_json
except ImportError:
    def repair_json(text, return_objects=True):
        return json.loads(text)

logger = logging.getLogger(__name__)


class TranscriptionError(Exception):
    pass


# ─── Constants ────────────────────────────────────────────────────────────────
MAX_UNIFIED_DURATION = 300.0   # ≤ 5 min → single unified pass
CHUNK_DURATION       = 60.0    # Longform window size (> 5 min)
CHUNK_OVERLAP        = 2.0     # Longform overlap in seconds

# Flagship Whisper Large v3 (1.55B params) — the most accurate model for both spoken speech and emotional/singing vocals
WHISPER_MODEL = "whisper-large-v3"

# Google Gemini Multimodal Audio models (highest quality native regional speech understanding)
GEMINI_AUDIO_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3-flash-preview",
]

# Minimum gap (seconds) to trigger gap-recovery re-transcription
HEAD_GAP_THRESHOLD     = 2.5
INTERNAL_GAP_THRESHOLD = 2.0
TAIL_GAP_THRESHOLD     = 2.5

# Language-specific decoder prompts to bias Whisper toward correct script
LANGUAGE_PROMPTS: Dict[str, str] = {
    "te": "ఈ వీడియోలో తెలుగు మాట్లాడతారు లేదా పాట పాడతారు.",            # Telugu
    "hi": "इस वीडियो में हिंदी बोली या गाई जाती है।",                 # Hindi
    "ta": "இந்த வீடியோவில் தமிழ் பேசப்படுகிறது.",                     # Tamil
    "kn": "ಈ ವೀಡಿಯೊದಲ್ಲಿ ಕನ್ನಡ ಮಾತನಾಡುತ್ತಾರೆ.",                     # Kannada
    "ml": "ഈ വീഡിയോയിൽ മലയാളം സംസാരിക്കുന്നു.",                     # Malayalam
    "mr": "या व्हिडिओमध्ये मराठी बोलली जाते.",                          # Marathi
    "bn": "এই ভিডিওতে বাংলা বলা হয়।",                                 # Bengali
    "gu": "આ વીડિયોમાં ગુજરાતી બોલવામાં આવે છે.",                     # Gujarati
    "pa": "ਇਸ ਵੀਡੀਓ ਵਿੱਚ ਪੰਜਾਬੀ ਬੋਲੀ ਜਾਂਦੀ ਹੈ।",                    # Punjabi
    "ur": "اس ویڈیو میں اردو بولی جاتی ہے۔",                           # Urdu
    "en": "This video contains clear spoken words or songs.",
}

# Regex to detect unwanted filler/dot tokens
DOT_OR_MUSIC_REGEX = re.compile(r"^(\s*[\.·…_—\-\*\s]+|\s*\[?(music|singing|applause|laughter|silence)\]?\s*|\s*[♪♫#\?]+\s*)$", re.IGNORECASE)


# ─── Core Groq API Call ───────────────────────────────────────────────────────
def _call_groq_whisper(
    client: Groq,
    audio_path: Path,
    language: Optional[str] = None,
    prompt: Optional[str] = None,
    temperature: float = 0.0,
    word_timestamps: bool = True,
    max_retries: int = 2,
) -> Any:
    """
    Invokes Groq Whisper Large v3 with verbose_json.
    Word timestamps allow fine-grained segment alignment.
    """
    req_kwargs: Dict[str, Any] = {
        "model": WHISPER_MODEL,
        "response_format": "verbose_json",
        "temperature": temperature,
    }

    if word_timestamps:
        req_kwargs["timestamp_granularities"] = ["word", "segment"]

    if prompt:
        req_kwargs["prompt"] = prompt

    if language and language.lower() not in ("auto", "none", ""):
        req_kwargs["language"] = language.lower()

    last_err: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            with open(audio_path, "rb") as f:
                res = client.audio.transcriptions.create(
                    file=(audio_path.name, f),
                    **req_kwargs
                )
            return res
        except Exception as e:
            last_err = e
            err_str = str(e).lower()
            if "401" in err_str or "invalid api key" in err_str:
                raise TranscriptionError("Invalid Groq API key. Please check your GROQ_API_KEY.")
            if "413" in err_str or "too large" in err_str:
                raise TranscriptionError(f"Audio file too large for Groq API: {audio_path.name}")
            if attempt < max_retries:
                time.sleep(1.0)

    raise TranscriptionError(f"Groq Whisper transcription failed: {str(last_err)}")


# ─── Segment Extraction & Sanitization ─────────────────────────────────────────
def _is_valid_speech_text(text: str) -> bool:
    """Checks if text contains real speech instead of dots, music tokens, or empty strings."""
    if not text:
        return False
    stripped = text.strip()
    if len(stripped) < 2:
        return False
    if DOT_OR_MUSIC_REGEX.match(stripped):
        return False
    # Check if string is only punctuation
    if not any(c.isalnum() for c in stripped):
        return False
    return True


def _split_words_into_segments(
    words: List[Any],
    time_offset: float = 0.0,
    default_lang: str = "en",
) -> List[Segment]:
    """
    Groups fine-grained word timestamps into natural phrase/sentence chunks
    (approx 2.5-4.5s each or at punctuation boundaries) to prevent single-segment collapse.
    """
    if not words:
        return []

    segments: List[Segment] = []
    current_words: List[Tuple[str, float, float]] = []
    seg_start: Optional[float] = None

    for w in words:
        if hasattr(w, "get"):
            w_text = (w.get("word") or "").strip()
            w_start = float(w.get("start", 0.0))
            w_end = float(w.get("end", 0.0))
        else:
            w_text = (getattr(w, "word", "") or "").strip()
            w_start = float(getattr(w, "start", 0.0))
            w_end = float(getattr(w, "end", 0.0))

        if not w_text:
            continue

        if seg_start is None:
            seg_start = w_start

        current_words.append((w_text, w_start, w_end))
        curr_dur = w_end - seg_start
        has_boundary = any(w_text.endswith(p) for p in [".", "?", "!", ",", "।", ";"])

        # Split after 3.5s or at punctuation with at least 1.8s duration
        if curr_dur >= 3.5 or (curr_dur >= 1.8 and has_boundary):
            seg_text = " ".join(t[0] for t in current_words).strip()
            seg_end = current_words[-1][2]
            if seg_end <= seg_start:
                seg_end = round(seg_start + 1.0, 2)
            seg_lang = detect_segment_language(seg_text, default_lang=default_lang)
            segments.append(Segment(
                id=len(segments) + 1,
                start=round(time_offset + seg_start, 2),
                end=round(time_offset + seg_end, 2),
                language=seg_lang,
                text=seg_text,
            ))
            current_words = []
            seg_start = None

    if current_words and seg_start is not None:
        seg_text = " ".join(t[0] for t in current_words).strip()
        seg_end = current_words[-1][2]
        if seg_end <= seg_start:
            seg_end = round(seg_start + 1.0, 2)
        seg_lang = detect_segment_language(seg_text, default_lang=default_lang)
        segments.append(Segment(
            id=len(segments) + 1,
            start=round(time_offset + seg_start, 2),
            end=round(time_offset + seg_end, 2),
            language=seg_lang,
            text=seg_text,
        ))

    return segments


def _extract_segments_from_whisper(
    transcription_res: Any,
    time_offset: float = 0.0,
    max_time: Optional[float] = None,
    detected_lang_override: Optional[str] = None,
) -> Tuple[str, str, List[Segment]]:
    """
    Extracts text, language, and Segment objects from a Groq Whisper response.
    Sanitizes out dots, musical notes, and unvoiced artifact tokens.
    Prevents coarse/collapsed segmentation by leveraging word-level timestamps when available.
    """
    if hasattr(transcription_res, "text"):
        full_text    = (transcription_res.text or "").strip()
        detected_lang = str(getattr(transcription_res, "language", "en") or "en")
        raw_segs     = getattr(transcription_res, "segments", []) or []
        raw_words    = getattr(transcription_res, "words", []) or []
    else:
        full_text    = (transcription_res.get("text", "") or "").strip()
        detected_lang = str(transcription_res.get("language", "en") or "en")
        raw_segs     = transcription_res.get("segments", []) or []
        raw_words    = transcription_res.get("words", []) or []

    if detected_lang_override:
        detected_lang = detected_lang_override

    segments: List[Segment] = []

    for s in raw_segs:
        if hasattr(s, "get"):
            s_start = float(s.get("start", 0.0))
            s_end   = float(s.get("end", 0.0))
            s_text  = (s.get("text") or "").strip()
            no_speech = float(s.get("no_speech_prob", 0.0))
        else:
            s_start   = float(getattr(s, "start", 0.0))
            s_end     = float(getattr(s, "end", 0.0))
            s_text    = (getattr(s, "text", "") or "").strip()
            no_speech = float(getattr(s, "no_speech_prob", 0.0))

        if not _is_valid_speech_text(s_text):
            continue

        # Skip only when Whisper is overwhelmingly confident it was silence
        if no_speech > 0.92:
            continue

        start = round(time_offset + s_start, 2)
        end   = round(time_offset + s_end,   2)
        if max_time is not None:
            end = min(end, round(time_offset + max_time, 2))

        if end <= start:
            end = round(start + 0.5, 2)

        seg_lang = detect_segment_language(s_text, default_lang=detected_lang)
        segments.append(Segment(
            id=len(segments) + 1,
            start=start,
            end=end,
            language=seg_lang,
            text=s_text,
        ))

    # Fallback if no segments parsed but full_text has valid words
    if not segments and _is_valid_speech_text(full_text):
        seg_lang = detect_segment_language(full_text, default_lang=detected_lang)
        fallback_end = round(time_offset + max_time, 2) if max_time else round(time_offset + 5.0, 2)
        segments.append(Segment(
            id=1,
            start=round(time_offset, 2),
            end=fallback_end,
            language=seg_lang,
            text=full_text,
        ))

    # Anti-collapse guard: If segments collapsed into a single long segment (> 6.0s) and word timestamps exist, split
    if raw_words and (len(segments) <= 1 or any((s.end - s.start) > 6.0 for s in segments)):
        word_segs = _split_words_into_segments(raw_words, time_offset=time_offset, default_lang=detected_lang)
        if len(word_segs) > len(segments):
            logger.info(f"De-collapsed coarse Whisper segments: expanded {len(segments)} segment(s) into {len(word_segs)} fine-grained phrase segments.")
            segments = word_segs

    return full_text, detected_lang, segments


# ─── Gap Recovery ─────────────────────────────────────────────────────────────
def _recover_gaps(
    client: Groq,
    audio_wav_path: Path,
    segments: List[Segment],
    total_duration: float,
    language: Optional[str],
    prompt: Optional[str],
) -> List[Segment]:
    """
    Scans the timeline for missing gaps > 2.0s and performs targeted Whisper recovery.
    """
    gaps: List[Tuple[float, float]] = []

    if segments and segments[0].start > HEAD_GAP_THRESHOLD:
        gaps.append((0.0, segments[0].start))

    for i in range(len(segments) - 1):
        gap = segments[i + 1].start - segments[i].end
        if gap > INTERNAL_GAP_THRESHOLD:
            gaps.append((segments[i].end, segments[i + 1].start))

    if segments and (total_duration - segments[-1].end) > TAIL_GAP_THRESHOLD:
        gaps.append((segments[-1].end, total_duration))

    if not gaps:
        return segments

    recovered: List[Segment] = []
    for g_st, g_en in gaps:
        g_dur = g_en - g_st
        if g_dur < 1.0:
            continue

        overlap = min(1.0, g_dur * 0.15)
        s_st = max(0.0, g_st - overlap)
        s_en = min(total_duration, g_en + overlap)

        gap_wav = audio_wav_path.parent / f"{audio_wav_path.stem}_gap_{int(s_st*10)}_{int(s_en*10)}.wav"
        try:
            subprocess.run(
                [
                    "ffmpeg", "-nostdin", "-y",
                    "-ss", f"{s_st:.3f}",
                    "-t", f"{s_en - s_st:.3f}",
                    "-i", str(audio_wav_path),
                    "-c", "copy",
                    str(gap_wav),
                ],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                check=True,
            )
            if gap_wav.exists() and gap_wav.stat().st_size > 44:
                g_res = _call_groq_whisper(
                    client, gap_wav,
                    language=language,
                    prompt=prompt,
                    temperature=0.0,
                    word_timestamps=False,
                )
                _, _, g_segs = _extract_segments_from_whisper(
                    g_res,
                    time_offset=s_st,
                    max_time=s_en - s_st,
                )
                for s in g_segs:
                    if s.start >= (g_st - 0.3) and s.end <= (g_en + 0.5):
                        recovered.append(s)
        except Exception as e:
            logger.warning(f"Gap recovery [{g_st:.1f}-{g_en:.1f}] skipped: {e}")
        finally:
            gap_wav.unlink(missing_ok=True)

    if not recovered:
        return segments

    combined = sorted(segments + recovered, key=lambda s: s.start)
    deduped: List[Segment] = []
    for s in combined:
        if deduped:
            prev = deduped[-1]
            if s.start < prev.end:
                if s.text.strip().lower() == prev.text.strip().lower() or s.end <= prev.end:
                    continue
                if s.end > prev.end:
                    s.start = prev.end
        deduped.append(s)

    return deduped


# ─── Unified Transcription (≤ 5 minutes) ─────────────────────────────────────
def _transcribe_unified_stream(
    client: Groq,
    audio_wav_path: Path,
    total_duration: float,
    language: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Transcribes an entire video audio stream as ONE continuous pass using Whisper Large v3.
    Accurately captures both speech and singing vocals without artificial boundary cuts.
    Includes automatic Urdu-to-Hindi script alignment for poetic singing.
    """
    lang_prompt = None
    if language and language.lower() not in ("auto", "none", ""):
        lang_prompt = LANGUAGE_PROMPTS.get(language.lower())

    # Pass 1: Primary Whisper Large v3 call
    transcription = _call_groq_whisper(
        client, audio_wav_path,
        language=language,
        prompt=lang_prompt,
        temperature=0.0,
    )
    full_text, detected_lang, segments = _extract_segments_from_whisper(
        transcription,
        time_offset=0.0,
        max_time=total_duration,
    )

    # Retry if Pass 1 returned only dots or silence tokens (common with subtle acoustic singing)
    if not segments or not _is_valid_speech_text(full_text):
        logger.info("Pass 1 produced sparse/dot output, retrying with temperature=0.2 sampling...")
        try:
            retry_res = _call_groq_whisper(
                client, audio_wav_path,
                language=language,
                prompt="Vocals and lyrics in this audio track.",
                temperature=0.2,
                word_timestamps=False,
            )
            r_text, r_lang, r_segs = _extract_segments_from_whisper(
                retry_res,
                time_offset=0.0,
                max_time=total_duration,
            )
            if r_segs and _is_valid_speech_text(r_text):
                full_text, detected_lang, segments = r_text, r_lang, r_segs
        except Exception as e:
            logger.warning(f"Acoustic retry failed: {e}")

    # Pass 2: Urdu vs Hindi Script Normalization:
    # If spoken audio or song was detected as Urdu or Perso-Arabic script,
    # re-transcribe with language='hi' to ensure standard Hindi Devanagari representation.
    is_urdu = detected_lang.lower() in ("ur", "urdu")
    has_arabic_script = bool(re.search(r"[\u0600-\u06FF\u0750-\u077F]", full_text))
    if (not language or language.lower() in ("auto", "hi")) and (is_urdu or has_arabic_script):
        try:
            logger.info("Urdu/Perso-Arabic script detected for Indian audio; re-transcribing with language='hi'...")
            hi_trans = _call_groq_whisper(
                client, audio_wav_path,
                language="hi",
                prompt=LANGUAGE_PROMPTS["hi"],
                temperature=0.0,
            )
            hi_text, _, hi_segs = _extract_segments_from_whisper(
                hi_trans,
                time_offset=0.0,
                max_time=total_duration,
                detected_lang_override="hi",
            )
            if hi_segs and _is_valid_speech_text(hi_text):
                full_text, detected_lang, segments = hi_text, "hi", hi_segs
        except Exception as e:
            logger.warning(f"Hindi re-transcription skipped: {e}")

    # Pass 3: Full-Timeline Gap Recovery
    if segments and total_duration > 4.0:
        segments = _recover_gaps(
            client, audio_wav_path, segments, total_duration,
            language=detected_lang,
            prompt=LANGUAGE_PROMPTS.get(detected_lang.lower()),
        )

    # Renumber segments cleanly
    for idx, s in enumerate(segments):
        s.id = idx + 1

    clean_text = " ".join(s.text for s in segments).strip()
    detected_langs = [s.language for s in segments]
    distinct_languages = summarize_languages(detected_langs, primary_lang=detected_lang)

    return {
        "raw_transcript": clean_text or full_text,
        "language": detected_lang,
        "languages": distinct_languages,
        "duration": round(total_duration, 2),
        "segments": segments,
    }


# ─── Longform Windowed Transcription (> 5 minutes) ───────────────────────────
def _transcribe_longform_windowed(
    client: Groq,
    audio_wav_path: Path,
    total_duration: float,
    language: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Windowed transcription for long-form media (> 5 minutes).
    Uses 60s windows with 2s acoustic overlap.
    """
    temp_dir = audio_wav_path.parent / "chunks"
    temp_dir.mkdir(parents=True, exist_ok=True)

    all_segments: List[Segment] = []
    primary_language = language or "en"
    curr_time = 0.0
    chunk_idx = 0

    try:
        while curr_time < total_duration:
            chunk_file = temp_dir / f"{audio_wav_path.stem}_win_{chunk_idx}.wav"
            chunk_len  = min(CHUNK_DURATION, total_duration - curr_time)

            subprocess.run(
                [
                    "ffmpeg", "-nostdin", "-y",
                    "-ss", f"{curr_time:.3f}",
                    "-t", f"{chunk_len:.3f}",
                    "-i", str(audio_wav_path),
                    "-c", "copy",
                    str(chunk_file),
                ],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                check=True,
            )

            res = _call_groq_whisper(
                client, chunk_file,
                language=language,
                word_timestamps=False,
            )
            _, c_lang, c_segs = _extract_segments_from_whisper(
                res,
                time_offset=curr_time,
                max_time=chunk_len,
            )

            if chunk_idx == 0 and not language:
                primary_language = c_lang

            for seg in c_segs:
                if all_segments and seg.start < all_segments[-1].end:
                    if seg.end <= all_segments[-1].end or seg.text.strip() == all_segments[-1].text.strip():
                        continue
                seg.id = len(all_segments) + 1
                all_segments.append(seg)

            chunk_file.unlink(missing_ok=True)
            chunk_idx += 1
            curr_time += max(chunk_len - CHUNK_OVERLAP, 1.0)

    finally:
        for f in temp_dir.glob("*.wav"):
            f.unlink(missing_ok=True)
        try:
            temp_dir.rmdir()
        except Exception:
            pass

    for idx, s in enumerate(all_segments):
        s.id = idx + 1

    clean_text = " ".join(s.text for s in all_segments).strip()
    detected_langs = [s.language for s in all_segments]
    distinct_languages = summarize_languages(detected_langs, primary_lang=primary_language)

    return {
        "raw_transcript": clean_text,
        "language": primary_language,
        "languages": distinct_languages,
        "duration": round(total_duration, 2),
        "segments": all_segments,
    }


# ─── Public Entry Point ───────────────────────────────────────────────────────
def transcribe_audio_groq(
    audio_wav_path: Path,
    language: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Transcribes audio using Groq Whisper Large v3 (1.55B parameters).
    - Uses clean 16kHz audio with natural dynamics preserved.
    - Captures both speech and singing vocals accurately.
    - Automatically filters dot/music artifact tokens.
    - Re-transcribes poetic Urdu text into proper Hindi Devanagari script.
    """
    if not GROQ_API_KEY:
        raise TranscriptionError("GROQ_API_KEY is not configured in backend/.env")

    if not audio_wav_path.exists() or audio_wav_path.stat().st_size == 0:
        raise TranscriptionError("Audio file is missing or empty.")

    client = Groq(api_key=GROQ_API_KEY)

    # Duration from 16kHz 16-bit mono PCM WAV
    size_bytes = audio_wav_path.stat().st_size
    total_duration = max(0.0, (size_bytes - 44) / 32000.0)

    logger.info(
        f"Starting Whisper transcription: {audio_wav_path.name} | "
        f"duration={total_duration:.1f}s | model={WHISPER_MODEL}"
    )

    if total_duration <= MAX_UNIFIED_DURATION:
        result = _transcribe_unified_stream(client, audio_wav_path, total_duration, language=language)
    else:
        result = _transcribe_longform_windowed(client, audio_wav_path, total_duration, language=language)

    if not result["segments"] and not result["raw_transcript"]:
        raise TranscriptionError(
            "No audible speech or lyrics were recognized in this video. The audio may be instrumental or ambient."
        )

    return result


# ─── Gemini Multimodal Audio Analysis ─────────────────────────────────────────
def analyze_audio_gemini(
    audio_path: Path,
    language: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Directly ingests and analyzes the entire extracted reel audio using Google Gemini Multimodal Audio.
    Provides native acoustic and orthographic understanding for Indian regional languages
    (Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Urdu, etc.)
    and English.
    
    Generates:
    - Fine-grained phrase/sentence level segments with accurate timestamps
    - 100% orthographically accurate native script transcription
    - Dual-track universal English translation
    - Broadsheet lead headline and executive summary bullets
    """
    if not GEMINI_API_KEY:
        raise TranscriptionError("GEMINI_API_KEY is not configured in backend/.env")

    if not audio_path.exists() or audio_path.stat().st_size == 0:
        raise TranscriptionError("Audio file is missing or empty.")

    # Calculate approximate duration from WAV header or file size
    size_bytes = audio_path.stat().st_size
    duration_approx = max(0.0, (size_bytes - 44) / 32000.0)

    client = genai.Client(api_key=GEMINI_API_KEY)

    lang_hint = f" The user indicated the expected language may be '{language}'." if language and language.lower() not in ("auto", "none", "") else ""

    prompt = f"""You are ReelMind's Chief Audio Transcriber and Multilingual Broadsheet Editor.
Analyze this entire audio recording extracted from a video reel.{lang_hint}

TASK & ACCURACY REQUIREMENTS:
1. IDENTIFY SPOKEN LANGUAGE: Accurately identify the language(s) spoken (e.g. Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Urdu, English, or Code-Switching/Teluglish/Hinglish).
2. FINE-GRAINED SEGMENTATION: Divide the audio into natural, fine-grained phrase-level or sentence-level segments (typically 1.5 to 5.0 seconds each).
   Provide realistic start and end timestamps in seconds (float) matching the exact spoken timeline.
   CRITICAL: NEVER collapse the entire audio into one giant segment. Every spoken sentence, phrase, or clause separated by natural pauses must have its own distinct segment.
3. NATIVE SCRIPT VERBATIM ACCURACY: Transcribe each segment with 100% orthographic and grammatical accuracy in its authentic native script:
   - Use Devanagari script for Hindi, Marathi, Nepali, and Sanskrit (e.g. 'ख्यालों में भी तेरा ही ख्याल आये...').
   - Use Telugu script for Telugu (e.g. 'రిస్క్ తీసుకోండి', 'ఫెయిల్ అయితే సెలబ్రేట్ చేసుకోండి', 'భయపడేది ఏమీ లేదు', 'వదిలిపెట్టకండి').
   - Use Tamil script for Tamil, Kannada script for Kannada, Malayalam script for Malayalam, Gurmukhi for Punjabi, Bengali for Bengali, Gujarati for Gujarati, etc.
   - Use Latin script for English.
   - If code-switching (e.g. Hinglish, Teluglish, or English loanwords), preserve authentic words and proper script.
   - NEVER output phonetic gibberish or transliterate into the wrong script (e.g. do NOT write Hindi in Telugu characters or vice versa).
4. DUAL-TRACK UNIVERSAL TRANSLATION: For each segment, provide a fluent and faithful English translation in the 'translation' field.
5. BROADSHEET EDITORIAL: Provide an all-caps newspaper headline ('headline') and 2 to 4 bullet points ('summary_bullets').

Respond ONLY with valid JSON matching this exact schema:
{{
  "language": "<Detected Primary Language name, e.g. Telugu, Hindi, English>",
  "languages": ["<Detected Language name>"],
  "headline": "HEADLINE IN CAPITAL LETTERS",
  "summary_bullets": ["Key point 1", "Key point 2"],
  "segments": [
    {{
      "id": 1,
      "start": 0.0,
      "end": 2.8,
      "language": "<2-letter ISO code, e.g. te, hi, en, ta>",
      "text": "original native script text",
      "translation": "fluent English translation"
    }}
  ]
}}
"""

    last_error = None
    data = None
    used_model = None
    uploaded_file = None

    try:
        # If audio is > 18MB, use Gemini Files API upload to avoid payload limit
        if size_bytes > 18 * 1024 * 1024:
            logger.info(f"Audio file size is {size_bytes / (1024*1024):.1f}MB (>18MB); uploading via Gemini Files API...")
            uploaded_file = client.files.upload(file=audio_path)
            content_item = uploaded_file
        else:
            with open(audio_path, "rb") as f:
                audio_bytes = f.read()
            content_item = types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav")

        content_parts = [content_item, prompt]

        for model_name in GEMINI_AUDIO_MODELS:
            try:
                logger.info(f"Attempting Gemini Multimodal Audio analysis with {model_name}...")
                res = client.models.generate_content(
                    model=model_name,
                    contents=content_parts,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
                    )
                )
                raw_text = (res.text or "").strip()
                if not raw_text:
                    continue

                # Strip markdown formatting if any
                if raw_text.startswith("```"):
                    raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
                    raw_text = re.sub(r"\s*```$", "", raw_text)

                try:
                    parsed = json.loads(raw_text)
                except Exception as parse_err:
                    logger.info(f"Direct JSON parse failed ({parse_err}), attempting repair_json...")
                    try:
                        parsed = repair_json(raw_text, return_objects=True)
                    except Exception as rep_err:
                        logger.warning(f"repair_json also failed: {rep_err}")
                        parsed = None

                if isinstance(parsed, dict) and "segments" in parsed and len(parsed["segments"]) > 0:
                    data = parsed
                    used_model = model_name
                    logger.info(f"Gemini Multimodal Audio analysis succeeded using {model_name}")
                    break
            except Exception as e:
                last_error = e
                logger.warning(f"Gemini model {model_name} failed: {e}")
    finally:
        if uploaded_file is not None:
            try:
                client.files.delete(name=uploaded_file.name)
                logger.info(f"Cleaned up remote Gemini file: {uploaded_file.name}")
            except Exception as e:
                logger.warning(f"Failed to delete uploaded Gemini file: {e}")

    if not data or not data.get("segments"):
        raise TranscriptionError(f"Gemini Multimodal Audio analysis failed across all candidate models: {last_error}")

    from backend.services.language_detector import LANGUAGE_NAMES, detect_segment_language, summarize_languages
    name_to_iso = {v.lower(): k for k, v in LANGUAGE_NAMES.items()}

    primary_lang = (data.get("language") or "").strip()
    if not primary_lang or primary_lang.lower() in ("auto", "unknown", "<detected primary language name, e.g. telugu, hindi, english>"):
        primary_lang = language if language and language != "auto" else "English"

    primary_iso = name_to_iso.get(primary_lang.lower(), "en")

    # Parse and sanitize segments
    parsed_segments: List[Segment] = []
    raw_segments = data.get("segments", [])

    for idx, s in enumerate(raw_segments):
        s_text = (s.get("text") or "").strip()
        if not s_text:
            continue

        try:
            s_start = round(float(s.get("start", 0.0)), 2)
            s_end = round(float(s.get("end", s_start + 1.0)), 2)
        except (ValueError, TypeError):
            s_start = round(idx * 3.0, 2)
            s_end = round(s_start + 3.0, 2)

        if s_end <= s_start:
            s_end = round(s_start + 1.5, 2)

        s_lang = (s.get("language") or "").strip().lower()
        if not s_lang or len(s_lang) > 10 or "<" in s_lang:
            s_lang = detect_segment_language(s_text, default_lang=primary_iso)

        s_trans = (s.get("translation") or "").strip() or s_text

        parsed_segments.append(Segment(
            id=idx + 1,
            start=s_start,
            end=s_end,
            language=s_lang,
            text=s_text,
            translation=s_trans,
        ))

    if not parsed_segments:
        raise TranscriptionError("Gemini produced empty segments list.")

    # Calculate actual duration from segments
    calculated_duration = max(duration_approx, parsed_segments[-1].end)

    raw_transcript = " ".join(s.text for s in parsed_segments).strip()
    corrected_transcript = raw_transcript
    english_transcript = " ".join(s.translation or s.text for s in parsed_segments).strip()
    headline = data.get("headline") or "THE REELMIND CHRONICLE: VERBATIM DISPATCH"
    summary_bullets = data.get("summary_bullets") or []

    # Format languages
    detected_langs = [s.language for s in parsed_segments]
    distinct_languages = summarize_languages(detected_langs, primary_lang=primary_lang)

    return {
        "raw_transcript": raw_transcript,
        "corrected_transcript": corrected_transcript,
        "english_transcript": english_transcript,
        "headline": headline,
        "summary_bullets": summary_bullets,
        "language": primary_lang,
        "languages": distinct_languages,
        "duration": round(calculated_duration, 2),
        "segments": parsed_segments,
        "provider": "gemini",
        "model": used_model,
    }


# ─── High-Level Pipeline Orchestrator ─────────────────────────────────────────
def transcribe_and_analyze_audio(
    audio_wav_path: Path,
    language: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Master pipeline entry point for audio transcription and analysis:
    1. If GEMINI_API_KEY is configured:
       Analyzes the entire extracted audio using Google Gemini Multimodal Audio.
       Provides world-class regional language acoustic accuracy (Telugu, Hindi, Tamil, etc.),
       fine-grained segment timestamps, dual-track English translation, and editorial headlines.
    2. Fallback:
       If Gemini fails or is unconfigured, falls back to Groq Whisper Large v3
       with gap recovery and anti-collapse segmentation.
    """
    if GEMINI_API_KEY:
        try:
            logger.info("Engaging Gemini Multimodal Audio Engine for deep acoustic analysis...")
            return analyze_audio_gemini(audio_wav_path, language=language)
        except Exception as e:
            logger.warning(
                f"Gemini Multimodal Audio encountered an error ({e}); "
                f"seamlessly falling back to Groq Whisper Large v3 engine..."
            )

    return transcribe_audio_groq(audio_wav_path, language=language)

