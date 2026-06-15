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
TELEGRAM_STALE_SECONDS = 15 * 60

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


def wait_for_port_free(port: int, timeout: int = 30) -> bool:
    """Wait for a TCP port to be free (no process bound to it).
    
    This solves the restart race condition where the old gateway process
    hasn't released port 18789 yet when the new instance tries to bind.
    
    Returns True if port is free within timeout, False otherwise.
    """
    start = time.monotonic()
    interval = 0.5
    while time.monotonic() - start < timeout:
        try:
            result = subprocess.run(
                ["lsof", "-i", f":{port}", "-t"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode != 0 or not result.stdout.strip():
                # No process found using the port
                return True
        except Exception:
            pass
        time.sleep(interval)
        interval = min(interval * 1.5, 3.0)
    # Final check
    try:
        result = subprocess.run(
            ["lsof", "-i", f":{port}", "-t"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode != 0 or not result.stdout.strip():
            return True
        pids = result.stdout.strip().splitlines()
        log("port_wait_timeout", port=port, remaining_pids=pids)
    except Exception as exc:
        log("port_wait_check_error", error=str(exc))
    return False


def kill_stale_gateway(pid: int) -> None:
    """Force-kill a stale gateway process that is still holding the port."""
    try:
        # First try SIGTERM for graceful shutdown
        os.kill(pid, 15)  # SIGTERM
        log("stale_gateway_sigterm_sent", pid=pid)
        time.sleep(2)
        # Then SIGKILL if still alive
        try:
            os.kill(pid, 9)  # SIGKILL
            log("stale_gateway_sigkill_sent", pid=pid)
        except ProcessLookupError:
            pass  # Process already dead
    except ProcessLookupError:
        pass  # Already dead
    except Exception as exc:
        log("stale_gateway_kill_error", pid=pid, error=str(exc))


def run(cmd: list[str], timeout: int = CMD_TIMEOUT) -> tuple[bool, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        output = ((p.stdout or "") + ("\n" + p.stderr if p.stderr else "")).strip()
        return p.returncode == 0, output[-4000:]
    except subprocess.TimeoutExpired as exc:
        return False, f"timeout after {timeout}s: {' '.join(cmd)}"
    except Exception as exc:
        return False, f"exception: {exc}"


def parse_json_prefix(output: str) -> dict:
    decoder = json.JSONDecoder()
    status, _ = decoder.raw_decode(output.lstrip())
    return status


def node_status_unhealthy(ok: bool, output: str) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    lowered = output.lower()
    if not ok:
        reasons.append("command_failed")
    if "runtime: stopped" in lowered:
        reasons.append("runtime_stopped")
    if "state not running" in lowered:
        reasons.append("state_not_running")
    if "service is loaded but not running" in lowered:
        reasons.append("loaded_not_running")
    if "service: launchagent (not loaded)" in lowered:
        reasons.append("launchagent_not_loaded")
    if "could not find service" in lowered:
        reasons.append("service_missing")
    return bool(reasons), reasons


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

    # Special handling for gateway restarts: ensure old process has released the port.
    if service == "gateway":
        port = 18789
        # Check if port is currently in use
        try:
            result = subprocess.run(
                ["lsof", "-i", f":{port}", "-t"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0 and result.stdout.strip():
                pids = result.stdout.strip().splitlines()
                log("port_still_in_use_pre_restart", port=port, pids=pids)
                # Wait for port to be released
                if wait_for_port_free(port, timeout=30):
                    log("port_became_free", port=port)
                else:
                    # Force kill stale processes holding the port
                    log("force_killing_stale_gateway", port=port, pids=pids)
                    for p in pids:
                        try:
                            kill_stale_gateway(int(p))
                        except ValueError:
                            pass
                    # Wait a moment for OS to release port
                    time.sleep(3)
                    wait_for_port_free(port, timeout=10)
        except Exception as exc:
            log("port_check_error_pre_restart", error=str(exc))

    log("restart_start", service=service, reason=reason, command=" ".join(cmd))
    ok, out = run(cmd, timeout=60)
    log("restart_done", service=service, ok=ok, output=out)


def check_telegram_channel(state: dict):
    ok, out = run([OPENCLAW, "channels", "status", "--channel", "telegram", "--json"])
    if not ok:
        log("telegram_status_error", ok=ok, output=out)
        restart("gateway", [OPENCLAW, "gateway", "restart"], "telegram channel status failed", state)
        return

    try:
        status = parse_json_prefix(out)
    except Exception as exc:
        log("telegram_status_parse_error", error=str(exc), output=out[-1200:])
        return

    channel = status.get("channels", {}).get("telegram", {})
    accounts = status.get("channelAccounts", {}).get("telegram", [])
    default_account = next((a for a in accounts if a.get("accountId") == "default"), accounts[0] if accounts else {})
    now_ms = int(time.time() * 1000)
    last_activity_ms = int(default_account.get("lastTransportActivityAt") or 0)
    stale_seconds = int((now_ms - last_activity_ms) / 1000) if last_activity_ms else None

    unhealthy_reasons: list[str] = []
    if not channel.get("configured"):
        unhealthy_reasons.append("channel_not_configured")
    if not channel.get("running"):
        unhealthy_reasons.append("channel_not_running")
    if channel.get("lastError"):
        unhealthy_reasons.append("channel_last_error")
    if not default_account:
        unhealthy_reasons.append("default_account_missing")
    else:
        if not default_account.get("configured"):
            unhealthy_reasons.append("account_not_configured")
        if not default_account.get("running"):
            unhealthy_reasons.append("account_not_running")
        if not default_account.get("connected"):
            unhealthy_reasons.append("account_not_connected")
        if default_account.get("restartPending"):
            unhealthy_reasons.append("restart_pending")
        if default_account.get("lastError"):
            unhealthy_reasons.append("account_last_error")
        if stale_seconds is not None and stale_seconds > TELEGRAM_STALE_SECONDS:
            unhealthy_reasons.append(f"transport_stale_{stale_seconds}s")

    log(
        "telegram_channel_check",
        ok=not unhealthy_reasons,
        reasons=unhealthy_reasons,
        channel_running=channel.get("running"),
        account_running=default_account.get("running") if default_account else None,
        account_connected=default_account.get("connected") if default_account else None,
        stale_seconds=stale_seconds,
        last_inbound_at=default_account.get("lastInboundAt") if default_account else None,
        last_outbound_at=default_account.get("lastOutboundAt") if default_account else None,
    )

    if unhealthy_reasons:
        restart("gateway", [OPENCLAW, "gateway", "restart"], "telegram unhealthy: " + ",".join(unhealthy_reasons), state)


def main():
    state = load_state()

    # Gateway health: status includes service + probe; health is a lightweight RPC when reachable.
    gw_ok, gw_out = run([OPENCLAW, "gateway", "status"])
    health_ok, health_out = run([OPENCLAW, "gateway", "health"])
    node_ok, node_out = run([OPENCLAW, "node", "status"])
    node_unhealthy, node_reasons = node_status_unhealthy(node_ok, node_out)

    log(
        "health_check",
        gateway_status_ok=gw_ok,
        gateway_health_ok=health_ok,
        node_status_ok=node_ok,
        node_unhealthy=node_unhealthy,
        node_reasons=node_reasons,
        gateway_status=gw_out[-1200:],
        gateway_health=health_out[-1200:],
        node_status=node_out[-1200:],
    )

    if not gw_ok or not health_ok:
        restart("gateway", [OPENCLAW, "gateway", "restart"], "gateway health/status failed", state)
        time.sleep(8)

    if node_unhealthy:
        restart("node", [OPENCLAW, "node", "restart"], "node unhealthy: " + ",".join(node_reasons), state)
        time.sleep(5)

    check_telegram_channel(state)

    # Post-recovery verification, payload-light.
    final_ok, final_out = run([OPENCLAW, "status"], timeout=35)
    log("final_status", ok=final_ok, output=final_out[-2000:])


if __name__ == "__main__":
    main()
