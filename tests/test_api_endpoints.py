import sys
from fastapi.testclient import TestClient
from backend.main import app

def test_api_transcription_and_inquiry():
    client = TestClient(app)
    
    # 1. Fetch transcript for 1e4d99c6
    res = client.get("/api/transcription/1e4d99c6-355c-4e42-b9c4-a646b62a8525")
    assert res.status_code == 200
    data = res.json()
    assert len(data["segments"]) == 5, f"Expected 5 segments, got {len(data['segments'])}"
    assert data["status"] == "completed"
    assert "Telugu" in data["languages"]
    assert "రిస్క్" in data["corrected_transcript"]
    assert "సెలబ్రేట్" in data["corrected_transcript"]
    
    # 2. Test Inquiry Desk
    inq_res = client.post(
        "/api/transcription/1e4d99c6-355c-4e42-b9c4-a646b62a8525/ask",
        json={"question": "What advice is given about falling down or failing?"}
    )
    assert inq_res.status_code == 200
    inq_data = inq_res.json()
    assert len(inq_data["answer"]) > 0
    # The inquiry desk returned valid answer and citations
    assert inq_data["answer"] is not None

if __name__ == "__main__":
    test_api_transcription_and_inquiry()
