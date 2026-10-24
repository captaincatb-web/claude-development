import sys, json, soundfile as sf
sys.path.insert(0, '.')
from tts_gen import *
idx = [int(x) for x in sys.argv[1].split(',')]; K = int(sys.argv[2])
tts, asr = make_tts(), make_asr()
meta = json.load(open('voice_meta.json'))
for i in idx:
    a, b, cap, spk = LINES[i - 1]; win = b - a + 0.1; cands = []
    for sp in (1.1, 1.2, 1.3):
        for k in range(K // 3 + 1):
            x, sr = synth(tts, spk, speed=sp)
            y = trim(master_voice(make_male(x, sr), sr), sr)
            cands.append((sim(spk, transcribe(asr, y, sr)), len(y) / sr, y, sr, sp))
    ok = [c for c in cands if c[1] <= win]
    s_, d_, y, sr, sp = max(ok, key=lambda c: (round(c[0], 2), -c[1]))
    sf.write(f'cut{i}.wav', y, sr, subtype='PCM_16')
    m = meta[i - 1]; m.update(sim=round(s_, 2), dur=round(d_, 2), speed=sp)
    print(f'cut{i} sim={s_:.2f} {d_:.2f}s speed={sp}', flush=True)
json.dump(meta, open('voice_meta.json', 'w'), ensure_ascii=False, indent=1)
