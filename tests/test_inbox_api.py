import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_inbox_lifecycle():
    # 1. Fetch inbox initially
    res = client.get("/api/inbox")
    assert res.status_code == 200
    initial_items = res.json()
    assert isinstance(initial_items, list)

    # 2. Add an Instagram Reel link
    reel_url = "https://www.instagram.com/reel/DeMivRlK-yA/?stkn=MXJyeHljbnU5M2NpNQ=="
    add_res = client.post("/api/inbox", json={
        "url": reel_url,
        "clean_url": "https://www.instagram.com/reel/DeMivRlK-yA/",
        "title": "Meta Muse AI Gadget Reel",
        "shared_text": "Check out this reel: https://www.instagram.com/reel/DeMivRlK-yA/?stkn=MXJyeHljbnU5M2NpNQ=="
    })
    assert add_res.status_code == 200
    data = add_res.json()
    assert "item" in data
    assert data["item"]["url"] == reel_url
    assert data["item"]["status"] in ("saved", "completed")
    item_id = data["item"]["id"]

    # 3. Test deduplication
    dup_res = client.post("/api/inbox", json={
        "url": reel_url,
        "clean_url": "https://www.instagram.com/reel/DeMivRlK-yA/",
        "title": "Duplicate Share Attempt"
    })
    assert dup_res.status_code == 200
    dup_data = dup_res.json()
    assert dup_data["is_duplicate"] is True
    assert dup_data["item"]["id"] == item_id

    # 4. Reject non-Instagram URLs
    bad_res = client.post("/api/inbox", json={
        "url": "https://example.com/not-instagram-reel",
        "title": "Bad Domain"
    })
    assert bad_res.status_code == 400

    # 5. Delete item
    del_res = client.delete(f"/api/inbox/{item_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True
