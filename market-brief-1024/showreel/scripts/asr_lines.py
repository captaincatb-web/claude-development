"""Print ASR transcript per dialogue line from out/<ep>_voice.wav (for manual pronunciation review)."""
import json, sys, os, glob, wave
import numpy as np, sherpa_onnx
ep = sys.argv[1]; root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.environ['ASR_MODEL']
f = lambda p, i8=True: sorted([x for x in glob.glob(f'{A}/{p}') if ('int8' in x) == i8] or glob.glob(f'{A}/{p}'))[0]
rec = sherpa_onnx.OnlineRecognizer.from_transducer(tokens=f'{A}/tokens.txt', encoder=f('encoder*.onnx'), decoder=f('decoder*.onnx', False), joiner=f('joiner*.onnx'), num_threads=2, sample_rate=16000, feature_dim=80)
w = wave.open(f'{root}/out/{ep}_voice.wav'); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
d = json.load(open(f'{root}/src/shorts/data/{ep}.json'))
for i, l in enumerate(d['lines']):
    seg = x[int(l['start'] * sr):int(l['end'] * sr)]
    t16 = np.interp(np.linspace(0, len(seg) - 1, int(len(seg) * 16000 / sr)), np.arange(len(seg)), seg).astype(np.float32)
    st = rec.create_stream(); st.accept_waveform(16000, t16); st.accept_waveform(16000, np.zeros(8000, np.float32)); st.input_finished()
    while rec.is_ready(st): rec.decode_stream(st)
    print(i, l['spk'], '|', l['text'], '=>', rec.get_result(st))
