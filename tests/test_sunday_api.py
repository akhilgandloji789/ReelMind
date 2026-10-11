import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_sunday_digest_endpoint():
    response = client.get("/api/sunday-digest")
    assert response.status_code == 200
    data = response.json()
    assert "week_label" in data
    assert "edition_date" in data
    assert "total_reels" in data
    assert "headline" in data
    assert "categories" in data
    assert "bulletins" in data
    assert "whatsapp_text" in data
    assert "THE SUNDAY REELMIND CHRONICLE" in data["whatsapp_text"]
