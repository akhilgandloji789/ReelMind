import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.config import STORAGE_DIR, TRANSCRIPTS_DIR
from backend.routes.upload import transcribe_url, UrlRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/inbox", tags=["inbox"])

INBOX_FILE = STORAGE_DIR / "inbox.json"

class InboxItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str
    clean_url: Optional[str] = None
    title: Optional[str] = "Instagram Reel"
    shared_text: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    status: str = "saved"  # "saved", "transcribing", "completed"
    job_id: Optional[str] = None

class CreateInboxItemRequest(BaseModel):
    url: str
    clean_url: Optional[str] = None
    title: Optional[str] = None
    shared_text: Optional[str] = None

def _load_inbox() -> List[dict]:
    if not INBOX_FILE.exists():
        return []
    try:
        with open(INBOX_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error reading inbox file: {e}")
        return []

def _save_inbox(items: List[dict]) -> None:
    try:
        with open(INBOX_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving inbox file: {e}")

@router.get("", response_model=List[dict])
def get_inbox_items():
    """Returns all saved reel links in the Wire Inbox."""
    items = _load_inbox()

    # Check against completed transcripts to update status if already transcribed
    transcripts_map = {}
    for t_file in TRANSCRIPTS_DIR.glob("*.json"):
        try:
            with open(t_file, "r", encoding="utf-8") as f:
                t_data = json.load(f)
                src = t_data.get("source", {})
                if src and src.get("type") == "url" and src.get("url"):
                    transcripts_map[src["url"]] = t_data.get("id")
        except Exception:
            pass

    modified = False
    for item in items:
        u = item.get("url")
        c = item.get("clean_url")
        if (u in transcripts_map or c in transcripts_map) and item.get("status") != "completed":
            item["status"] = "completed"
            item["job_id"] = transcripts_map.get(u) or transcripts_map.get(c)
            modified = True

    if modified:
        _save_inbox(items)

    # Sort descending by created_at
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return items

@router.post("")
def add_inbox_item(req: CreateInboxItemRequest):
    """
    Saves a shared Reel link into the Wire Inbox.
    Deduplicates if the URL is already present.
    Does NOT initiate heavy video download or AI analysis until explicitly triggered.
    """
    url_str = req.url.strip()
    if not url_str.startswith("http://") and not url_str.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid URL format.")

    # Domain security validation
    lower_url = url_str.lower()
    if "instagram.com" not in lower_url and "instagr.am" not in lower_url:
        raise HTTPException(status_code=400, detail="Only official Instagram domains are supported.")

    items = _load_inbox()

    # Deduplication check
    for existing in items:
        if (
            existing.get("url") == url_str
            or (req.clean_url and existing.get("clean_url") == req.clean_url)
            or (req.clean_url and existing.get("url") == req.clean_url)
        ):
            return {
                "item": existing,
                "is_duplicate": True,
                "message": "This Reel dispatch is already saved in your Wire Inbox."
            }

    new_item = InboxItem(
        url=url_str,
        clean_url=req.clean_url or url_str,
        title=req.title or "Instagram Reel",
        shared_text=req.shared_text or "",
        status="saved"
    )

    items.insert(0, new_item.model_dump())
    _save_inbox(items)

    return {
        "item": new_item.model_dump(),
        "is_duplicate": False,
        "message": "Reel dispatch filed to Wire Inbox."
    }

@router.delete("/{item_id}")
def delete_inbox_item(item_id: str):
    """Deletes an item from the Wire Inbox."""
    items = _load_inbox()
    initial_len = len(items)
    items = [it for it in items if it.get("id") != item_id]

    if len(items) == initial_len:
        raise HTTPException(status_code=404, detail="Inbox item not found.")

    _save_inbox(items)
    return {"success": True, "message": "Dispatch archived from Wire Inbox."}

@router.post("/{item_id}/transcribe")
def transcribe_inbox_item(item_id: str):
    """Triggers real-time transcription pipeline for a saved inbox item."""
    items = _load_inbox()
    item = next((it for it in items if it.get("id") == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Inbox item not found.")

    # Launch transcription job using existing upload handler
    res = transcribe_url(UrlRequest(url=item.get("url"), language=None))
    job_id = res["job_id"]

    # Update inbox item status
    item["status"] = "transcribing"
    item["job_id"] = job_id
    _save_inbox(items)

    return {
        "job_id": job_id,
        "status": "transcribing",
        "message": "Transcription initiated for saved dispatch."
    }
