from fastapi.testclient import TestClient
from backend.main import app
import time

client = TestClient(app)
with open('storage/uploads/spoken_sample.mp4', 'rb') as f:
    resp = client.post('/api/upload', files={'file': ('spoken_sample.mp4', f, 'video/mp4')})

print('Upload response:', resp.status_code, resp.json())
job_id = resp.json()['job_id']

for i in range(25):
    time.sleep(1)
    status_resp = client.get(f'/api/status/{job_id}')
    data = status_resp.json()
    print(f"Step {i}: {data['status']} - {data['stage_message']} ({data['progress_percent']}%)")
    if data['status'] in ('completed', 'failed'):
        print('Finished with result:')
        print('Raw Transcript:', data.get('result', {}).get('raw_transcript'))
        print('Corrected Transcript:', data.get('result', {}).get('corrected_transcript'))
        print('Detected Languages:', data.get('result', {}).get('languages'))
        print('Segments:', data.get('result', {}).get('segments'))
        if data['status'] == 'failed':
            print('Error:', data.get('error'))
        break
