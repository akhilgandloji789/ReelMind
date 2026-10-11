import json
import re
import logging
from typing import List, Tuple, Dict, Any, Optional
from groq import Groq
from backend.config import GROQ_API_KEY, GEMINI_API_KEY
from backend.models.transcript import Segment

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are ReelMind's Chief Broadsheet Typesetter and Multilingual Editorial Engine.
You have two crucial tasks for the spoken dispatch:

1. CORRECTION & SCRIPT PRESERVATION:
   - Fix obvious mis-transcriptions of brand names, tech stacks, or terms (e.g. Raspberry Pi, Docker, Kubernetes, React, Python, Spring Boot, SQL, GitHub, Muse Gadget SDK).
   - If Hindi speech is in Arabic or Urdu letters, transcribe it in proper Hindi Devanagari script (हिन्दी).
   - If spoken in Telugu, ensure accurate representation.

2. DUAL-TRACK UNIVERSAL TRANSLATION:
   - For EACH segment, provide 'translation': an accurate, clear, fluent English translation.
   - If a segment is already spoken in English, the 'translation' should be the polished English sentence.
   - If spoken in Telugu, Hindi, Tamil, or other languages, translate its full meaning faithfully into English.

3. EDITORIAL LEAD & SUMMARY:
   - Provide a bold vintage newspaper 'headline' (all-caps broadsheet headline style, e.g. "DIGITAL AGENTS MONETIZED: THE REELMIND GUIDE TO MUSE SDK").
   - Provide 2 to 4 'summary_bullets' explaining key takeaways and actionable facts.

STRICT INSTRUCTIONS:
- Preserve every segment id and chronological order.
- Do NOT drop or omit any segments.
- Output MUST be valid JSON with keys: 'headline', 'summary_bullets', and 'segments'.
"""

def refine_and_translate_transcript(
    raw_transcript: str,
    segments: List[Segment]
) -> Tuple[str, List[Segment], Optional[str], Optional[str], List[str]]:
    """
    Refines transcript segments, generates dual-track English translation,
    broadsheet headline, and executive summary bullets.
    
    Returns:
    (corrected_text, refined_segments, english_full_text, headline, summary_bullets)
    """
    if not segments:
        return raw_transcript, segments, raw_transcript, "DISPATCH RECORD", []

    # Prepare lightweight payload
    payload = [
        {"id": s.id, "text": s.text, "language": s.language}
        for s in segments
    ]

    headline = "THE REELMIND CHRONICLE: VERBATIM DISPATCH"
    summary_bullets = []
    
    # Try Groq openai/gpt-oss-20b for ultra-fast, high-accuracy editorial processing
    if GROQ_API_KEY:
        try:
            client = Groq(api_key=GROQ_API_KEY)
            prompt = (
                f"Analyze and process these audio transcript segments:\n"
                f"{json.dumps(payload, ensure_ascii=False)}\n\n"
                f"Respond ONLY in valid JSON matching this schema:\n"
                f"{{\n"
                f'  "headline": "STRING",\n'
                f'  "summary_bullets": ["STRING", "STRING"],\n'
                f'  "segments": [\n'
                f'    {{"id": 1, "text": "corrected spoken text", "translation": "fluent english translation", "language": "detected language"}}\n'
                f"  ]\n"
                f"}}"
            )

            res = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=4096
            )

            content = res.choices[0].message.content or ""
            data = json.loads(content)

            if isinstance(data, dict):
                headline = data.get("headline", headline)
                summary_bullets = data.get("summary_bullets", [])
                refined_items = data.get("segments", [])

                item_map = {item.get("id"): item for item in refined_items if isinstance(item, dict)}

                new_segments: List[Segment] = []
                for s in segments:
                    entry = item_map.get(s.id, {})
                    c_text = entry.get("text", s.text).strip() or s.text
                    c_trans = entry.get("translation", s.text).strip() or s.text
                    c_lang = entry.get("language") or s.language

                    new_segments.append(Segment(
                        id=s.id,
                        start=s.start,
                        end=s.end,
                        language=c_lang,
                        text=c_text,
                        translation=c_trans
                    ))

                corrected_full = " ".join(s.text for s in new_segments).strip()
                english_full = " ".join(s.translation or s.text for s in new_segments).strip()

                logger.info(f"Dual-track enrichment successful: {len(new_segments)} segments translated.")
                return corrected_full, new_segments, english_full, headline, summary_bullets

        except Exception as e:
            logger.warning(f"Groq transcript refinement failed ({e}), falling back to verbatim dual-track: {e}")

    # Fallback: ensure translation is set to text so UI never has blank translation
    fallback_segments: List[Segment] = []
    for s in segments:
        fallback_segments.append(Segment(
            id=s.id,
            start=s.start,
            end=s.end,
            language=s.language,
            text=s.text,
            translation=s.text
        ))

    return raw_transcript, fallback_segments, raw_transcript, headline, summary_bullets

# Maintain backward compatibility with previous function name
def refine_transcript_with_gemini(raw_transcript: str, segments: List[Segment]):
    corrected_text, new_segments, _, _, _ = refine_and_translate_transcript(raw_transcript, segments)
    return corrected_text, new_segments


def answer_inquiry_desk(
    segments: List[Segment],
    question: str,
    headline: Optional[str] = None
) -> Dict[str, Any]:
    """
    Answers user questions about the reel in ANY language (Telugu, Hindi, English, etc.)
    using the dual-track segments and timestamps.
    Supports Groq with seamless Google Gemini fallback.
    """
    if not GROQ_API_KEY and not GEMINI_API_KEY:
        return {
            "answer": "AI Inquiry Desk is unavailable because neither GROQ_API_KEY nor GEMINI_API_KEY is configured.",
            "citations": []
        }

    # Format transcript with timestamps
    context_lines = []
    for s in segments:
        # Include both original and English translation for maximum comprehension
        line = f"[{int(s.start//60):02d}:{int(s.start%60):02d}] {s.text}"
        if s.translation and s.translation != s.text:
            line += f" (English: {s.translation})"
        context_lines.append(line)

    context_str = "\n".join(context_lines)

    inquiry_system_prompt = (
        "You are the Chief Reference Editor at The ReelMind Chronicle Inquiry Desk.\n"
        "Your task is to answer the reader's question accurately and authoritatively based SOLELY on the provided video dispatch.\n"
        "RULES:\n"
        "1. MATCH USER LANGUAGE: If the question is in Telugu, answer in fluent Telugu. If in Hindi, answer in fluent Hindi. If in English, answer in clear English. If in another language, answer in that language.\n"
        "2. TIMESTAMP CITATIONS: Include timestamps in format [MM:SS] whenever referencing a statement (e.g., [00:45] or [01:12]).\n"
        "3. ACCURACY & CONCISENESS: Be direct, informative, and stick to the facts stated in the transcript. Do not fabricate external facts.\n"
        "4. TONE: Maintain a smart, courteous editorial broadsheet tone."
    )

    user_message = (
        f"DISPATCH HEADLINE: {headline or 'Verbatim Reel Recording'}\n\n"
        f"DISPATCH TIMELINED TRANSCRIPT:\n{context_str}\n\n"
        f"READER'S INQUIRY: {question}"
    )

    answer_text = None

    # Try Groq first
    if GROQ_API_KEY:
        try:
            client = Groq(api_key=GROQ_API_KEY)
            res = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[
                    {"role": "system", "content": inquiry_system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.2,
                max_tokens=1024
            )
            answer_text = res.choices[0].message.content or ""
        except Exception as e:
            logger.warning(f"Groq inquiry desk query failed ({e}); falling back to Gemini...")

    # Fallback to Gemini if Groq failed or unconfigured
    if not answer_text and GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types
            g_client = genai.Client(api_key=GEMINI_API_KEY)
            g_res = g_client.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=f"{inquiry_system_prompt}\n\n{user_message}",
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
                )
            )
            answer_text = g_res.text or ""
        except Exception as e:
            logger.error(f"Gemini inquiry desk fallback query failed: {e}")

    if not answer_text:
        return {
            "answer": "The Inquiry Desk was unable to process the query across available providers.",
            "citations": []
        }

    # Extract timestamp citations [MM:SS]
    citations = []
    matches = re.findall(r"\[(\d{1,2}):(\d{2})\]", answer_text)
    for m in matches:
        minutes = int(m[0])
        seconds = int(m[1])
        total_sec = minutes * 60 + seconds
        citations.append({
            "label": f"{minutes:02d}:{seconds:02d}",
            "seconds": total_sec
        })

    return {
        "answer": answer_text,
        "citations": citations
    }
