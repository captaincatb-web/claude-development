import sys, json, difflib, re
sys.argv += []; cid, path = sys.argv[1], sys.argv[2]
src = open('voice_pipeline.py').read()
head = src[:src.index("os.makedirs(f'{OUT}/cand'")].replace("SCRIPT, OUT = sys.argv[1], sys.argv[2]", "SCRIPT, OUT = '/home/user/claude-development/market-brief-1023/script.json', 'vo'")
exec(head)
c = next(c for c in json.load(open(SCRIPT)) if c['id'] == cid)
text, toks, ts = recognize(path); score = difflib.SequenceMatcher(None, hang(''.join(c['tts'])), hang(text)).ratio()
import soundfile as sf; x, sr = sf.read(path)
s = json.load(open('vo/select.json'))
s[cid] = dict(path=path, score=round(score, 3), f0=round(pitch(path), 1), dur=round(len(x) / sr, 2), asr=text, tokens=toks, ts=ts)
json.dump(s, open('vo/select.json', 'w'), ensure_ascii=False, indent=1); print(cid, s[cid]['score'], text)
