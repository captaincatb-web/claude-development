# BGM·효과음 합성(numpy) + 나레이션 배치 + 덕킹 + 마스터링 → final_audio.wav
# 화면 이벤트 시각은 semiconductor-ai.html의 비트와 맞춘다.
import json, numpy as np, soundfile as sf, pyloudnorm as pyln
from pedalboard import Pedalboard, Compressor, BrickwallLimiter, HighpassFilter, LowpassFilter
from scipy.signal import resample_poly, butter, sosfilt

SR = 44100
DUR = 30.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
BPM = 104
BEAT = 60 / BPM
meta = json.load(open("voice_meta.json"))

def env(n, a=0.01, d=0.2, s=0.0, r=0.1, hold=0.0):
    e = np.zeros(n); na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    nh = max(0, n - na - nd - nr)
    e[:na] = np.linspace(0, 1, na, endpoint=False)
    e[na:na + nd] = np.linspace(1, s, nd, endpoint=False)
    e[na + nd:na + nd + nh] = s
    e[n - nr:] = np.linspace(s, 0, nr) if nr else 0
    return e
def add(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf): return
    x = x[: len(buf) - i]; buf[i:i + len(x)] += x * gain
def tone(f, dur, wave="saw", a=0.01, r=0.15, s=0.7):
    n = int(dur * SR); tt = np.arange(n) / SR
    if wave == "saw": x = 2 * ((tt * f) % 1) - 1
    elif wave == "sq": x = np.sign(np.sin(2 * np.pi * f * tt))
    else: x = np.sin(2 * np.pi * f * tt)
    sos = butter(2, min(3200, f * 4) / (SR / 2), "low", output="sos")
    return sosfilt(sos, x) * env(n, a, 0.05, s, r)

# ---- 코드 진행 (Am – F – C – G, 한 마디 = 4박) ----
notes = {"A2": 110.0, "F2": 87.31, "C3": 130.81, "G2": 98.0,
         "A3": 220.0, "C4": 261.63, "E4": 329.63, "F3": 174.61, "A4": 440.0, "G3": 196.0, "B3": 246.94, "D4": 293.66, "E3": 164.81, "G4": 392.0}
chords = [("A2", ["A3", "C4", "E4"]), ("F2", ["F3", "A3", "C4"]), ("C3", ["C4", "E4", "G4"]), ("G2", ["G3", "B3", "D4"])]
bgm = np.zeros(N)
bar = BEAT * 4
# 긴장 구간: 칩 줌 스루 이후 ~ 병목(WAITING) 끝 / 해소: HBM 개통(약 22.3초부터)
TENSION = (17.0, 22.3)
RELEASE = 22.3
IMPACT = 25.0        # 결론 화면 등장
nb = int(DUR / bar) + 1
for b in range(nb):
    t0 = b * bar
    root, ch = chords[b % 4]
    # pad
    for nm in ch:
        d = tone(notes[nm], bar * 1.02, "saw", a=0.4, r=0.5, s=0.8)
        add(bgm, d, t0, 0.055)
    # bass: 1·3박
    for k in (0, 2):
        add(bgm, tone(notes[root], BEAT * 1.6, "sine", a=0.01, r=0.2, s=0.9), t0 + k * BEAT, 0.28)
    # pluck 아르페지오 (8분음표)
    arp = [ch[0], ch[1], ch[2], ch[1], ch[2], ch[1], ch[0], ch[1]]
    tens = TENSION[0] <= t0 < TENSION[1]
    step = BEAT / (4 if tens else 2)
    cnt = 16 if tens else 8
    for k in range(cnt):
        nm = arp[k % 8]
        f = notes[nm] * (2 if (k % 8) >= 4 else 1)
        add(bgm, tone(f, step * 1.4, "sq", a=0.003, r=step * 0.9, s=0.35), t0 + k * step, 0.035 if not tens else 0.042)
    # 킥: 해소 이후 매 박, 평소엔 1·3박
    kicks = range(4) if t0 >= RELEASE else (0, 2)
    for k in kicks:
        n = int(0.25 * SR); tt = np.arange(n) / SR
        f = 120 * np.exp(-tt * 18) + 45
        kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 12)
        add(bgm, kick, t0 + k * BEAT, 0.5 if t0 >= RELEASE else 0.3)
    # 하이햇
    for k in range(8):
        n = int(0.05 * SR); h = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 90)
        sos = butter(2, 7000 / (SR / 2), "high", output="sos")
        add(bgm, sosfilt(sos, h), t0 + k * BEAT / 2, 0.05 if t0 < 6 else 0.08)
# 긴장 드론 + 노이즈 라이저
m = (t >= TENSION[0]) & (t < TENSION[1])
rise = np.clip((t - TENSION[0]) / (TENSION[1] - TENSION[0]), 0, 1)
sos = butter(2, [300 / (SR / 2), 4000 / (SR / 2)], "band", output="sos")
bgm += sosfilt(sos, rng.standard_normal(N)) * (rise ** 2) * m * 0.05
bgm += np.sin(2 * np.pi * 55 * t) * m * (0.03 + 0.05 * rise)
# 임팩트 직전 BGM 잠깐 끊기(24.7~25.0) 후 임팩트
cut = np.ones(N); i0, i1 = int(24.72 * SR), int(25.0 * SR)
cut[i0:i1] = np.linspace(1, 0.1, i1 - i0)
bgm *= cut
# 도입 페이드
bgm *= np.clip(t / 1.2, 0, 1)

# ---- 효과음 (화면 이벤트 시각) ----
sfx = np.zeros(N)
def whoosh(at, dur=0.5, up=True, gain=0.5):
    n = int(dur * SR); noise = rng.standard_normal(n)
    out = np.zeros(n); blk = 512
    for i in range(0, n, blk):
        k = i / n; fc = (300 + 5000 * (k if up else 1 - k)) / (SR / 2)
        sos = butter(2, min(0.95, fc), "low", output="sos"); out[i:i + blk] = sosfilt(sos, noise[i:i + blk])
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 1.5
    add(sfx, out * e, at, gain)
def tick(at, f=1800, gain=0.22):
    n = int(0.05 * SR); tt = np.arange(n) / SR
    add(sfx, np.sin(2 * np.pi * f * tt) * np.exp(-tt * 70), at, gain)
def thud(at, gain=0.7):
    n = int(0.6 * SR); tt = np.arange(n) / SR
    f = 90 * np.exp(-tt * 9) + 38
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 6)
    x += rng.standard_normal(n) * np.exp(-tt * 40) * 0.25
    add(sfx, x, at, gain)
def ding(at, f=1320, gain=0.2):
    n = int(0.7 * SR); tt = np.arange(n) / SR
    add(sfx, (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.exp(-tt * 6), at, gain)

tick(0.9, 1500, 0.2)                    # 라임 점 등장
whoosh(1.0, 1.0, True, 0.35)           # 점 → 칩으로 커짐
thud(2.0, 0.35)                         # 칩 안착
whoosh(5.0, 1.1, True, 0.6)            # 다이 속 줌 스루
for k in range(14): tick(7.4 + k * 0.22, 1400 + (k % 4) * 250, 0.07)  # 트랜지스터 깜빡임
ding(8.6, 1760, 0.2)                    # 콜아웃 등장
for k in range(3): tick(13.0 + k * 0.42, 1200 + k * 200, 0.2)         # 곱하기 항 3개 등장
ding(16.0, 1568, 0.26)                  # 첫 칸 = 4
for k in range(8): tick(16.8 + k * 0.16, 1000 + k * 90, 0.12)          # 나머지 8칸 채워짐
for k in range(10): tick(19.8 + k * 0.28, 520, 0.14)                   # 병목 WAITING 경고 박동
whoosh(22.2, 0.9, True, 0.5)           # HBM 층 펼침 → 길 개통
ding(22.9, 1976, 0.22)
thud(25.0, 0.95)                        # 결론 임팩트
whoosh(26.5, 0.5, True, 0.12)          # 형광펜 지나감
ding(27.0, 1568, 0.10)

# ---- 나레이션 배치 ----
voice = np.zeros(N); vmask = np.zeros(N)
for m_ in meta:
    y, sr = sf.read(f"cut{m_['i']}.wav", dtype="float32")
    if sr != SR: y = resample_poly(y, SR, sr).astype(np.float32)
    at = m_["start"] + 0.04
    add(voice, y, at, 1.0)
    a, b = int((at - 0.12) * SR), int((at + len(y) / SR + 0.18) * SR)
    vmask[max(0, a):b] = 1.0

# ---- 덕킹: 말하는 구간 배경을 −11dB 안팎으로, 0.12초 포락선 ----
from scipy.ndimage import uniform_filter1d
duck = 1 - 0.76 * uniform_filter1d(vmask, int(0.12 * SR))
bg = (bgm + sfx * 0.9) * duck
bg *= 10 ** (0.0 / 20)        # 음악·효과음 전체 레벨(음성 대비 여유)
mix = voice * 1.0 + bg
# 직접 측정: 컷별 음성 대비 배경(덕킹 후) RMS 비율
worst = 99
for m_ in meta:
    a = int((m_['start'] + 0.04) * SR); b = a + int(m_['dur'] * SR)
    r = 10 * np.log10((np.mean(voice[a:b] ** 2) + 1e-12) / (np.mean(bg[a:b] ** 2) + 1e-12)); worst = min(worst, r)
    print('cut%d 음성 대비 배경 %.1f dB' % (m_['i'], r))
print('최악 %.1f dB' % worst)

# ---- 마스터링 ----
mix = Pedalboard([HighpassFilter(40), Compressor(threshold_db=-24, ratio=2.6, attack_ms=8, release_ms=120)])(mix[None, :].astype(np.float32), SR)[0]
meter = pyln.Meter(SR)
for _ in range(3):
    mix = pyln.normalize.loudness(mix, meter.integrated_loudness(mix), -14.0)
    mix = Pedalboard([BrickwallLimiter(-2.4)])(mix[None, :], SR)[0]
fade = np.ones(N); fade[: int(0.3 * SR)] = np.linspace(0, 1, int(0.3 * SR)); fade[-int(0.9 * SR):] = np.linspace(1, 0, int(0.9 * SR))
mix *= fade
sf.write("final_audio.wav", mix.astype(np.float32), SR, subtype="PCM_16")
sf.write("voice_full.wav", voice / max(1e-9, np.abs(voice).max()) * 0.9, SR, subtype="PCM_16")
print("done", "LUFS %.1f" % meter.integrated_loudness(mix), "peak %.2f dBFS" % (20 * np.log10(np.abs(mix).max())))
