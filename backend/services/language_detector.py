import re
from typing import List, Dict, Any, Tuple

# Comprehensive Unicode regex patterns for all major global scripts
SCRIPT_PATTERNS = {
    "te": re.compile(r"[\u0C00-\u0C7F]"),                    # Telugu
    "hi": re.compile(r"[\u0900-\u097F]"),                    # Devanagari (Hindi, Marathi, Nepali, Sanskrit)
    "ta": re.compile(r"[\u0B80-\u0BFF]"),                    # Tamil
    "kn": re.compile(r"[\u0C80-\u0CFF]"),                    # Kannada
    "ml": re.compile(r"[\u0D00-\u0D7F]"),                    # Malayalam
    "bn": re.compile(r"[\u0980-\u09FF]"),                    # Bengali & Assamese
    "gu": re.compile(r"[\u0A80-\u0AFF]"),                    # Gujarati
    "pa": re.compile(r"[\u0A00-\u0A7F]"),                    # Gurmukhi / Punjabi
    "or": re.compile(r"[\u0B00-\u0B7F]"),                    # Odia
    "ur": re.compile(r"[\u0600-\u06FF\u0750-\u077F]"),       # Arabic / Urdu / Persian / Farsi
    "zh": re.compile(r"[\u4E00-\u9FFF]"),                    # Chinese (Hanzi)
    "ja": re.compile(r"[\u3040-\u30FF\u31F0-\u31FF]"),       # Japanese (Hiragana & Katakana)
    "ko": re.compile(r"[\uAC00-\uD7AF\u1100-\u11FF]"),       # Korean (Hangul)
    "ru": re.compile(r"[\u0400-\u04FF]"),                    # Cyrillic (Russian, Ukrainian, etc.)
    "th": re.compile(r"[\u0E00-\u0E7F]"),                    # Thai
    "el": re.compile(r"[\u0370-\u03FF]"),                    # Greek
    "he": re.compile(r"[\u0590-\u05FF]"),                    # Hebrew
    "en": re.compile(r"[a-zA-Z]"),                            # Latin (English, Spanish, French, German, etc.)
}

LANGUAGE_NAMES: Dict[str, str] = {
    "en": "English",
    "te": "Telugu",
    "hi": "Hindi",
    "ta": "Tamil",
    "kn": "Kannada",
    "ml": "Malayalam",
    "bn": "Bengali",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "mr": "Marathi",
    "ur": "Urdu",
    "or": "Odia",
    "sa": "Sanskrit",
    "ja": "Japanese",
    "zh": "Chinese",
    "ko": "Korean",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "ar": "Arabic",
    "fa": "Persian",
    "tr": "Turkish",
    "vi": "Vietnamese",
    "th": "Thai",
    "id": "Indonesian",
    "ms": "Malay",
    "nl": "Dutch",
    "pl": "Polish",
    "sv": "Swedish",
    "uk": "Ukrainian",
    "el": "Greek",
    "he": "Hebrew",
    "mixed": "Mixed",
}

def detect_segment_language(text: str, default_lang: str = "en") -> str:
    """
    Analyzes character counts across global scripts to detect code-switching and languages.
    If multiple distinct scripts appear (e.g. English technical jargon inside Telugu speech),
    tags as 'mixed'.
    """
    if not text or not text.strip():
        return default_lang

    clean_text = text.strip()
    total_alpha = len(re.findall(r"[\w]", clean_text))
    if total_alpha == 0:
        return default_lang

    counts = {}
    for lang, pattern in SCRIPT_PATTERNS.items():
        matches = len(pattern.findall(clean_text))
        if matches > 0:
            counts[lang] = matches

    latin_count = counts.get("en", 0)
    non_latin_langs = [l for l in counts if l != "en"]
    
    # Check for code-switching (e.g. Latin words inside Indian/Asian script)
    if non_latin_langs and latin_count >= 3:
        top_non_latin = max(non_latin_langs, key=lambda l: counts[l])
        if counts[top_non_latin] >= 3 and latin_count >= 3:
            return "mixed"

    if counts:
        top_lang = max(counts.items(), key=lambda x: x[1])[0]
        # If dominant is Latin, preserve default_lang if it is a European Latin language
        if top_lang == "en" and default_lang in {"es", "fr", "de", "it", "pt", "nl", "pl", "sv", "tr", "vi", "id"}:
            return default_lang
        return top_lang

    return default_lang

def get_language_display_name(code: str) -> str:
    return LANGUAGE_NAMES.get(code.lower(), code.title())

def summarize_languages(segment_languages: List[str], primary_lang: str = "en") -> List[str]:
    """Generates distinct list of human-readable languages detected across all segments."""
    found_names: List[str] = []
    has_mixed = False

    for lang in segment_languages:
        clean = lang.lower().strip()
        if not clean:
            continue
        if clean == "mixed":
            has_mixed = True
            continue
        display = get_language_display_name(clean)
        if display not in found_names:
            found_names.append(display)

    if primary_lang:
        clean_primary = primary_lang.lower().strip()
        if clean_primary and clean_primary != "mixed":
            primary_display = get_language_display_name(clean_primary)
            if primary_display not in found_names:
                found_names.insert(0, primary_display)

    # If code-switching was detected and we have another language, ensure English is listed
    if has_mixed:
        if "English" not in found_names:
            found_names.append("English")
        if "Mixed" not in found_names and len(found_names) <= 1:
            found_names.append("Mixed")

    # Deduplicate preserving order
    deduped = list(dict.fromkeys(found_names))
    return deduped if deduped else ["English"]
