import json, glob, os

BEAT_HARD_MAX = 130
PUNCH_HARD_MAX = 90
BEAT_GEN = 120
PUNCH_GEN = 80

files = sorted(glob.glob('content/course-plans/statistics--*.json'))
total_violations = 0

for f in files:
    with open(f) as fh:
        data = json.load(fh)
    fname = os.path.basename(f)
    file_violations = 0
    for i, t in enumerate(data.get('topics', [])):
        story = t.get('story', {})
        for beat_key in ['hook', 'buildup', 'discovery', 'twist', 'climax']:
            txt = story.get(beat_key, {}).get('text', '')
            if len(txt) > BEAT_GEN:
                flag = 'HARD' if len(txt) > BEAT_HARD_MAX else 'SOFT'
                print(f'{fname} | topic {i} "{t["title"][:40]}" | {beat_key}: {len(txt)} chars [{flag}]')
                file_violations += 1
        punch = story.get('punchline', {}).get('text', '')
        if len(punch) > PUNCH_GEN:
            flag = 'HARD' if len(punch) > PUNCH_HARD_MAX else 'SOFT'
            print(f'{fname} | topic {i} "{t["title"][:40]}" | punchline: {len(punch)} chars [{flag}]')
            file_violations += 1
    total_violations += file_violations
    if file_violations == 0:
        print(f'{fname}: CLEAN')
    else:
        print(f'{fname}: {file_violations} violations')

print(f'\nTOTAL VIOLATIONS: {total_violations}')
