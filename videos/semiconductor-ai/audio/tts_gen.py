# 반도체 × AI 나레이션 합성: sherpa-onnx Supertonic-3(남성 sid 6) + Praat 성별 변환 + 마스터링, ASR 일치율로 후보 선택
import sys, json, re, numpy as np, soundfile as sf, sherpa_onnx, parselmouth
from parselmouth.praat import call
from pedalboard import Pedalboard, HighpassFilter, LowShelfFilter, PeakFilter, Compressor, Distortion, BrickwallLimiter
import pyloudnorm as pyln
from scipy.signal import resample_poly
BASE = "/tmp/claude-0/-home-user-claude-development/ec79dd7f-64a6-5940-842b-ccdf63b8e505/scratchpad/voice/models"
TTS_DIR = f"{BASE}/tts/sherpa-onnx-supertonic-3-tts-int8-2026-05-11"
ASR_DIR = f"{BASE}/asr/sherpa-onnx-zipformer-korean-2024-06-24"
# (자막 시작, 자막 끝, 화면 자막, 음성용 문장[숫자·영문을 한글로])
LINES = [
 (0.4, 2.8,  'AI는 어디서 생각할까요?',            '에이아이는 어디서 생각할까요?'),
 (3.0, 5.8,  '바로, 손톱만 한 칩 안입니다.',        '바로, 손톱만 한 칩 안입니다.'),
 (6.3, 9.0,  '칩 속에는 수백억 개의 스위치, 트랜지스터.', '칩 속에는 수백억 개의 스위치, 트랜지스터.'),
 (9.2, 11.8, '켜지면 1, 꺼지면 0. 이 깜빡임이 계산입니다.', '켜지면 일, 꺼지면 영. 이 깜빡임이 계산입니다.'),
 (12.3, 15.2,'AI가 하는 일은 대부분 곱하고 더하기.',  '에이아이가 하는 일은 대부분 곱하고 더하기.'),
 (15.4, 18.7,'이 행렬 곱셈을 1초에 수조 번 반복하죠.', '이 행렬 곱셈을 일 초에 수조 번 반복하죠.'),
 (19.3, 22.0,'그런데 진짜 병목은 계산보다 데이터 이동.', '그런데 진짜 병목은 계산보다 데이터 이동.'),
 (22.2, 24.8,'그래서 메모리를 위로 쌓은 HBM이 중요해졌습니다.', '그래서 메모리를 위로 쌓은 에이치비엠이 중요해졌습니다.'),
 (25.4, 29.6,'AI의 속도는 결국, 반도체의 속도입니다.', '에이아이의 속도는 결국, 반도체의 속도입니다.'),
]
def make_tts(n=4):
    m = sherpa_onnx.OfflineTtsSupertonicModelConfig(
        duration_predictor=f"{TTS_DIR}/duration_predictor.int8.onnx", text_encoder=f"{TTS_DIR}/text_encoder.int8.onnx",
        vector_estimator=f"{TTS_DIR}/vector_estimator.int8.onnx", vocoder=f"{TTS_DIR}/vocoder.int8.onnx",
        tts_json=f"{TTS_DIR}/tts.json", unicode_indexer=f"{TTS_DIR}/unicode_indexer.bin", voice_style=f"{TTS_DIR}/voice.bin")
    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(supertonic=m, num_threads=n, provider="cpu")))
def make_asr(n=4):
    return sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=f"{ASR_DIR}/encoder-epoch-99-avg-1.int8.onnx", decoder=f"{ASR_DIR}/decoder-epoch-99-avg-1.int8.onnx",
        joiner=f"{ASR_DIR}/joiner-epoch-99-avg-1.int8.onnx", tokens=f"{ASR_DIR}/tokens.txt", num_threads=n,
        sample_rate=16000, feature_dim=80, decoding_method="greedy_search", modeling_unit="bpe", bpe_vocab=f"{ASR_DIR}/bpe.model")
def synth(tts, text, sid=6, speed=1.2, steps=12):
    g = sherpa_onnx.GenerationConfig(); g.sid = sid; g.num_steps = steps; g.speed = speed; g.extra["lang"] = "ko"
    a = tts.generate(text, g); return np.asarray(a.samples, np.float32), a.sample_rate
def make_male(x, sr):
    snd = parselmouth.Sound(x.astype(np.float64), sr)
    return np.asarray(call(snd, "Change gender", 75, 300, 0.96, 118, 1.15, 1.0).values[0], np.float32)
def master_voice(x, sr):
    b = Pedalboard([HighpassFilter(70), LowShelfFilter(140, 2.5), PeakFilter(3200, 2, 1), PeakFilter(7000, -3.5, 2),
                    Compressor(threshold_db=-22, ratio=3, attack_ms=5, release_ms=80)])
    y = b(x[None, :], sr)[0]
    y = 0.92 * y + 0.08 * Pedalboard([Distortion(10)])(y[None, :], sr)[0]
    m = pyln.Meter(sr); y = pyln.normalize.loudness(y, m.integrated_loudness(y), -15.8)
    return Pedalboard([BrickwallLimiter(-1.6)])(y[None, :], sr)[0].astype(np.float32)
def transcribe(asr, x, sr):
    y = resample_poly(x, 16000, sr).astype(np.float32) if sr != 16000 else x
    s = asr.create_stream(); s.accept_waveform(16000, y); asr.decode_stream(s); return s.result.text
def norm(t):
    t = t.lower().replace('ai', '에이아이').replace('hbm', '에이치비엠')
    return re.sub(r'[^가-힣a-z0-9]', '', t)
def sim(a, b):
    a, b = norm(a), norm(b); n, m = len(a), len(b)
    d = list(range(m + 1))
    for i in range(1, n + 1):
        p, d[0] = d[0], i
        for j in range(1, m + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return 1 - d[m] / max(n, m, 1)
def trim(x, sr, thr=0.015):
    idx = np.where(np.abs(x) > thr)[0]
    return x[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.08 * sr)] if len(idx) else x
if __name__ == "__main__":
    K = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    tts, asr = make_tts(), make_asr()
    out = []
    for i, (a, b, cap, spk) in enumerate(LINES):
        win = b - a + 0.1          # 자막 구간 + 여유 0.1초 안에 끝나야 함
        speed, best = 1.2, None
        for attempt in range(4):
            cands = []
            for k in range(K):
                x, sr = synth(tts, spk, speed=speed)
                y = trim(master_voice(make_male(x, sr), sr), sr)
                cands.append((sim(spk, transcribe(asr, y, sr)), len(y) / sr, y, sr))
            ok = [c for c in cands if c[1] <= win] or []
            if ok: best = max(ok, key=lambda c: (round(c[0], 2), -c[1])); break
            speed *= max(1.08, (min(c[1] for c in cands) / win) * 1.03)   # 너무 길면 속도 올려 재생성
        if best is None: best = min(cands, key=lambda c: c[1])
        s_, d_, y, sr = best
        sf.write(f"cut{i+1}.wav", y, sr, subtype="PCM_16")
        out.append(dict(i=i + 1, start=a, end=b, dur=round(d_, 2), win=round(win, 2), sim=round(s_, 2), speed=round(speed, 2), text=cap))
        print(f"cut{i+1}  sim={s_:.2f}  {d_:.2f}s / 창 {win:.1f}s  speed={speed:.2f}  {cap}", flush=True)
    json.dump(out, open("voice_meta.json", "w"), ensure_ascii=False, indent=1)
