import sys, json, re, difflib, os
import numpy as np, soundfile as sf, parselmouth
from parselmouth.praat import call
from pedalboard import Pedalboard, HighpassFilter, PeakFilter, LowShelfFilter, Compressor, Gain, Limiter
src = open(os.path.join(os.path.dirname(__file__), 'voice_pipeline.py')).read()
exec(src[src.index('DIG ='):src.index('def recognize')])
P = sys.argv[1]; VO = sys.argv[2]
script = json.load(open(f'{P}/script.json')); sel = json.load(open(f'{VO}/select.json'))
LEAD, GAP, TAIL, SR = 0.5, 0.4, 1.0, 44100

def trim(x, sr, thr=0.012):
    env = np.convolve(np.abs(x), np.ones(441) / 441, 'same'); idx = np.where(env > thr)[0]
    a = max(idx[0] - int(.03 * sr), 0); b = min(idx[-1] + int(.06 * sr), len(x)); return a, b

def male_tone(path):
    snd = parselmouth.Sound(path); pt = snd.to_pitch(); f = pt.selected_array['frequency']; f = f[f > 0]
    med = float(np.median(f))
    if med > 125:  # nudge only when the take drifts high
        snd = call(snd, 'Change gender', 75, 600, 1.0, 115, 1.0, 1.0)
    return snd.values[0].astype(np.float32), int(snd.sampling_frequency), med

chain = Pedalboard([HighpassFilter(80), LowShelfFilter(180, 1.5), PeakFilter(3200, 2.0, .8),
                    Compressor(threshold_db=-20, ratio=3, attack_ms=5, release_ms=80), Gain(4), Limiter(-1.5)])
out = [np.zeros(int(LEAD * SR), np.float32)]; t = LEAD; cuts = []; srt = []
for c in script:
    b = sel[c['id']]; x, sr, f0 = male_tone(b['path']); assert sr == SR
    a, e = trim(x, sr); seg = x[a:e]; off = a / sr; dur = len(seg) / sr
    # char times from ASR tokens
    achars, atimes = [], []
    for tok, ts in zip(b['tokens'], b['ts']):
        for ch in hang(tok): achars.append(ch); atimes.append(ts - off)
    segs = [hang(s) for s in c['tts']]; ref = ''.join(segs)
    known = {}
    for m in difflib.SequenceMatcher(None, ref, ''.join(achars), autojunk=False).get_matching_blocks():
        for j in range(m.size): known[m.a + j] = atimes[m.b + j]
    starts, idx = [], 0
    for s in segs:
        prop = dur * idx / len(ref)
        tt = known.get(idx)
        if tt is None:  # interpolate between nearest anchors, fall back to syllable proportion
            lo = max([k for k in known if k < idx], default=None); hi = min([k for k in known if k > idx], default=None)
            tt = (known[lo] + (known[hi] - known[lo]) * (idx - lo) / (hi - lo)) if lo is not None and hi is not None else prop
        starts.append(.6 * tt + .4 * prop if idx else 0.0); idx += len(s)
    for k in range(1, len(starts)): starts[k] = max(starts[k], starts[k - 1] + .18)
    starts = [min(s, dur - .2) for s in starts]
    cuts.append(dict(id=c['id'], start=round(t, 3), end=round(t + dur, 3), score=b['score'], f0=round(f0, 1),
                     segs=[dict(t=round(t + s, 3), text=txt) for s, txt in zip(starts, c['sub'])]))
    srt.append((t, t + dur, ' '.join(c['sub']).replace('*', '')))
    out.append(seg); t += dur
    out.append(np.zeros(int(GAP * SR), np.float32)); t += GAP
out[-1] = np.zeros(int(TAIL * SR), np.float32); t += TAIL - GAP
voice = chain(np.concatenate(out)[None, :], SR)[0]
sf.write(f'{P}/build/voice.wav', voice, SR, subtype='PCM_16')
tl = dict(fps=30, total=round(len(voice) / SR, 3), cuts=cuts)
json.dump(tl, open(f'{P}/build/timeline.json', 'w'), ensure_ascii=False, indent=1)
open(f'{P}/timeline.js', 'w').write('window.TIMELINE=' + json.dumps(tl, ensure_ascii=False) + ';\n')
fmt = lambda s: f'{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(s % 60):02d},{int(round(s % 1 * 1000)) % 1000:03d}'
open(f'{P}/subtitles.srt', 'w').write(''.join(f'{i + 1}\n{fmt(a)} --> {fmt(b)}\n{s}\n\n' for i, (a, b, s) in enumerate(srt)))
print('total', tl['total'])
for c in cuts: print(f"{c['id']:8s} {c['start']:6.2f}-{c['end']:6.2f} score={c['score']} f0={c['f0']}")
