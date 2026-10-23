import sys, json, re, os, difflib
import numpy as np, soundfile as sf, sherpa_onnx, parselmouth
from parselmouth.praat import call
sys.path.insert(0, os.path.dirname(__file__)); from tts_lib import make, gen
SCRIPT, OUT = sys.argv[1], sys.argv[2]
NCAND = int(sys.argv[3]) if len(sys.argv) > 3 else 8
ONLY = sys.argv[4].split(',') if len(sys.argv) > 4 else None
SPEED, SID, STEPS = 1.35, 6, 12
A = os.path.join(os.path.dirname(__file__), 'tts/sherpa-onnx-zipformer-korean-2024-06-24')
asr = sherpa_onnx.OfflineRecognizer.from_transducer(
    encoder=f'{A}/encoder-epoch-99-avg-1.int8.onnx', decoder=f'{A}/decoder-epoch-99-avg-1.int8.onnx',
    joiner=f'{A}/joiner-epoch-99-avg-1.int8.onnx', tokens=f'{A}/tokens.txt', num_threads=4)
DIG = '영일이삼사오육칠팔구'
def sino(n):
    if n == 0: return '영'
    out = ''
    for unit, name in ((100000000, '억'), (10000, '만')):
        if n >= unit: out += sino(n // unit) + name; n %= unit
    for unit, name in ((1000, '천'), (100, '백'), (10, '십')):
        d = n // unit
        if d: out += ('' if d == 1 else DIG[d]) + name
        n %= unit
    return out + (DIG[n] if n else '')
def num2kor(m):
    s = m.group(0); a, _, b = s.partition('.')
    return sino(int(a)) + ('점' + ''.join(DIG[int(ch)] for ch in b) if b else '')
def hang(s):
    s = re.sub(r'\d+(?:\.\d+)?', num2kor, s.replace(',', ''))
    s = s.replace('%', '퍼센트')
    return ''.join(re.findall('[가-힣]', s))

def recognize(path):
    x, sr = sf.read(path, dtype='float32')
    st = asr.create_stream(); st.accept_waveform(sr, x); asr.decode_stream(st)
    r = st.result
    return r.text, list(r.tokens), list(r.timestamps)

def pitch(path):
    p = parselmouth.Sound(path).to_pitch()
    f = p.selected_array['frequency']; f = f[f > 0]
    return float(np.median(f)) if len(f) else 0.0

os.makedirs(f'{OUT}/cand', exist_ok=True)
script = json.load(open(SCRIPT)); tts = make()
report = json.load(open(f'{OUT}/select.json')) if ONLY and os.path.exists(f'{OUT}/select.json') else {}
for i, c in enumerate(script):
    if ONLY and c['id'] not in ONLY: continue
    ref = hang(''.join(c['tts'])); best = None
    for k in range(NCAND):
        p = f"{OUT}/cand/{i:02d}_{c['id']}_{k}.wav"
        dur = gen(tts, ' '.join(c['tts']), p, sid=SID, speed=c.get('speed', SPEED), steps=STEPS)
        text, toks, ts = recognize(p)
        score = difflib.SequenceMatcher(None, ref, hang(text)).ratio()
        f0 = pitch(p)
        cand = dict(path=p, score=round(score, 3), f0=round(f0, 1), dur=round(dur, 2), asr=text, tokens=toks, ts=ts)
        if best is None or (score, f0) > (best['score'], best['f0']): best = cand
        print(c['id'], k, cand['score'], cand['dur'], text, flush=True)
    if c['id'] in report and report[c['id']]['score'] > best['score']: best = report[c['id']]
    report[c['id']] = best
json.dump(report, open(f'{OUT}/select.json', 'w'), ensure_ascii=False, indent=1)
