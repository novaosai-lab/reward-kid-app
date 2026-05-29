#!/usr/bin/env python3
"""Nova Voice Mode toggle.

Modes:
- off: text only
- voice: voice only when explicitly called by sender wrapper
- both: text + voice allowed
- auto: voice replies for inbound voice contexts, text for normal text contexts
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE_FILE = ROOT / "state.json"
VALID_MODES = {"off", "voice", "both", "auto"}
DEFAULT_STATE = {
    "mode": "auto",
    "defaultInstruct": "female, young adult, moderate pitch",
    "defaultSpeed": 0.94,
    "defaultNumStep": 32,
    "updatedAt": None,
    "updatedBy": "system",
}


def now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def load() -> dict:
    if not STATE_FILE.exists():
        save(DEFAULT_STATE.copy())
        return DEFAULT_STATE.copy()
    try:
        state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        state = DEFAULT_STATE.copy()
    merged = DEFAULT_STATE.copy()
    merged.update(state)
    if merged.get("mode") not in VALID_MODES:
        merged["mode"] = DEFAULT_STATE["mode"]
    return merged


def save(state: dict) -> None:
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(STATE_FILE)


def main() -> int:
    p = argparse.ArgumentParser(description="Manage Nova voice reply mode")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status")

    setp = sub.add_parser("set")
    setp.add_argument("mode", choices=sorted(VALID_MODES))
    setp.add_argument("--by", default="nick")

    tonep = sub.add_parser("tone")
    tonep.add_argument("instruct")
    tonep.add_argument("--by", default="nick")

    profilep = sub.add_parser("profile")
    profilep.add_argument("instruct")
    profilep.add_argument("--speed", type=float, default=DEFAULT_STATE["defaultSpeed"])
    profilep.add_argument("--num-step", type=int, default=DEFAULT_STATE["defaultNumStep"])
    profilep.add_argument("--by", default="nick")

    args = p.parse_args()
    state = load()

    if args.cmd == "status":
        print(json.dumps(state, ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "set":
        state["mode"] = args.mode
        state["updatedAt"] = now()
        state["updatedBy"] = args.by
        save(state)
        print(json.dumps(state, ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "tone":
        state["defaultInstruct"] = args.instruct
        state["updatedAt"] = now()
        state["updatedBy"] = args.by
        save(state)
        print(json.dumps(state, ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "profile":
        state["defaultInstruct"] = args.instruct
        state["defaultSpeed"] = args.speed
        state["defaultNumStep"] = args.num_step
        state["updatedAt"] = now()
        state["updatedBy"] = args.by
        save(state)
        print(json.dumps(state, ensure_ascii=False, indent=2))
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
