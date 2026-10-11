import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter
from pydantic import BaseModel

from backend.config import STORAGE_DIR, TRANSCRIPTS_DIR, GROQ_API_KEY
from groq import Groq

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sunday-digest", tags=["sunday-digest"])

INBOX_FILE = STORAGE_DIR / "inbox.json"

class CategoryBreakdown(BaseModel):
    name: str
    percentage: int
    count: int

class SundayBulletin(BaseModel):
    id: str
    title: str
    takeaway: str
    category: str
    reel_url: Optional[str] = None
    language: Optional[str] = None

class SundayDigestResponse(BaseModel):
    week_label: str
    edition_date: str
    total_reels: int
    total_duration_minutes: float
    top_languages: List[str]
    headline: str
    editorial: str
    categories: List[CategoryBreakdown]
    bulletins: List[SundayBulletin]
    whatsapp_text: str

def _load_all_reels_and_transcripts():
    # Load inbox items
    inbox_items = []
    if INBOX_FILE.exists():
        try:
            with open(INBOX_FILE, "r", encoding="utf-8") as f:
                inbox_items = json.load(f)
        except Exception as e:
            logger.error(f"Error loading inbox: {e}")

    # Load completed transcripts
    transcripts_map = {}
    for f in TRANSCRIPTS_DIR.glob("*.json"):
        try:
            with open(f, "r", encoding="utf-8") as tf:
                data = json.load(tf)
                job_id = data.get("id")
                if job_id:
                    transcripts_map[job_id] = data
        except Exception:
            pass

    return inbox_items, transcripts_map

@router.get("", response_model=SundayDigestResponse)
def get_sunday_digest():
    """Generates and returns the weekly Sunday Edition intelligence brief."""
    inbox_items, transcripts_map = _load_all_reels_and_transcripts()

    now = datetime.utcnow()
    # Range of current week
    start_of_week = now - timedelta(days=7)
    week_label = f"Week of {start_of_week.strftime('%b %d')} – {now.strftime('%b %d, %Y')}"
    edition_date = now.strftime("%A, %B %d, %Y")

    # Filter items from past 7 days (or use all items if fewer than 5)
    recent_items = [
        item for item in inbox_items
        if datetime.fromisoformat(item.get("created_at", now.isoformat()).replace("Z", "+00:00")).replace(tzinfo=None) >= start_of_week
    ]
    if len(recent_items) < 3 and inbox_items:
        recent_items = inbox_items[:15]

    total_reels = len(recent_items)
    total_seconds = 0.0
    detected_langs = {}
    transcribed_summaries = []

    for item in recent_items:
        job_id = item.get("job_id")
        t_data = transcripts_map.get(job_id) if job_id else None
        
        url = item.get("clean_url") or item.get("url", "")
        title = item.get("title") or "Instagram Reel"
        shared_text = item.get("shared_text", "")

        if t_data:
            dur = float(t_data.get("duration", 0))
            total_seconds += dur
            for lang in t_data.get("languages", []):
                detected_langs[lang] = detected_langs.get(lang, 0) + 1
            
            summary_txt = t_data.get("english_transcript") or t_data.get("corrected_transcript") or t_data.get("raw_transcript") or ""
            transcribed_summaries.append({
                "id": item.get("id", ""),
                "title": title,
                "url": url,
                "summary": summary_txt[:300],
                "headline": t_data.get("headline", title),
            })
        else:
            # Not yet transcribed
            total_seconds += 30.0 # estimate 30s per reel
            transcribed_summaries.append({
                "id": item.get("id", ""),
                "title": title,
                "url": url,
                "summary": shared_text[:200] if shared_text else "Awaiting rotary transcription",
                "headline": title,
            })

    total_duration_minutes = round(total_seconds / 60.0, 1)
    sorted_langs = sorted(detected_langs.keys(), key=lambda k: detected_langs[k], reverse=True)
    if not sorted_langs:
        sorted_langs = ["Multilingual (Telugu, Hindi, English)"]

    # Generate LLM synthesis via Groq or smart fallback
    headline = "THE SUNDAY DISPATCH: WEEKLY CURATION OF DIGITAL DISPATCHES"
    editorial = (
        f"This week, the newsroom filed {total_reels} dispatches across the wire, totaling approximately "
        f"{total_duration_minutes} minutes of captured spoken audio. The dispatches demonstrate keen curiosity "
        f"across engineering, practical recipes, and actionable intelligence."
    )
    categories = [
        CategoryBreakdown(name="Tech & Engineering", percentage=45, count=max(1, int(total_reels * 0.45))),
        CategoryBreakdown(name="Cooking & Gastronomy", percentage=30, count=max(1, int(total_reels * 0.30))),
        CategoryBreakdown(name="Personal Finance & Growth", percentage=25, count=max(1, int(total_reels * 0.25))),
    ]
    bulletins: List[SundayBulletin] = []

    if GROQ_API_KEY and transcribed_summaries:
        try:
            client = Groq(api_key=GROQ_API_KEY)
            prompt = f"""You are the Editor-in-Chief of The ReelMind Chronicle Sunday Edition.
Analyze these {total_reels} reels saved by the reader this week:
{json.dumps(transcribed_summaries[:8], indent=2)}

Generate a Sunday Edition summary in strict JSON format:
{{
  "headline": "A grand vintage broadsheet all-caps headline synthesizing the week's themes",
  "editorial": "Two concise editorial paragraphs summarizing what the user learned and focused on this week",
  "categories": [
    {{"name": "Category Name", "percentage": 40, "count": 3}}
  ],
  "bulletins": [
    {{
      "id": "reel id",
      "title": "Clear punchy title",
      "takeaway": "Specific lesson, recipe step, or insight learned",
      "category": "Tech/Cooking/Finance/etc",
      "reel_url": "url"
    }}
  ]
}}"""
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a Pulitzer-prize winning vintage newspaper editor. Respond strictly with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            result = json.loads(completion.choices[0].message.content)
            if result.get("headline"):
                headline = result["headline"]
            if result.get("editorial"):
                editorial = result["editorial"]
            if result.get("categories"):
                categories = [CategoryBreakdown(**c) for c in result["categories"]]
            if result.get("bulletins"):
                bulletins = [SundayBulletin(**b) for b in result["bulletins"]]
        except Exception as e:
            logger.warning(f"Sunday digest LLM failed, using baseline fallback: {e}")

    # If bulletins empty, populate from items
    if not bulletins:
        for idx, item in enumerate(recent_items[:5]):
            bulletins.append(
                SundayBulletin(
                    id=item.get("id", str(idx)),
                    title=item.get("title", f"Dispatch #{idx+1}"),
                    takeaway=item.get("shared_text") or "Verbatim spoke notes filed in the telegraph archives.",
                    category="General Dispatch",
                    reel_url=item.get("clean_url") or item.get("url")
                )
            )

    # Format WhatsApp broadcast message
    wa_lines = [
        "🗞️ *THE SUNDAY REELMIND CHRONICLE* 🗞️",
        f"📅 *{edition_date}*",
        "═════════════════════════",
        f"📊 *THIS WEEK'S PRESS METRICS:*",
        f"• Total Reels Filed: *{total_reels} Dispatches*",
        f"• Spoken Time Digested: *{total_duration_minutes} minutes*",
        f"• Languages: *{', '.join(sorted_langs[:3])}*",
        "",
        "🏷️ *BEAT & CATEGORY BREAKDOWN:*"
    ]
    for cat in categories:
        wa_lines.append(f"• {cat.name}: *{cat.percentage}%* ({cat.count} reels)")

    wa_lines.append("")
    wa_lines.append("💡 *TOP SUNDAY LESSONS & RECIPES:*")
    for i, b in enumerate(bulletins[:4], 1):
        wa_lines.append(f"{i}. *{b.title}*: {b.takeaway}")
        if b.reel_url:
            wa_lines.append(f"   📹 {b.reel_url}")

    wa_lines.append("")
    wa_lines.append("═════════════════════════")
    wa_lines.append("🗞️ *Read Full Broadsheet:* https://reelmind-c0293.web.app/sunday")

    whatsapp_text = "\n".join(wa_lines)

    return SundayDigestResponse(
        week_label=week_label,
        edition_date=edition_date,
        total_reels=total_reels,
        total_duration_minutes=total_duration_minutes,
        top_languages=sorted_langs,
        headline=headline,
        editorial=editorial,
        categories=categories,
        bulletins=bulletins,
        whatsapp_text=whatsapp_text
    )
