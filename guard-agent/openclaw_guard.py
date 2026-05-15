#!/usr/bin/env python3
"""
OpenClaw Guard Agent / Watchdog
- Read-only health checks by default
- Safe auto-recovery for clearly failed Gateway/Node services
- Rate-limited restarts to avoid restart loops
"""
from __future__ import annotations

import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = Path("/Users/nova/.openclaw/workspace")
LOG_DIR = WORKSPACE / "logs"
STATE_DIR = WORKSPACE / "guard-agent"
LOG_FILE = LOG_DIR / "openclaw-guard.log"
STATE_FILE = STATE_DIR / "state.json"

OPENCLAW = "/opt/homebrew/bin/openclaw"
WINDOW_SECONDS = 30 * 60
MAX_RESTARTS_PER_WINDOW = 2
CMD_TIMEOUT = 25

LOG_DIR.mkdir(parents=True, exist_ok=True)
STATE_DIR.mkdir(parents=True, exist_ok=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def log(event: str, **fields):
    record = {"ts": now_iso(), "event": event, **fields}
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {"restarts": {}}
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        log("state_read_error", error=str(exc))
        return {"restarts": {}}


def save_state(state: dict):
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(STATE_FILE)


def run(cmd: list[str], timeout: int = CMD_TIMEOUT) -> tuple[bool, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        output = ((p.stdout or "") + ("\n" + p.stderr if p.stderr else "")).strip()
        return p.returncode == 0, output[-4000:]
    except subprocess.TimeoutExpired as exc:
        return False, f"timeout after {timeout}s: {' '.join(cmd)}"
    except Exception as exc:
        return False, f"exception: {exc}"


def can_restart(service: str, state: dict) -> tuple[bool, str]:
    now = int(time.time())
    restarts = state.setdefault("restarts", {}).setdefault(service, [])
    restarts[:] = [t for t in restarts if now - int(t) <= WINDOW_SECONDS]
    if len(restarts) >= MAX_RESTARTS_PER_WINDOW:
        return False, f"rate_limited: {len(restarts)} restarts in {WINDOW_SECONDS}s"
    restarts.append(now)
    save_state(state)
    return True, "ok"


def restart(service: str, cmd: list[str], reason: str, state: dict):
    allowed, why = can_restart(service, state)
    if not allowed:
        log("restart_blocked", service=service, reason=reason, policy=why)
        return
    log("restart_start", service=service, reason=reason, command=" ".join(cmd))
    ok, out = run(cmd, timeout=60)
    log("restart_done", service=service, ok=ok, output=out)


def main():
    state = load_state()

    # Gateway health: status includes service + probe; health is a lightweight RPC when reachable.
    gw_ok, gw_out = run([OPENCLAW, "gateway", "status"])
    health_ok, health_out = run([OPENCLAW, "gateway", "health"])
    node_ok, node_out = run([OPENCLAW, "node", "status"])

    log(
        "health_check",
        gateway_status_ok=gw_ok,
        gateway_health_ok=health_ok,
        node_status_ok=node_ok,
        gateway_status=gw_out[-1200:],
        gateway_health=health_out[-1200:],
        node_status=node_out[-1200:],
    )

    if not gw_ok or not health_ok:
        restart("gateway", [OPENCLAW, "gateway", "restart"], "gateway health/status failed", state)
        time.sleep(8)

    if not node_ok:
        restart("node", [OPENCLAW, "node", "restart"], "node status failed", state)
        time.sleep(5)

    # Post-recovery verification, payload-light.
    final_ok, final_out = run([OPENCLAW, "status"], timeout=35)
    log("final_status", ok=final_ok, output=final_out[-2000:])


if __name__ == "__main__":
    main()
