#!/usr/bin/env python3
"""Generate Nova speech with OmniVoice and send it via OpenClaw message send.

Default target is Nick's Telegram direct chat.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
NOVA_VOICE = ROOT / "nova-voice"
OPENCLAW = "/opt/homebrew/bin/openclaw"
FFMPEG = "/opt/homebrew/bin/ffmpeg"
DEFAULT_TARGET = "8613255279"
STATE_FILE = ROOT / "state.json"


def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"mode": "auto", "defaultInstruct": "female, young adult, low pitch"}


def run(cmd: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=str(cwd or ROOT), text=True, capture_output=True)


def main() -> int:
    p = argparse.ArgumentParser(description="Generate and send Nova voice to Telegram")
    p.add_argument("text", help="Text to synthesize and send")
    p.add_argument("--target", default=DEFAULT_TARGET, help="Telegram chat id / target")
    p.add_argument("--reply-to", help="Telegram message id to reply to")
    p.add_argument("--caption", default="", help="Optional message caption")
    p.add_argument("--instruct", help="Voice design instruction; defaults to state.json defaultInstruct")
    p.add_argument("--num-step", default="16")
    p.add_argument("--respect-mode", action="store_true", help="Skip sending when voice mode is off")
    p.add_argument("--context", choices=["text", "voice", "manual"], default="manual", help="Input context for auto mode")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--keep-wav", action="store_true")
    args = p.parse_args()

    state = load_state()
    mode = state.get("mode", "auto")
    if args.respect_mode:
        if mode == "off":
            print("voice_mode=off; skipped")
            return 0
        if mode == "auto" and args.context == "text":
            print("voice_mode=auto text-context; skipped")
            return 0

    instruct = args.instruct or state.get("defaultInstruct") or "female, young adult, low pitch"

    wav = ROOT / "output" / "nova-reply.wav"
    ogg = ROOT / "output" / "nova-reply.ogg"

    gen = run([str(NOVA_VOICE), "--instruct", instruct, "--num-step", str(args.num_step), "--output", str(wav), args.text])
    if gen.returncode != 0:
        sys.stderr.write(gen.stdout + gen.stderr)
        return gen.returncode

    conv = run([FFMPEG, "-y", "-i", str(wav), "-c:a", "libopus", "-b:a", "48k", str(ogg)])
    if conv.returncode != 0:
        sys.stderr.write(conv.stdout + conv.stderr)
        return conv.returncode

    cmd = [OPENCLAW, "message", "send", "--channel", "telegram", "--target", args.target, "--media", str(ogg)]
    if args.caption:
        cmd += ["--message", args.caption]
    if args.reply_to:
        cmd += ["--reply-to", args.reply_to]
    if args.dry_run:
        cmd.append("--dry-run")
    sent = run(cmd)
    sys.stdout.write(sent.stdout)
    if sent.returncode != 0:
        sys.stderr.write(sent.stderr)
        return sent.returncode

    if not args.keep_wav:
        try:
            wav.unlink(missing_ok=True)
        except Exception:
            pass
    print(str(ogg))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
