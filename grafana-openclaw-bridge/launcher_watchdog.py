#!/usr/bin/env python3
"""Launcher Watchdog — monitors Nova's critical LaunchAgents for silence.

Runs as a LaunchAgent (StartInterval=900, 15 min) and:
  1. Checks each job's last successful run mtime (out log + state files).
  2. If a job is silent beyond threshold, attempts `launchctl bootout+bootstrap`
     to reset the LaunchAgent's throttle.
  3. Sends a Google Chat alert (rate-limited per job) so silence doesn't go
     unnoticed.

The watchdog is intentionally deterministic — no AI agent, no model calls.
This keeps cron-like monitoring safe and cheap to run every 15 min.
"""

from __future__ import annotations

import json
import os
import hashlib
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

# Module-level flag for graceful shutdown (toggled by SIGTERM/SIGINT).
_RUNNING = True


def _signal_handler(signum, _frame) -> None:
    global _RUNNING
    _RUNNING = False
    log_line(f"received signal {signum}, preparing to exit")

# --------------------------------------------------------------------------- #
# Configuration                                                                #
# --------------------------------------------------------------------------- #

# How often the KeepAlive daemon runs the health-check cycle.
# Keep in sync with the previous StartInterval (900s) by default; the
# internal loop lets us run a faster sub-cycle if needed.
CHECK_INTERVAL_SECONDS = 60

HOME = Path(os.environ.get("HOME", "~")).expanduser()

JOBS: list[dict] = [
    {
        "name": "coupon-points-issue-alert",
        "label": "ai.openclaw.coupon-points-issue-alert",
        "out_log": HOME / ".openclaw/workspace/logs/coupon-points-issue-alert.out.log",
        "err_log": HOME / ".openclaw/workspace/logs/coupon-points-issue-alert.err.log",
        "state_files": [
            HOME / ".openclaw/state/grafana-openclaw-bridge/coupon-points-issue-alert.json",
        ],
        "error_patterns": [
            "LookupError: unknown encoding: idna",
            "RequestsDependencyWarning",
            "Traceback (most recent call last)",
        ],
        "plist": HOME / "Library/LaunchAgents/ai.openclaw.coupon-points-issue-alert.plist",
        "expected_interval_seconds": 10_800,    # 3h
        "silent_threshold_seconds": 21_600,     # 6h (2x interval + 3h buffer)
        "max_recoveries_per_hour": 4,
        "alert_cooldown_seconds": 1_800,        # 30 min
    },
    {
        "name": "discord-prod-order-forwarder",
        "label": "ai.openclaw.discord-prod-order-forwarder",
        "out_log": Path("/tmp/openclaw-discord-prod-order-forwarder.out.log"),
        "err_log": Path("/tmp/openclaw-discord-prod-order-forwarder.err.log"),
        "state_files": [
            HOME / ".openclaw/state/discord-alert-forwarder/prod-order-monitor-state.json",
        ],
        "error_patterns": [
            "discord_read_failed",
            "invalid_json",
            "No such file or directory: 'openclaw'",
            "FileNotFoundError",
            "Traceback (most recent call last)",
        ],
        "plist": HOME / "Library/LaunchAgents/ai.openclaw.discord-prod-order-forwarder.plist",
        "expected_interval_seconds": 60,
        "silent_threshold_seconds": 600,        # 10 min
        "max_recoveries_per_hour": 4,
        "alert_cooldown_seconds": 1_800,        # 30 min
    },
    {
        "name": "line-native-channel",
        "label": "ai.openclaw.gateway",
        "plist": HOME / "Library/LaunchAgents/ai.openclaw.gateway.plist",
        "health_checks": [
            {
                "name": "line-channel-status",
                "command": ["openclaw", "channels", "status", "--deep"],
                "must_include": [
                    "LINE default: enabled, configured, running",
                    "mode:webhook",
                ],
            },
            {
                "name": "line-webhook-local",
                "command": [
                    "curl",
                    "-fsS",
                    "--max-time",
                    "10",
                    "http://127.0.0.1:18789/line/webhook",
                ],
                "must_include": ["OK"],
            },
            {
                "name": "line-webhook-public",
                "command": [
                    "curl",
                    "-fsS",
                    "--max-time",
                    "15",
                    "https://line.novaosai.work/line/webhook",
                ],
                "must_include": ["OK"],
            },
        ],
        "max_recoveries_per_hour": 3,
        "alert_cooldown_seconds": 1_800,        # 30 min
    },
    {
        # Added 2026-06-21 after cloudflared silently died for 1.4h
        # (last log: 'no more connections active and exiting' at 01:14:35Z),
        # causing 530 from Cloudflare edge for ALL public services. The
        # line-native-channel job only checks the HTTP health, not whether
        # the tunnel process is alive. This new job monitors the process
        # state directly via launchctl + the cloudflared metrics endpoint.
        "name": "cloudflared-tunnel",
        "label": "homebrew.mxcl.cloudflared",
        "plist": HOME / "Library/LaunchAgents/homebrew.mxcl.cloudflared.plist",
        "health_checks": [
            {
                "name": "cloudflared-process-state",
                "command": [
                    "launchctl",
                    "print",
                    f"gui/{os.getuid()}/homebrew.mxcl.cloudflared",
                ],
                "must_include": ["state = running"],
                "timeout_seconds": 15,
            },
            {
                "name": "cloudflared-metrics-endpoint",
                "command": [
                    "curl",
                    "-fsS",
                    "--max-time",
                    "5",
                    "http://127.0.0.1:20241/metrics",
                ],
                "must_include": ["cloudflared_tunnel"],
                "timeout_seconds": 10,
            },
        ],
        "max_recoveries_per_hour": 3,
        "alert_cooldown_seconds": 1_800,        # 30 min
    },
]

STATE_PATH = HOME / ".openclaw/state/launcher-watchdog/state.json"
LOG_PATH = HOME / ".openclaw/workspace/logs/launcher-watchdog.out.log"
MAX_ERROR_SCAN_BYTES = 24_000


# --------------------------------------------------------------------------- #
# Env + state helpers                                                          #
# --------------------------------------------------------------------------- #

def load_env() -> None:
    """Load webhook + config from local env files, mirroring other scripts."""
    script_dir = Path(__file__).resolve().parent
    candidates = [
        script_dir / ".env.launcher-watchdog",
        script_dir / ".env.coupon-points-alert",   # fallback webhook
        script_dir / ".env",
        HOME / ".openclaw" / ".env",
    ]
    for path in candidates:
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load_state() -> dict:
    if not STATE_PATH.parent.exists():
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not STATE_PATH.exists():
        return {}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(STATE_PATH)


def log_line(line: str) -> None:
    """Append a line to the watchdog log (best-effort)."""
    try:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        ts = time.strftime("%Y-%m-%d %H:%M:%S %Z", time.localtime())
        with LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(f"[{ts}] {line}\n")
    except Exception:
        pass


# --------------------------------------------------------------------------- #
# Job checks + recovery                                                        #
# --------------------------------------------------------------------------- #

def get_last_fresh(paths: list[Path]) -> tuple[float, str | None]:
    """Return (oldest mtime epoch, source path) across existing files.

    We use the OLDEST mtime (least recently touched) of all known freshness
    signals. Using min is intentional: if the script runs but crashes before
    updating state, OR if state is updated without a run, the job is
    suspicious and should be flagged. The script's out.log is the primary
    signal; state files are cross-checks.

    Returns (0, None) when no file exists.
    """
    oldest_ts: float | None = None
    oldest_src: str | None = None
    for p in paths:
        try:
            if p.exists():
                m = p.stat().st_mtime
                if oldest_ts is None or m < oldest_ts:
                    oldest_ts = m
                    oldest_src = str(p)
        except OSError:
            continue
    if oldest_ts is None:
        return 0.0, None
    return oldest_ts, oldest_src


def file_mtime(path: Path | None) -> float:
    if not path:
        return 0.0
    try:
        return path.stat().st_mtime if path.exists() else 0.0
    except OSError:
        return 0.0


def tail_text(path: Path, max_bytes: int = MAX_ERROR_SCAN_BYTES) -> str:
    try:
        size = path.stat().st_size
        with path.open("rb") as f:
            if size > max_bytes:
                f.seek(size - max_bytes)
            return f.read().decode("utf-8", errors="replace")
    except OSError:
        return ""


def find_error_signal(job: dict, since_ts: float) -> tuple[bool, float, str, str]:
    """Return the latest configured error pattern seen after since_ts."""
    err_log = job.get("err_log")
    patterns = job.get("error_patterns") or []
    if not err_log or not patterns:
        return False, 0.0, "", ""

    mtime = file_mtime(err_log)
    if mtime <= since_ts:
        return False, mtime, "", ""

    text = tail_text(err_log)
    if not text:
        return False, mtime, "", ""

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in reversed(lines):
        for pattern in patterns:
            if pattern in line:
                digest = hashlib.sha256(f"{mtime}:{pattern}:{line}".encode("utf-8")).hexdigest()[:16]
                return True, mtime, digest, line[-280:]
    return False, mtime, "", ""


def check_job(job: dict) -> tuple[str, float, float | None, str | None]:
    """Return (status, last_fresh_ts, silent_seconds, last_fresh_source).

    status ∈ {"ok", "silent", "missing"}.
    """
    ok, err_ts, err_key, err_line = find_error_signal(
        job,
        float(job.get("_last_error_seen_ts") or 0.0),
    )
    if ok:
        return "error", err_ts, 0.0, err_line

    if job.get("health_checks"):
        ok, detail = run_health_checks(job["health_checks"])
        if ok:
            return "ok", time.time(), 0.0, detail
        return "silent", time.time(), 0.0, detail

    # Primary signal: the script's stdout log. State files are cross-checks
    # but we treat out.log as the authoritative "did the script run?" marker.
    last_fresh, src = get_last_fresh([job["out_log"], *job["state_files"]])
    if last_fresh <= 0:
        return "missing", 0.0, None, None
    silent = time.time() - last_fresh
    if silent > job["silent_threshold_seconds"]:
        return "silent", last_fresh, silent, src
    return "ok", last_fresh, silent, src


def run_health_checks(checks: list[dict]) -> tuple[bool, str]:
    """Run deterministic command checks for services where silence is normal."""
    for check in checks:
        name = check.get("name", "health-check")
        command = check["command"]
        try:
            proc = subprocess.run(
                command,
                check=False,
                capture_output=True,
                timeout=check.get("timeout_seconds", 30),
                text=True,
                env={
                    **os.environ,
                    "PATH": (
                        "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:"
                        "/usr/sbin:/sbin:" + os.environ.get("PATH", "")
                    ),
                },
            )
        except Exception as e:
            return False, f"{name}: {type(e).__name__}: {e}"

        output = (proc.stdout or "") + (proc.stderr or "")
        if proc.returncode != 0:
            return False, f"{name}: rc={proc.returncode}: {output[-300:]}"
        for needle in check.get("must_include", []):
            if needle not in output:
                return False, f"{name}: missing {needle!r}: {output[-300:]}"
    return True, "health checks passed"


def recover_job(job: dict) -> tuple[bool, str]:
    """Try to reload the LaunchAgent. Returns (ok, message)."""
    plist = str(job["plist"])
    label = job["label"]
    target = f"gui/{os.getuid()}"
    try:
        bo = subprocess.run(
            ["launchctl", "bootout", target, plist],
            check=False, capture_output=True, timeout=30, text=True,
        )
        # bootout returns 0 if it was loaded, 3 if not loaded — both fine
        if bo.returncode not in (0, 3):
            log_line(f"bootout rc={bo.returncode}: {bo.stderr.strip()[:200]}")
        time.sleep(2)
        bs = subprocess.run(
            ["launchctl", "bootstrap", target, plist],
            check=False, capture_output=True, timeout=30, text=True,
        )
        if bs.returncode == 0:
            return True, "reloaded"
        return False, f"bootstrap rc={bs.returncode}: {bs.stderr.strip()[:200]}"
    except Exception as e:  # pragma: no cover
        return False, f"{type(e).__name__}: {e}"


def post_chat(webhook: str, text: str) -> bool:
    # Mute switch (set WATCHDOG_MUTE_CHAT=1 in env to silence Google Chat
    # alerts while keeping monitor + recover logic intact). Logged so the
    # suppression is visible in the watchdog log.
    if os.environ.get("WATCHDOG_MUTE_CHAT", "").strip() in ("1", "true", "yes", "on"):
        log_line("chat muted (WATCHDOG_MUTE_CHAT=1); would have sent: " + text[:200])
        return False
    if not webhook:
        log_line("no webhook configured; would have sent: " + text[:200])
        return False
    body = json.dumps({"text": text}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        webhook,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status < 300
    except Exception as e:
        log_line(f"chat webhook failed: {type(e).__name__}: {e}")
        return False


# --------------------------------------------------------------------------- #
# Main loop                                                                    #
# --------------------------------------------------------------------------- #

def process_job(job: dict, state: dict, webhook: str, now: float) -> None:
    name = job["name"]
    js = state.setdefault(name, {
        "recoveries": [],
        "last_alert_ts": 0.0,
        "last_error_alert_ts": 0.0,
        "last_error_seen_ts": 0.0,
        "last_error_key": "",
        "last_status": None,
        "first_seen_ts": now,
        "install_notice_sent": False,
    })
    if not js.get("last_error_seen_ts") and js.get("last_status") is not None:
        js["last_error_seen_ts"] = file_mtime(job.get("err_log"))

    job["_last_error_seen_ts"] = js.get("last_error_seen_ts", 0.0)
    status, last_fresh, silent, src = check_job(job)
    prev = js.get("last_status")

    # One-time install confirmation so the user knows the watchdog is alive.
    if not js.get("install_notice_sent"):
        first_msg = (
            f"✅ Launcher Watchdog installed and monitoring {len(JOBS)} jobs: "
            + ", ".join(j["name"] for j in JOBS)
        )
        if post_chat(webhook, first_msg):
            js["install_notice_sent"] = True

    if status == "ok":
        # Recovery from a previous silence episode → send "back online" notice
        if prev in ("silent", "silent_recovering"):
            silent_min = (silent or 0) / 60
            msg = (
                f"✅ Watchdog: {name} is healthy again "
                f"(last fresh: {silent_min:.1f} min ago)"
            )
            post_chat(webhook, msg)
            log_line(f"{name} recovered (silent {silent_min:.1f}m)")
        js["last_status"] = "ok"
        js["recoveries"] = [r for r in js.get("recoveries", []) if now - r["ts"] < 86_400]
        return

    if status == "error":
        err_key = hashlib.sha256(str(src or "").encode("utf-8")).hexdigest()[:16]
        js["last_status"] = "error"
        js["last_error_seen_ts"] = max(float(js.get("last_error_seen_ts") or 0.0), last_fresh)
        log_line(f"{name} error signal: {src}")
        if (
            err_key != js.get("last_error_key")
            and now - js.get("last_error_alert_ts", 0) > job["alert_cooldown_seconds"]
        ):
            post_chat(
                webhook,
                f"🟠 Watchdog: {name} logged an error — {str(src)[:500]}",
            )
            js["last_error_alert_ts"] = now
            js["last_error_key"] = err_key
        return

    if status == "missing":
        # No log/state file yet — first install grace period
        log_line(f"{name} missing (no logs/state yet)")
        js["last_status"] = "missing"
        return

    # status == "silent"
    js["last_status"] = "silent"
    silent_h = (silent or 0) / 3600
    log_line(f"{name} silent for {silent_h:.2f}h (last fresh: {src})")

    # Rate-limit recoveries (max N per hour)
    recent = [r for r in js.get("recoveries", []) if now - r["ts"] < 3_600]
    if len(recent) >= job["max_recoveries_per_hour"]:
        if now - js.get("last_alert_ts", 0) > job["alert_cooldown_seconds"]:
            post_chat(
                webhook,
                f"🔴 Watchdog: {name} silent for {silent_h:.1f}h — "
                f"{len(recent)} recovery attempts in the last hour failed. "
                f"Manual intervention needed.",
            )
            js["last_alert_ts"] = now
        return

    # Attempt recovery
    ok, detail = recover_job(job)
    js.setdefault("recoveries", []).append({"ts": now, "ok": ok, "detail": detail})
    js["last_status"] = "silent_recovering"

    if now - js.get("last_alert_ts", 0) > job["alert_cooldown_seconds"]:
        action = "✅ reloaded" if ok else f"❌ recovery failed: {detail[:200]}"
        post_chat(
            webhook,
            f"🚨 Watchdog: {name} silent for {silent_h:.1f}h — {action}",
        )
        js["last_alert_ts"] = now


def main() -> int:
    """KeepAlive daemon: loop health checks every CHECK_INTERVAL_SECONDS.

    Converted 2026-06-15 from one-shot + StartInterval plist to KeepAlive
    daemon + internal loop because macOS launchd interval scheduler was
    not re-spawning the agent after exit (domain response: 36). With
    KeepAlive the process stays alive, cycles internally, and exit only on
    SIGTERM/SIGINT (e.g. during explicit bootout).
    """
    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    load_env()
    webhook = (
        os.environ.get("WATCHDOG_GOOGLE_CHAT_WEBHOOK")
        or os.environ.get("COUPON_POINTS_GOOGLE_CHAT_WEBHOOK")
        or ""
    )

    log_line(
        f"watchdog keepalive daemon starting; "
        f"check_interval={CHECK_INTERVAL_SECONDS}s, jobs={len(JOBS)}"
    )

    cycle = 0
    while _RUNNING:
        cycle += 1
        try:
            state = load_state()
            now = time.time()
            for job in JOBS:
                try:
                    process_job(job, state, webhook, now)
                except Exception as e:
                    log_line(f"{job['name']} crashed: {type(e).__name__}: {e}")
            save_state(state)
            log_line(f"watchdog run complete (cycle {cycle})")
        except Exception as e:
            log_line(f"watchdog cycle crashed: {type(e).__name__}: {e}")

        # Sleep in 1s slices so SIGTERM breaks us out quickly.
        for _ in range(CHECK_INTERVAL_SECONDS):
            if not _RUNNING:
                break
            time.sleep(1)

    log_line("watchdog exiting gracefully")
    return 0


if __name__ == "__main__":
    sys.exit(main())
