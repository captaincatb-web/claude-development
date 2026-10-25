# 지구온난화 인포그래픽 BGM·효과음 합성 (numpy). 120 BPM, 1마디=2초, 총 40마디=80초. 장면 경계 = 마디선(10/30/50/70초)
import numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfilt
from pedalboard import Pedalboard, Compressor, BrickwallLimiter, HighpassFilter, LowpassFilter
SR = 44100; DUR = 80.0; N = int(SR * DUR); BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
rng = np.random.default_rng(2026)
mtof = lambda m: 440.0 * 2 ** ((m - 69) / 12)
def add(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf) or i < 0: return
    x = x[: len(buf) - i]; buf[i:i + len(x)] += x * gain
def lp(x, fc, o=2): return sosfilt(butter(o, min(0.95, fc / (SR / 2)), 'low', output='sos'), x)
def hp(x, fc, o=2): return sosfilt(butter(o, fc / (SR / 2), 'high', output='sos'), x)
def bp(x, a, b): return sosfilt(butter(2, [a / (SR / 2), min(0.95, b / (SR / 2))], 'band', output='sos'), x)

# ---------- 악기 ----------
def partials(f, dur, parts, amps, decs, attack=0.003, tail=0.15):
    n = int((dur + tail) * SR); tt = np.arange(n) / SR; x = np.zeros(n)
    for p_, a, d in zip(parts, amps, decs): x += a * np.sin(2 * np.pi * f * p_ * tt) * np.exp(-d * tt)
    x *= np.minimum(1, tt / attack); return x
def pluck(f, dur=0.5): return partials(f, dur, [1, 2, 3, 4, 5, 6], [1, .55, .32, .2, .12, .08], [5, 7, 9, 12, 15, 18], 0.002, 0.2)
def bell(f, dur=1.0): return partials(f, dur, [1, 2.76, 5.4, 8.9], [1, .4, .2, .1], [2.5, 4, 5, 7], 0.002, 0.8)
def marimba(f, dur=0.5): return partials(f, dur, [1, 4, 10], [1, .35, .12], [5, 12, 20], 0.002, 0.2)
def bass(f, dur=0.5):
    n = int((dur + 0.1) * SR); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * tt) + 0.3 * (2 * np.abs(2 * ((tt * f) % 1) - 1) - 1)
    e = np.minimum(1, tt / 0.008) * np.exp(-tt * 2.2); e[-int(0.08 * SR):] *= np.linspace(1, 0, int(0.08 * SR)); return x * e
def pad_note(f, dur):
    n = int((dur + 0.8) * SR); tt = np.arange(n) / SR; x = np.zeros(n)
    for det in (-0.006, 0, 0.006): x += 2 * (((tt * f * (1 + det)) % 1)) - 1
    a = np.minimum(1, tt / 0.45); r = np.clip((dur + 0.8 - tt) / 0.8, 0, 1); return x * a * r / 3
def kick(vol=1.0):
    n = int(0.3 * SR); tt = np.arange(n) / SR; f = 140 * np.exp(-tt * 20) + 48
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 11) * vol
def clap(vol=1.0):
    n = int(0.22 * SR); tt = np.arange(n) / SR; nz = bp(rng.standard_normal(n), 900, 3800)
    e = np.exp(-tt * 28) + 0.6 * np.exp(-((tt - 0.012) ** 2) / 2e-5) + 0.5 * np.exp(-((tt - 0.026) ** 2) / 2e-5); return nz * e * vol
def hat(vol=1.0, dec=70):
    n = int(0.09 * SR); tt = np.arange(n) / SR; return hp(rng.standard_normal(n), 7000) * np.exp(-tt * dec) * vol
def shaker(vol=1.0):
    n = int(0.12 * SR); tt = np.arange(n) / SR; return bp(rng.standard_normal(n), 4500, 9000) * np.exp(-tt * 40) * np.minimum(1, tt / 0.01) * vol
def crash(vol=1.0, dur=2.6):
    n = int(dur * SR); tt = np.arange(n) / SR; return hp(rng.standard_normal(n), 3500) * np.exp(-tt * 1.8) * vol
def riser(dur, vol=1.0):
    n = int(dur * SR); x = rng.standard_normal(n); out = np.zeros(n); blk = 1024
    for i in range(0, n, blk):
        k = i / n; fc = 400 + 7000 * k ** 2; out[i:i + blk] = lp(x[i:i + blk], fc, 1) if False else x[i:i + blk]
    y = bp(x, 600, 7000) * (np.linspace(0, 1, n) ** 2.2); return y * vol
def whoosh(dur=0.9, vol=1.0, up=True):
    n = int(dur * SR); x = rng.standard_normal(n); out = np.zeros(n); blk = 1024
    for i in range(0, n, blk):
        k = i / n; fc = 300 + 4800 * (k if up else 1 - k); out[i:i + blk] = lp(x[i:i + blk], fc, 2)
    return out * np.sin(np.pi * np.linspace(0, 1, n)) ** 1.4 * vol
def pop(f=900, vol=1.0):
    n = int(0.12 * SR); tt = np.arange(n) / SR; ff = f * (1 + 1.5 * np.exp(-tt * 40)); return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-tt * 35) * vol
def tick(f=1800, vol=1.0):
    n = int(0.05 * SR); tt = np.arange(n) / SR; return np.sin(2 * np.pi * f * tt) * np.exp(-tt * 80) * vol
def ding(f=1320, vol=1.0): return partials(f, 0.5, [1, 2.01, 3.02], [1, .4, .15], [5, 7, 10], 0.002, 0.6) * vol

# ---------- 곡 구조 ----------
CH = {'C': (48, [60, 64, 67, 72]), 'G': (43, [59, 62, 67, 71]), 'Am': (45, [57, 60, 64, 69]), 'F': (41, [57, 60, 65, 69]), 'Dm': (50, [57, 62, 65, 69])}
PROG = (['C', 'G', 'Am', 'F', 'C'] +                       # S1  (bar 0-4)
        ['C', 'G', 'Am', 'F'] * 2 + ['C', 'G'] +           # S2  (bar 5-14)
        ['Am', 'F', 'Dm', 'G'] * 2 + ['Am', 'G'] +         # S3  (bar 15-24)
        ['C', 'G', 'Am', 'F'] * 2 + ['C', 'G'] +           # S4  (bar 25-34)
        ['F', 'G', 'C', 'C', 'C'])                         # S5  (bar 35-39)
assert len(PROG) == 40
sec = lambda b: 0 if b < 5 else 1 if b < 15 else 2 if b < 25 else 3 if b < 35 else 4
MOTIF = {'C': [(0, 76, .75), (.75, 79, .25), (1, 76, 1), (2, 74, .5), (2.5, 72, .5), (3, 74, 1)], 'G': [(0, 74, .75), (.75, 79, .25), (1, 74, 1), (2, 71, .5), (2.5, 74, .5), (3, 79, 1)],
         'Am': [(0, 72, .75), (.75, 76, .25), (1, 81, 1), (2, 79, .5), (2.5, 76, .5), (3, 72, 1)], 'F': [(0, 77, .75), (.75, 81, .25), (1, 77, 1), (2, 76, .5), (2.5, 74, .5), (3, 72, 1)]}
SLOW = {'Am': [(0, 69, 2), (2, 72, 2)], 'F': [(0, 72, 2), (2, 69, 2)], 'Dm': [(0, 74, 2), (2, 77, 2)], 'G': [(0, 71, 2), (2, 74, 2)]}
tracks = {k: np.zeros(N) for k in ['pad', 'bass', 'uke', 'lead', 'bell', 'drum', 'sfx']}
pent = [72, 74, 76, 79, 81, 84, 86, 88]
for b in range(40):
    t0 = b * BAR; ch = PROG[b]; root, tones = CH[ch]; s = sec(b)
    # 패드
    padg = [0.55, 0.22, 0.4, 0.2, 0.55][s]
    for m in tones[:3] + [tones[0] + 12 if s in (0, 4) else tones[0]]: add(tracks['pad'], pad_note(mtof(m), BAR + 0.05), t0, padg * 0.09)
    # 베이스
    if s in (1, 3, 4) or (s == 0 and b >= 3):
        for k in ((0, 2) if s != 4 or b < 38 else (0,)): add(tracks['bass'], bass(mtof(root), 1.6 if s == 0 else 0.9), t0 + k * BEAT, 0.34)
        if s in (3, 4): add(tracks['bass'], bass(mtof(root + 12), 0.4), t0 + 2.5 * BEAT, 0.16)
    if s == 2:
        for k in range(8): add(tracks['bass'], bass(mtof(root), 0.3), t0 + k * BEAT / 2, 0.16 if k % 2 == 0 else 0.1)
    # 우쿨렐레 스트럼
    if s in (1, 3, 4) and not (s == 4 and b >= 38):
        for pos in ([0, 1, 1.5, 2.5, 3] if s != 0 else []):
            for j, m in enumerate(tones): add(tracks['uke'], pluck(mtof(m + (12 if m < 58 else 0)), 0.35), t0 + pos * BEAT + j * 0.018, 0.07 if s != 3 else 0.085)
    if s == 2:
        for j, m in enumerate(tones[:3]): add(tracks['uke'], pluck(mtof(m), 0.9), t0 + 0.0 + j * 0.03, 0.06)
    # 멜로디
    if s in (1, 3) and ch in MOTIF and b not in (14, 34):
        sh = 12 if s == 3 else 0
        for (pb, m, d) in MOTIF[ch]: add(tracks['lead'], marimba(mtof(m + sh * 0), d * BEAT), t0 + pb * BEAT, 0.20 if s == 1 else 0.24)
        if s == 3:
            for (pb, m, d) in MOTIF[ch]: add(tracks['lead'], bell(mtof(m + 12), d * BEAT), t0 + pb * BEAT, 0.05)
    if s == 2:
        for (pb, m, d) in SLOW[ch]: add(tracks['bell'], bell(mtof(m + 12 * (b % 2)), d * BEAT * 1.0), t0 + pb * BEAT, 0.13)
    if s == 4 and b < 38:
        mm = {'F': [(0, 81, 1), (1, 79, 1), (2, 77, 2)], 'G': [(0, 79, 1), (1, 83, 1), (2, 86, 2)], 'C': [(0, 84, 1.5), (1.5, 79, .5), (2, 76, 2)]}[ch]
        for (pb, m, d) in mm: add(tracks['lead'], marimba(mtof(m), d * BEAT), t0 + pb * BEAT, 0.24); add(tracks['bell'], bell(mtof(m + 12), d * BEAT), t0 + pb * BEAT, 0.09)
    # 도입: 반짝이 벨
    if s == 0:
        for k in range(6):
            if rng.random() < 0.8: add(tracks['bell'], bell(mtof(pent[rng.integers(0, 8)]), 1.2), t0 + k * BEAT * 0.66 + rng.random() * 0.15, 0.10)
    # 드럼
    for beat in range(4):
        tb = t0 + beat * BEAT
        if s == 1:
            if beat in (0, 2): add(tracks['drum'], kick(), tb, 0.55)
            if beat in (1, 3): add(tracks['drum'], clap(), tb, 0.16)
            for h in (0, .5): add(tracks['drum'], hat(1, 90), tb + h * BEAT, 0.06 if h == 0 else 0.04)
        elif s == 2:
            if beat == 0: add(tracks['drum'], kick(), tb, 0.38)
            if beat in (1, 3): add(tracks['drum'], tick(900, 1), tb, 0.08)
            add(tracks['drum'], shaker(), tb + BEAT / 2, 0.05)
        elif s == 3:
            add(tracks['drum'], kick(), tb, 0.6)
            if beat in (1, 3): add(tracks['drum'], clap(), tb, 0.22)
            for h in (0, .25, .5, .75): add(tracks['drum'], hat(1, 90 if h else 60), tb + h * BEAT, 0.07 if h in (0, .5) else 0.04)
        elif s == 4 and b < 38:
            add(tracks['drum'], kick(), tb, 0.62)
            if beat in (1, 3): add(tracks['drum'], clap(), tb, 0.24)
            for h in (0, .25, .5, .75): add(tracks['drum'], hat(1, 90), tb + h * BEAT, 0.07 if h in (0, .5) else 0.04)
# 마무리: 아르페지오 상승 + 마지막 코드 울림
for k, m in enumerate([72, 76, 79, 84, 88]): add(tracks['bell'], bell(mtof(m), 1.5), 38 * BAR + k * BEAT * 0.5, 0.16)
for m in [60, 64, 67, 72, 76, 79]: add(tracks['pad'], pad_note(mtof(m), 3.6), 39 * BAR, 0.085); add(tracks['bell'], bell(mtof(m + 12), 3.0), 39 * BAR, 0.07)
add(tracks['bass'], bass(mtof(36), 3.0), 39 * BAR, 0.4); add(tracks['uke'], pluck(mtof(72), 1.0), 39 * BAR, 0.1)
# 섹션 경계: 라이저 + 크래시
for bt in (10, 30, 50, 70):
    add(tracks['sfx'], riser(1.6, 1.0), bt - 1.6, 0.16)
    add(tracks['sfx'], crash(1.0, 1.6 if bt != 70 else 3.2), bt, 0.16 if bt != 70 else 0.26)
    add(tracks['sfx'], whoosh(0.9, 1.0, True), bt - 0.15, 0.3)
add(tracks['sfx'], riser(4.0, 1.0), 46.0, 0.14)                # 원인 장면 후반 긴장 상승
# ---------- 장면 효과음 (화면 이벤트 시각) ----------
S = tracks['sfx']
add(S, pop(700, 1), 0.9, 0.3); add(S, whoosh(0.9, 1, True), 0.5, 0.25)           # 지구 등장
for k in range(10): add(S, tick(1100 + k * 90, 1), 2.8 + k * 0.5, 0.07)          # 온도계 눈금 오르는 소리
add(S, ding(1568, 1), 3.9, 0.22)                                                  # 제목 등장
for k in range(24): add(S, tick(1300 + k * 25, 1), 13.4 + k * 0.125, 0.08)       # 1979 카운트업
for k in range(30): add(S, tick(1400 + k * 28, 1), 17.6 + k * 0.12, 0.08)        # 2025 카운트업
add(S, ding(1760, 1), 16.5, 0.2); add(S, pop(600, 1), 17.4, 0.25)
add(S, pop(800, 1), 22.1, 0.35); add(S, ding(1976, 1), 22.2, 0.2)                # +88.77 말풍선
add(S, pop(900, 1), 23.7, 0.3); add(S, ding(2093, 1), 23.8, 0.16)                # 26% 말풍선
for i, d in enumerate((31.6, 32.0, 32.4)): add(S, pop(500 + i * 120, 1), d, 0.3)  # 배출원 3곳
for k in range(14): add(S, tick(500 + (k % 4) * 40, 1), 38.6 + k * 0.4, 0.05)    # 쌓이는 CO2 박동
add(S, pop(1000, 1), 40.6, 0.3); add(S, ding(1318, 1), 42.8, 0.22)               # 태양 / 온실효과 칩
for k in range(18): add(S, tick(700 + k * 70, 1), 44.2 + k * 0.28, 0.06)         # 기온 상승
for i in range(5): add(S, pop(600 + i * 110, 1), 51.8 + i * 0.5, 0.3)             # 카드 등장
for i in range(5): add(S, ding(1047 * 2 ** (i * 2 / 12), 1), 54.8 + i * 2.5, 0.2)  # 카드 강조 차임(점점 높게)
add(S, whoosh(1.0, 1, True), 70.0, 0.2)
for k, m in enumerate([84, 88, 91, 96]): add(S, ding(mtof(m), 1), 70.9 + k * 0.12, 0.18)  # 메시지 등장 반짝
add(S, ding(2093, 1), 72.9, 0.2)
for k in range(10): add(S, ding(mtof(pent[k % 8] + 12), 1), 73.5 + k * 0.45, 0.05)  # 색종이 반짝

# ---------- 믹스 ----------
lv = {'pad': 1.0, 'bass': 0.9, 'uke': 1.0, 'lead': 0.95, 'bell': 0.9, 'drum': 1.0, 'sfx': 1.0}
t = np.arange(N) / SR
padb = lp(tracks['pad'], 1500, 2)
# 킥 덕킹: 킥 위치에서 패드·베이스 살짝 눌림
duck = np.ones(N)
for b in range(40):
    if sec(b) in (1, 3, 4):
        for beat in (0, 2):
            i = int((b * BAR + beat * BEAT) * SR); L = int(0.25 * SR); duck[i:i + L] *= 1 - 0.25 * np.exp(-np.arange(min(L, N - i)) / SR * 14)
mix = padb * duck * lv['pad'] + tracks['bass'] * duck * lv['bass'] + tracks['uke'] * lv['uke'] + tracks['lead'] * lv['lead'] + tracks['bell'] * lv['bell'] + tracks['drum'] * lv['drum'] + tracks['sfx'] * lv['sfx']
# 다이내믹 곡선: 도입은 작게 → 본문 → 마무리가 가장 크게
env = np.interp(t, [0, 9, 11, 69, 71, 80], [0.62, 0.7, 1.0, 1.0, 1.22, 1.22]); mix *= env
# 도입 페이드인, 엔딩 페이드아웃
fade = np.ones(N); fade[:int(0.4 * SR)] = np.linspace(0, 1, int(0.4 * SR)); fade[-int(1.6 * SR):] = np.linspace(1, 0, int(1.6 * SR)); mix *= fade
mix = Pedalboard([HighpassFilter(35), Compressor(threshold_db=-20, ratio=2.2, attack_ms=12, release_ms=160)])(mix[None, :].astype(np.float32), SR)[0]
m_ = pyln.Meter(SR)
for _ in range(3):
    mix = pyln.normalize.loudness(mix, m_.integrated_loudness(mix), -14.0); mix = Pedalboard([BrickwallLimiter(-2.4)])(mix[None, :], SR)[0]
sf.write('bgm.wav', mix.astype(np.float32), SR, subtype='PCM_16')
print('LUFS %.1f peak %.2f dBFS' % (m_.integrated_loudness(mix), 20 * np.log10(np.abs(mix).max())))
# 구간별 에너지(대략적인 편성 확인)
for a, b, nm in [(0, 10, '도입'), (10, 30, '데이터'), (30, 50, '원인'), (50, 70, '해결'), (70, 80, '마무리')]:
    seg = mix[int(a * SR):int(b * SR)]; print(nm, 'RMS %.1f dB' % (20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9)))
