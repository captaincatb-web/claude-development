# Synthesize BGM + SFX from code, duck under the voice, master. usage: python3 mix.py <project dir>
import sys, json, numpy as np, soundfile as sf, pyloudnorm as pyln
from pedalboard import Pedalboard, Compressor, Limiter, LowpassFilter, HighpassFilter, Gain
P = sys.argv[1]; SR = 44100
voice, sr = sf.read(f'{P}/build/voice.wav', dtype='float32'); assert sr == SR
tl = json.load(open(f'{P}/build/timeline.json')); N = len(voice); T = np.arange(N) / SR
rng = np.random.default_rng(7)
midi = lambda m: 440 * 2 ** ((m - 69) / 12)

def env(n, a, r):
    e = np.ones(n, np.float32); ka, kr = int(a * SR), int(r * SR)
    e[:ka] = np.linspace(0, 1, ka); e[-kr:] *= np.linspace(1, 0, kr); return e

# --- BGM: tension (minor) until the export cut, then resolution (brighter voicing) ---
bpm = 96; beat = 60 / bpm; bar = 4 * beat
resolve_t = next(c['start'] for c in tl['cuts'] if c['id'] == 'export') - .3
tense = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]]      # Am F G E
bright = [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]]     # C G Am F
pad = np.zeros(N, np.float32); pluck = np.zeros(N, np.float32); bass = np.zeros(N, np.float32)
nb = int(np.ceil(N / SR / bar))
for b in range(nb):
    t0 = b * bar; prog = bright if t0 >= resolve_t else tense; ch = prog[b % 4]
    i0, n = int(t0 * SR), int(bar * SR); i1 = min(i0 + n, N); tt = np.arange(i1 - i0) / SR
    e = env(n, .4, .5)[:i1 - i0]
    for m in ch:
        for det in (-.08, .08):
            ph = 2 * np.pi * midi(m + 12) * (1 + det / 100) * tt
            pad[i0:i1] += e * (np.sin(ph) + .3 * np.sin(2 * ph) + .12 * np.sin(3 * ph)) * .05
    bass[i0:i1] += e * (np.sin(2 * np.pi * midi(ch[0] - 12) * tt) * .32)
    for k in range(8):  # 8th-note arpeggio pluck
        s = int((t0 + k * beat / 2) * SR); L = int(.35 * SR)
        if s >= N: break
        L = min(L, N - s); tk = np.arange(L) / SR; m = ch[[0, 1, 2, 1][k % 4]] + 24
        pluck[s:s + L] += np.sin(2 * np.pi * midi(m) * tk) * np.exp(-tk * 14) * .16
pad = Pedalboard([LowpassFilter(2200)])(pad[None], SR)[0]
music = pad + pluck + bass

# --- SFX: whoosh at cut changes, tick on highlighted words, thud on red drops ---
sfx = np.zeros(N, np.float32)
def put(sig, t):
    i = int(t * SR)
    if 0 <= i < N: L = min(len(sig), N - i); sfx[i:i + L] += sig[:L]
L = int(.4 * SR); tk = np.arange(L) / SR
noise = rng.standard_normal(L).astype(np.float32)
whoosh = Pedalboard([HighpassFilter(400), LowpassFilter(5000)])(noise[None], SR)[0] * np.sin(np.pi * tk / .4) ** 2 * .22
tick = (np.sin(2 * np.pi * 2400 * tk) * np.exp(-tk * 60) * .25).astype(np.float32)
thud = (np.sin(2 * np.pi * (55 + 60 * np.exp(-tk * 25)) * tk) * np.exp(-tk * 9) * .6).astype(np.float32)
DROPS = {'hook', 'spx', 'bigtech', 'sox', 'kospi'}
for c in tl['cuts']:
    put(whoosh, c['start'] - .3)
    for s in c['segs']:
        if '*' in s['text']:
            put(thud if (c['id'] in DROPS and '-' in s['text']) else tick, s['t'])

# --- ducking: background follows the inverse of the voice envelope ---
def rms_env(x, win=.05):
    k = int(win * SR); return np.sqrt(np.convolve(x ** 2, np.ones(k) / k, 'same') + 1e-12)
ve = rms_env(voice); active = (ve > 10 ** (-38 / 20)).astype(np.float32)
# smooth gate: fast attack, slow release
g = np.zeros(N, np.float32); a, r = 1 - np.exp(-1 / (.03 * SR)), 1 - np.exp(-1 / (.30 * SR)); y = 0.
for i in range(0, N, 32):  # control-rate loop
    tgt = active[i]; y += ((a if tgt > y else r) * 32) * (tgt - y); y = min(max(y, 0), 1); g[i:i + 32] = y
def bed(level_db, duck_db):
    gain = 10 ** ((level_db - duck_db * g) / 20)
    return (music + sfx) * gain
def worst_gap(b):
    w = int(.4 * SR); gaps = []
    for i in range(0, N - w, w // 2):
        if active[i:i + w].mean() > .8:
            v = 20 * np.log10(np.sqrt((voice[i:i + w] ** 2).mean()) + 1e-9); m = 20 * np.log10(np.sqrt((b[i:i + w] ** 2).mean()) + 1e-9)
            gaps.append(v - m)
    return min(gaps), float(np.median(gaps))
level = -8.0
while True:
    b = bed(level, 12); wg, med = worst_gap(b)
    if wg >= 14 or level < -30: break
    level -= .5
mix = voice + b
# --- master ---
meter = pyln.Meter(SR); lufs = meter.integrated_loudness(mix)
# JUCE limiter adds makeup gain up to 0 dBFS, so follow it with Gain(-CEIL) to set the ceiling
CEIL, LIM = 2.4, 4.0
def master(x, target):
    x = x * 10 ** ((target - LIM + CEIL - meter.integrated_loudness(x)) / 20)
    return Pedalboard([Compressor(threshold_db=-18, ratio=2, attack_ms=10, release_ms=120),
                       Limiter(threshold_db=-LIM, release_ms=80), Gain(-CEIL)])(x[None], SR)[0]
TGT = -17.5  # mono; dual-mono stereo reads ~3 dB louder (-14.5 LUFS)
m = master(mix, TGT); m = master(mix, TGT + (TGT - meter.integrated_loudness(m))); mix = m
fade = np.ones(N, np.float32); k = int(.4 * SR); fade[:k] = np.linspace(0, 1, k); fade[-int(.6 * SR):] = np.linspace(1, 0, int(.6 * SR))
mix *= fade
st = np.stack([mix, mix], 1)
sf.write(f'{P}/build/mix.wav', st, SR, subtype='PCM_24')
print(json.dumps(dict(bed_level_db=level, voice_minus_bed_worst_db=round(float(wg), 1), median_db=round(float(med), 1),
                      lufs_premaster=round(meter.integrated_loudness(st), 2), peak_db=round(float(20 * np.log10(np.abs(mix).max())), 2))))
