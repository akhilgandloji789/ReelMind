import sys
from pathlib import Path
from backend.services.audio_processor import extract_audio
from backend.services.transcription_service import transcribe_audio_groq

sys.stdout.reconfigure(encoding='utf-8')

video_path = Path('storage/uploads/full_duration_test.mp4')
wav_path = Path('storage/audio/full_dur_test.wav')

extract_audio(video_path, wav_path)
res = transcribe_audio_groq(wav_path)

print('Total Duration:', res['duration'])
print('Raw Transcript:', res['raw_transcript'])
print('Segments count:', len(res['segments']))
for s in res['segments']:
    print(f'[{s.start:.1f}s - {s.end:.1f}s] {s.language}: "{s.text}"')

# Verify that both the head and tail phrases are captured
text_lower = res['raw_transcript'].lower()
has_head = "extra extra" in text_lower or "chronicle" in text_lower or "broadsheet" in text_lower
has_tail = "reporting from the end" in text_lower or "cutoff" in text_lower or "early" in text_lower

print('Head speech captured:', has_head)
print('Tail speech captured:', has_tail)
assert has_head and has_tail, "Both beginning and end of reel must be transcribed!"
print('SUCCESS: Full duration transcribed completely without any early cutoff!')
