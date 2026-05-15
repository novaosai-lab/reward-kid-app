#!/usr/bin/env python3
"""Nova Voice CLI powered by OmniVoice.

Usage:
  ./nova_voice.py "สวัสดีค่ะพี่นิค Nova พร้อมช่วยแล้วค่ะ"
  ./nova_voice.py --instruct "female, warm, low pitch" --output output/test.wav "Hello"
"""
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import re
import sys

import soundfile as sf
import torch
from omnivoice import OmniVoice

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "output"
MODEL_ID = "k2-fsa/OmniVoice"
SAMPLE_RATE = 24000


def slug(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9ก-๙]+", "-", text.strip())[:48].strip("-")
    return s or "nova-voice"


def pick_device(requested: str | None) -> str:
    if requested:
        return requested
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda:0"
    return "cpu"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Nova voice audio with OmniVoice")
    parser.add_argument("text", nargs="?", help="Text to synthesize")
    parser.add_argument("--text-file", help="Read text from UTF-8 file")
    parser.add_argument("--output", "-o", help="Output WAV path")
    parser.add_argument("--instruct", default="female, young adult, low pitch", help="Voice design instruction")
    parser.add_argument("--ref-audio", help="Reference WAV for authorized voice cloning")
    parser.add_argument("--ref-text", help="Transcript of reference audio; optional")
    parser.add_argument("--device", help="mps, cpu, cuda:0 etc. Defaults to mps on Apple Silicon")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--num-step", type=int, default=16, help="Diffusion steps; 16 faster, 32 higher quality")
    args = parser.parse_args()

    text = args.text
    if args.text_file:
        text = Path(args.text_file).read_text(encoding="utf-8")
    if not text:
        parser.error("Provide text or --text-file")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    output = Path(args.output) if args.output else OUT_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{slug(text)}.wav"
    if not output.is_absolute():
        output = ROOT / output
    output.parent.mkdir(parents=True, exist_ok=True)

    device = pick_device(args.device)
    dtype = torch.float16 if device.startswith(("mps", "cuda")) else torch.float32
    print(f"Loading {MODEL_ID} on {device} ({dtype})...", file=sys.stderr)
    model = OmniVoice.from_pretrained(MODEL_ID, device_map=device, dtype=dtype)

    kwargs = {"text": text, "num_step": args.num_step, "speed": args.speed}
    if args.ref_audio:
        kwargs["ref_audio"] = args.ref_audio
        if args.ref_text:
            kwargs["ref_text"] = args.ref_text
    elif args.instruct:
        kwargs["instruct"] = args.instruct

    print("Generating...", file=sys.stderr)
    audio = model.generate(**kwargs)
    sf.write(str(output), audio[0], SAMPLE_RATE)
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
