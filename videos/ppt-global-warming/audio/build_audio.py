# 업로드된 음성(voice_original.mp3)을 슬라이드별로 자르고 0.9배속(음높이 유지) + 슬라이드 사이 여유를 넣어 narration.wav와 timeline.json을 만든다.
import json, subprocess, numpy as np, soundfile as sf, pyloudnorm as pyln, os, tempfile
from scipy.signal import resample_poly
SPEED = 0.9
SR = 44100
# 원본 음성에서 슬라이드별 말하는 구간 [시작, 끝] (초) — 무음 분석(silencedetect)과 에너지 최소 지점으로 결정
SPEECH = [(0.498, 7.417), (7.918, 36.54), (36.54, 46.267), (46.971, 58.774), (59.438, 63.888)]
EDGE_PAD = 0.12                                  # 말 앞뒤로 포함할 자연 여백(경계가 붙어 있는 곳은 0)
LEAD = [1.2, 1.0, 1.0, 1.0, 1.0]                 # 슬라이드가 먼저 나타나고 말이 시작하기까지
TAIL = [1.5, 2.5, 1.5, 3.5, 3.5]                 # 말이 끝난 뒤 머무는 시간 (2번: 차트 감상, 4번: 청중 생각, 5번: 마무리)
x, sr = sf.read('voice_original.mp3', dtype='float32'); x = x if x.ndim == 1 else x.mean(1)
words = json.load(open('words_original.json'))
def slow(seg):
    with tempfile.TemporaryDirectory() as d:
        sf.write(f'{d}/a.wav', seg, sr)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f'{d}/a.wav', '-af', f'atempo={SPEED}', '-ar', str(SR), f'{d}/b.wav'], check=True)
        y, _ = sf.read(f'{d}/b.wav', dtype='float32'); return y
segs, info = [], []
for i, (a, b) in enumerate(SPEECH):
    pa = 0 if i == 2 else EDGE_PAD; pb = 0 if i == 1 else EDGE_PAD          # 이어 붙은 경계(2→3)는 패딩 없음
    ca, cb = max(0, a - pa), min(len(x) / sr, b + pb)
    seg = x[int(ca * sr):int(cb * sr)].copy()
    f = int(0.012 * sr); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    y = slow(seg); segs.append(y); info.append((ca, cb, len(y) / SR))
# 타임라인 조립
t = 0.0; slides = []; parts = []
for i, y in enumerate(segs):
    ca, cb, dur_y = info[i]
    start = t; speech_start = start + LEAD[i]                               # 슬라이드 시작 → 오디오 클립 시작
    clip_start = speech_start - (SPEECH[i][0] - ca) / SPEED                  # 클립 앞 패딩 포함 시작 위치
    parts.append((clip_start, y))
    dur = LEAD[i] + (SPEECH[i][1] - SPEECH[i][0]) / SPEED + TAIL[i]
    slides.append(dict(i=i + 1, start=round(start, 3), dur=round(dur, 3), speech_start=round(speech_start, 3), speech_end=round(speech_start + (SPEECH[i][1] - SPEECH[i][0]) / SPEED, 3), orig_a=SPEECH[i][0], orig_b=SPEECH[i][1]))
    t += dur
TOTAL = t; N = int(TOTAL * SR) + 1
out = np.zeros(N, np.float32)
for cs, y in parts:
    i = max(0, int(round(cs * SR))); out[i:i + len(y)] += y[: N - i]
# 라우드니스: 발표용 음성 −16 LUFS, 피크 −1.5 dB 이하
from pedalboard import Pedalboard, Compressor, BrickwallLimiter
m = pyln.Meter(SR)
out = Pedalboard([Compressor(threshold_db=-24, ratio=2.4, attack_ms=8, release_ms=120)])(out[None, :], SR)[0]
for _ in range(4):
    out = pyln.normalize.loudness(out, m.integrated_loudness(out), -16.0)
    out = Pedalboard([BrickwallLimiter(-1.5)])(out[None, :], SR)[0]
sf.write('narration.wav', out, SR, subtype='PCM_16')
# 단어 시각을 영상 시간으로 변환 (슬라이드 첫 단어는 실제 말 시작으로 보정)
def vt(orig):
    for s in slides:
        if s['orig_a'] - 0.01 <= orig <= s['orig_b'] + 0.01: return s['speech_start'] + (orig - s['orig_a']) / SPEED
    return None
wv = []
firsts = {round(a, 2) for a, b in SPEECH}
for w, a, b in words:
    for (sa, sb) in SPEECH:
        if sa - 0.4 <= a <= sb: break
    wv.append([w, a, b])
# 각 구간의 첫 단어는 ASR 시각이 구간 시작에 붙어 있으므로 실제 말 시작으로 맞춘다
seg_first = {}
for si, (sa, sb) in enumerate(SPEECH):
    cand = [k for k, (w, a, b) in enumerate(words) if sa - 0.45 <= a < sb]
    if cand: seg_first[cand[0]] = sa
tl_words = []
for k, (w, a, b) in enumerate(words):
    ao = seg_first.get(k, a)
    # 구간 안에 들어오게 clamp
    for si, (sa, sb) in enumerate(SPEECH):
        if sa - 0.45 <= ao < sb + 0.01: ao = max(ao, sa); v = slides[si]['speech_start'] + (ao - sa) / SPEED; tl_words.append([w, round(v, 3), si + 1]); break
json.dump(dict(speed=SPEED, total=round(TOTAL, 3), slides=slides, words=tl_words), open('timeline.json', 'w'), ensure_ascii=False, indent=1)
print('총 길이 %.2fs (0.9배속 음성 %.2fs)' % (TOTAL, sum(s['speech_end'] - s['speech_start'] for s in slides)))
for s in slides: print(f"슬라이드{s['i']}: {s['start']:.2f} → {s['start']+s['dur']:.2f} ({s['dur']:.2f}s)  말 {s['speech_start']:.2f}–{s['speech_end']:.2f}")
print('LUFS %.1f, 피크 %.2f dBFS' % (m.integrated_loudness(out), 20 * np.log10(np.abs(out).max())))
