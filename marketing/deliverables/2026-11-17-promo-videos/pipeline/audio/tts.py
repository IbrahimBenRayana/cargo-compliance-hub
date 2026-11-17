"""Voiceover with Kokoro-82M (Apache-2.0) and misaki G2P, fully local.

    python -I tts.py VOICE SPEED OUTDIR
"""
import json
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro
from misaki import en

here = Path(__file__).parent
model = here.parent / ".work" / "tts"
voice, speed, out = sys.argv[1], float(sys.argv[2]), Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
k = Kokoro(str(model / "kokoro-v1.0.onnx"), str(model / "voices-v1.0.bin"))
g2p = en.G2P(trf=False, british=voice.startswith("b"), fallback=None)
# how the product words are said
SAY = {"MyCargoLens": "My Cargo Lens", "mycargolens": "my cargo lens", "ISF-10": "I.S.F. ten", "ISFs": "I.S.F.s", "ISF": "I.S.F.", "HTS": "H.T.S.", "US customs": "U.S. customs"}
meta = []
for line in json.loads((here / "vo_lines.json").read_text()):
    text = line["text"]
    for word, said in SAY.items():
        text = text.replace(word, said)
    phonemes, _ = g2p(text)
    assert "❓" not in phonemes, (line["id"], phonemes)
    samples, rate = k.create(phonemes, voice=voice, speed=speed, is_phonemes=True)
    sf.write(out / f"{line['id']}.wav", samples, rate)
    meta.append({"id": line["id"], "seconds": round(len(samples) / rate, 2), "phonemes": phonemes})
    print(line["id"], meta[-1]["seconds"], phonemes)
(out / "durations.json").write_text(json.dumps(meta, indent=1))
