#!/usr/bin/env python3
"""
Nova Auto-Executor — Goal Queue + Auto-Pick Pattern
====================================================

Implements the "inbox backlog -> Nova picks + executes when idle" loop.

Pick rules (in order):
  1. Status == pending
  2. Approval == none  (auto-executable)
  3. Risk in {low, medium} (medium skipped if no weekly theme match)
  4. Effort: small always eligible; medium only on matching weekday theme;
     large NEVER auto-picked (must be human-initiated)
  5. category=memory always eligible regardless of weekday
  6. Oldest first by `added` date

Rate limits:
  - max 3 picks per day (resets at midnight local time)
  - 1 tick per heartbeat (caller enforces)

After pick:
  - status -> picked, record pick_ts in state
  - log to logs/auto-executor.log
  - caller (Nova heartbeat or human) is responsible for the actual execution
    and should call `nova-auto complete <id> --evidence "..."` when done.

Constraints enforced:
  - Never picks approval=required (must be human-initiated)
  - Never picks risk=high (must be human-approved case-by-case)
  - Rate limit caps daily auto-pick volume
  - All actions append-only on backlog.json; status only changes between
    pending -> picked -> in_progress -> done|skipped|blocked
"""

import argparse
import datetime as dt
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

WORKSPACE = Path("/Users/nova/.openclaw/workspace")
BACKLOG_PATH = WORKSPACE / "nova-skill-os" / "backlog.json"
STATE_PATH = Path.home() / ".openclaw" / "state" / "auto-executor" / "state.json"
LOG_PATH = WORKSPACE / "logs" / "auto-executor.log"
RESULTS_DIR = Path.home() / ".openclaw" / "state" / "auto-executor" / "results"
SPAWN_QUEUE_DIR = Path.home() / ".openclaw" / "state" / "auto-executor" / "spawn-queue"

# Weekly theme → allowed categories (Monday=0 ... Sunday=6)
WEEKDAY_THEMES = {
    0: {"safety", "governance", "memory"},          # Monday
    1: {"support", "rca", "memory"},               # Tuesday
    2: {"automation", "n8n", "skill-os"},          # Wednesday
    3: {"skill-os", "routing", "memory"},          # Thursday
    4: {"dashboard", "observability", "memory"},    # Friday
    5: {"research", "learning", "memory"},         # Saturday
    6: {"memory", "cleanup", "research"},          # Sunday
}

DAILY_PICK_LIMIT = 3

# Categories that get the cheap model for sub-agent execution
# (per improvement-plan.md "Model cost policy")
CHEAP_MODEL_CATEGORIES = {"research", "learning", "cleanup", "memory"}
DEFAULT_MODEL = "minimax-portal/MiniMax-M3"
CHEAP_MODEL = "minimax-portal/MiniMax-M2.7-highspeed"

# Sub-agent timeout (seconds). Small tasks shouldn't take more than 5 min.
DEFAULT_SPAWN_TIMEOUT = 300


def log_line(msg: str) -> None:
    """Append a timestamped line to the auto-executor log."""
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    ts = dt.datetime.now().isoformat(timespec="seconds")
    with LOG_PATH.open("a") as f:
        f.write(f"[{ts}] {msg}\n")
    print(msg)


def load_backlog() -> Dict[str, Any]:
    if not BACKLOG_PATH.exists():
        log_line(f"ERROR: backlog not found at {BACKLOG_PATH}")
        sys.exit(1)
    return json.loads(BACKLOG_PATH.read_text())


def save_backlog(b: Dict[str, Any]) -> None:
    BACKLOG_PATH.write_text(
        json.dumps(b, indent=2, ensure_ascii=False) + "\n"
    )


def load_state() -> Dict[str, Any]:
    if not STATE_PATH.exists():
        return {
            "today": None,
            "count_today": 0,
            "last_pick": None,
            "runs": [],
            "created": dt.datetime.now().isoformat(timespec="seconds"),
        }
    return json.loads(STATE_PATH.read_text())


def save_state(s: Dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(s, indent=2, ensure_ascii=False))


def today_iso() -> str:
    return dt.date.today().isoformat()


def category_matches_today(category: str, effort: str) -> bool:
    """Return True if `category` matches today's weekly theme.
    Items with effort=small or category=memory are always eligible."""
    if effort == "small":
        return True
    if category == "memory":
        return True
    weekday = dt.date.today().weekday()
    return category in WEEKDAY_THEMES.get(weekday, set())


def eligible_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return pending items eligible for auto-pick, sorted by date added.

    Auto-pick rules:
    - small effort: eligible every day if approval=none and risk in {low, medium}
    - medium effort: eligible only when today's weekly theme matches category
    - large effort: NEVER auto-pick (multi-hour work, must be human-initiated)
    """
    out = []
    for it in items:
        if it.get("status") != "pending":
            continue
        if it.get("approval") == "required":
            continue
        if it.get("risk") == "high":
            continue
        if it.get("risk") not in ("low", "medium"):
            continue
        effort = it.get("effort", "small")
        if effort == "large":
            continue
        if not category_matches_today(it.get("category", ""), effort):
            continue
        out.append(it)
    out.sort(key=lambda x: x.get("added", "9999-99-99"))
    return out


def reset_daily_counter(state: Dict[str, Any]) -> Dict[str, Any]:
    if state.get("today") != today_iso():
        state["today"] = today_iso()
        state["count_today"] = 0
    return state


# ============================================================================
# Commands
# ============================================================================

def cmd_list(_args) -> int:
    b = load_backlog()
    items = b.get("items", [])
    by_status: Dict[str, List[Dict[str, Any]]] = {}
    for it in items:
        by_status.setdefault(it.get("status", "unknown"), []).append(it)

    print(f"📋 Nova Auto-Executor Backlog  ({len(items)} total)")
    print(f"   Source: {BACKLOG_PATH}")
    print()
    for status in ["pending", "picked", "in_progress", "blocked", "skipped", "done"]:
        bucket = by_status.get(status, [])
        if not bucket:
            continue
        print(f"### {status}  ({len(bucket)})")
        for it in bucket:
            appr = it.get("approval", "none")
            risk = it.get("risk", "?")
            eff = it.get("effort", "?")
            cat = it.get("category", "?")
            if status == "done":
                mark = "✓"
            elif status == "skipped":
                mark = "⏭ "
            elif status == "blocked":
                mark = "🚫"
            elif status == "in_progress":
                mark = "▶"
            elif status == "picked":
                mark = "🎯"
            elif appr == "required":
                mark = "🔒"
            elif risk == "medium":
                mark = "⚠️ "
            else:
                mark = "✅"
            print(f"  {mark} {it['id']}  [{risk}/{eff}/{cat}]  {it['title']}")
        print()
    return 0


def cmd_add(args) -> int:
    b = load_backlog()
    items = b.get("items", [])

    today = today_iso()
    used_ids = {it["id"] for it in items if "id" in it}
    n = 1
    while True:
        candidate = f"B-{today}-{n:03d}"
        if candidate not in used_ids:
            break
        n += 1

    new_item = {
        "id": candidate,
        "title": args.title,
        "source": args.source or "(manual)",
        "category": args.category or "misc",
        "risk": args.risk or "low",
        "effort": args.effort or "small",
        "approval": args.approval or "none",
        "added": today,
        "status": "pending",
    }
    if args.notes:
        new_item["notes"] = args.notes

    items.append(new_item)
    save_backlog(b)
    log_line(f"ADD  {candidate}  [{new_item['risk']}/{new_item['effort']}/{new_item['category']}]  {args.title}")
    print(f"✅ Added: {candidate}  →  {args.title}")
    return 0


def cmd_tick(args) -> int:
    """Pick next eligible item. Updates backlog status + state + log.

    With --spawn flag: also immediately spawn sub-agent to execute.
    """
    state = reset_daily_counter(load_state())

    if state["count_today"] >= DAILY_PICK_LIMIT:
        print(f"⛔ Daily limit reached ({DAILY_PICK_LIMIT} picks today).")
        print(f"   Next reset: midnight local time.")
        return 0

    b = load_backlog()
    items = b.get("items", [])
    candidates = eligible_items(items)

    if not candidates:
        weekday = dt.date.today().strftime("%A")
        theme = WEEKDAY_THEMES.get(dt.date.today().weekday(), set())
        print(f"🟢 No eligible items right now.")
        print(f"   Today is {weekday} → theme categories: {sorted(theme)}")
        print(f"   {state['count_today']}/{DAILY_PICK_LIMIT} picks used today.")
        return 0

    pick = candidates[0]
    pick["status"] = "picked"
    pick["picked_at"] = dt.datetime.now().isoformat(timespec="seconds")
    save_backlog(b)

    state["count_today"] += 1
    state["last_pick"] = {
        "id": pick["id"],
        "title": pick["title"],
        "ts": pick["picked_at"],
    }
    state.setdefault("runs", []).append(state["last_pick"])
    save_state(state)

    log_line(f"PICK {pick['id']}  [{pick['risk']}/{pick['effort']}/{pick['category']}]  {pick['title']}")
    log_line(f"     source={pick.get('source')}  approval={pick.get('approval')}")

    print()
    print(f"🎯 PICKED: {pick['id']}")
    print(f"   Title:    {pick['title']}")
    print(f"   Category: {pick.get('category')}   Risk: {pick.get('risk')}   Effort: {pick.get('effort')}")
    print(f"   Source:   {pick.get('source')}")
    if pick.get("notes"):
        print(f"   Notes:    {pick['notes'].strip()[:200]}")
    print()
    print(f"   Picks today: {state['count_today']}/{DAILY_PICK_LIMIT}")
    print()
    print("   Next steps:")
    print("   1. Do the work (read source, run commands, write artifacts)")
    print("   2. Verify (test, inspect, screenshot — anything measurable)")
    print(f"   3. Mark complete:  nova-auto complete {pick['id']} --evidence \"<what you did>\"")
    print(f"      Or skip:        nova-auto skip {pick['id']} --reason \"<why>\"")
    print()

    if getattr(args, "spawn", False):
        print("   --spawn flag set: spawning sub-agent...")
        return cmd_spawn(argparse.Namespace(id=pick["id"], timeout=DEFAULT_SPAWN_TIMEOUT, model=None, dry_run=False))

    return 0


def cmd_complete(args) -> int:
    b = load_backlog()
    items = b.get("items", [])
    target = next((it for it in items if it.get("id") == args.id), None)
    if not target:
        print(f"❌ {args.id} not found in backlog.")
        return 1

    target["status"] = "done"
    target["completed_at"] = dt.datetime.now().isoformat(timespec="seconds")
    target["evidence"] = args.evidence or ""
    if args.result:
        target["result"] = args.result
    save_backlog(b)

    log_line(f"DONE {args.id}  evidence={target['evidence'][:120]}")
    print(f"✅ {args.id} marked done.")
    return 0


def cmd_skip(args) -> int:
    b = load_backlog()
    items = b.get("items", [])
    target = next((it for it in items if it.get("id") == args.id), None)
    if not target:
        print(f"❌ {args.id} not found.")
        return 1

    target["status"] = "skipped" if not args.block else "blocked"
    target["skipped_at"] = dt.datetime.now().isoformat(timespec="seconds")
    target["skip_reason"] = args.reason or ""
    save_backlog(b)

    log_line(f"SKIP {args.id}  reason={target['skip_reason'][:120]}")
    print(f"⏭  {args.id} marked {target['status']}: {target['skip_reason']}")
    return 0


def cmd_start(args) -> int:
    b = load_backlog()
    items = b.get("items", [])
    target = next((it for it in items if it.get("id") == args.id), None)
    if not target:
        print(f"❌ {args.id} not found.")
        return 1
    target["status"] = "in_progress"
    target["started_at"] = dt.datetime.now().isoformat(timespec="seconds")
    save_backlog(b)
    log_line(f"START {args.id}")
    print(f"▶ {args.id} marked in_progress.")
    return 0


def cmd_state(_args) -> int:
    state = reset_daily_counter(load_state())
    save_state(state)

    b = load_backlog()
    items = b.get("items", [])
    pending = sum(1 for it in items if it.get("status") == "pending")
    picked = sum(1 for it in items if it.get("status") == "picked")
    in_prog = sum(1 for it in items if it.get("status") == "in_progress")
    done = sum(1 for it in items if it.get("status") == "done")
    skipped = sum(1 for it in items if it.get("status") == "skipped")
    blocked = sum(1 for it in items if it.get("status") == "blocked")

    weekday = dt.date.today().strftime("%A")
    theme = WEEKDAY_THEMES.get(dt.date.today().weekday(), set())

    print(f"📊 Auto-Executor State")
    print(f"   Today: {today_iso()} ({weekday})  →  theme: {sorted(theme)}")
    print(f"   Picks today: {state['count_today']}/{DAILY_PICK_LIMIT}")
    print(f"   Last pick: {json.dumps(state.get('last_pick'), ensure_ascii=False)}")
    print()
    print(f"   Backlog: pending={pending} picked={picked} in_progress={in_prog} "
          f"done={done} skipped={skipped} blocked={blocked}")
    return 0


# ============================================================================
# Tier 2 — Sub-agent spawn, watch, drain
# ============================================================================

def model_for_category(category: str) -> str:
    """Return the model id to use for sub-agent execution of this category."""
    if category in CHEAP_MODEL_CATEGORIES:
        return CHEAP_MODEL
    return DEFAULT_MODEL


def build_subagent_prompt(item: Dict[str, Any], result_path: Path) -> str:
    """Build the prompt sent to the spawned sub-agent.

    The prompt is self-contained: it tells the sub-agent what to do,
    where to write results, and what constraints to respect.
    """
    parts = [
        "[Nova Auto-Executor Sub-Agent Task]",
        "",
        f"ITEM ID: {item['id']}",
        f"TITLE: {item['title']}",
        f"CATEGORY: {item.get('category', 'misc')}",
        f"RISK: {item.get('risk', 'low')}   EFFORT: {item.get('effort', 'small')}",
        f"SOURCE: {item.get('source', '(none)')}",
        "",
        "TASK:",
        (item.get("notes") or item["title"]).strip(),
        "",
        "STEPS:",
        "1. Read the source file/URL thoroughly (do not skim).",
        "2. Do the work: read files, run commands, write artifacts.",
        "3. Verify your work with at least one measurable check:",
        "   - command output (cat/ls/curl/python3 -c ...)",
        "   - file existence + content inspection",
        "   - py_compile / syntax check / lint",
        "   - direct read-back of what you wrote",
        "4. Write your result to the file at:",
        f"   {result_path}",
        "",
        "RESULT FILE FORMAT (markdown):",
        "```",
        "# Auto-Executor Result — <ID>",
        "",
        "## Status",
        "done | blocked | partial",
        "",
        "## Summary",
        "<1-3 sentence summary of what you accomplished>",
        "",
        "## Evidence",
        "- Files created/modified: <list with paths>",
        "- Commands run: <list with key outputs>",
        "- Verification: <test/inspect/check results>",
        "",
        "## Notes for main Nova",
        "<anything the main session should know>",
        "",
        "## Suggested follow-ups (optional)",
        "<related items to consider>",
        "```",
        "",
        "AFTER writing the result file, you may reply briefly to your session with",
        "the summary line, but DO NOT deliver to any external channel.",
        "",
        "CONSTRAINTS (enforced):",
        "- DO NOT install packages, enable services, or modify system configs.",
        "- DO NOT touch secrets, tokens, or credential files.",
        "- DO NOT send external messages (no Telegram, Discord, email, etc.).",
        "- DO NOT delete files. Create new files only; modify existing ones only when task requires it.",
        "- If the task seems risky or out of scope: write status=blocked in the result",
        "  file with a clear explanation, and stop.",
        "- Time budget is tight — focus on the smallest useful result, not exhaustive coverage.",
        "- When in doubt, write status=partial with what you have.",
        "",
        "WORKSPACE: /Users/nova/.openclaw/workspace",
        "RESULT PATH: " + str(result_path),
    ]
    return "\n".join(parts)


def run_openclaw_agent(prompt: str, item_id: str, model: str, timeout: int) -> Dict[str, Any]:
    """Call `openclaw agent` to spawn a sub-agent. Returns parsed JSON or error."""
    import subprocess

    session_key = f"agent:main:auto-exec-{item_id.lower()}"
    cmd = [
        "openclaw", "agent",
        "--agent", "main",
        "--session-key", session_key,
        "--message", prompt,
        "--model", model,
        "--thinking", "low",
        "--timeout", str(timeout),
        "--json",
    ]
    log_line(f"SPAWN {item_id}  model={model}  session={session_key}  timeout={timeout}s")
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout + 30,  # give wrapper a bit more
        )
        out = result.stdout.strip()
        # Try to parse JSON
        try:
            return {"ok": True, "returncode": result.returncode, "data": json.loads(out), "stderr": result.stderr}
        except json.JSONDecodeError:
            return {"ok": True, "returncode": result.returncode, "data": {"raw_stdout": out[:2000]}, "stderr": result.stderr}
    except subprocess.TimeoutExpired as e:
        return {"ok": False, "error": f"timeout after {timeout}s", "stderr": str(e)}
    except Exception as e:  # pragma: no cover
        return {"ok": False, "error": str(e)}


def cmd_spawn(args) -> int:
    """Spawn a sub-agent to execute a picked backlog item."""
    b = load_backlog()
    items = b.get("items", [])
    target = next((it for it in items if it.get("id") == args.id), None)
    if not target:
        print(f"❌ {args.id} not found in backlog.")
        return 1

    if target.get("status") not in ("picked", "in_progress"):
        print(f"⚠️  {args.id} status is {target.get('status')}; spawn requires picked/in_progress.")
        print(f"   Run `nova-auto tick` first or `nova-auto start {args.id}`.")
        return 1

    # Update state to in_progress
    if target["status"] != "in_progress":
        target["status"] = "in_progress"
        target["started_at"] = dt.datetime.now().isoformat(timespec="seconds")
        save_backlog(b)
        log_line(f"START {args.id} (auto, before spawn)")

    # Ensure result directory
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    result_path = RESULTS_DIR / f"{args.id}.md"

    # Pick model
    model = args.model or model_for_category(target.get("category", ""))
    timeout = int(args.timeout or DEFAULT_SPAWN_TIMEOUT)

    # Build prompt
    prompt = build_subagent_prompt(target, result_path)

    # Save prompt to spawn queue for audit + replay
    SPAWN_QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    spawn_record = {
        "id": args.id,
        "spawned_at": dt.datetime.now().isoformat(timespec="seconds"),
        "model": model,
        "timeout": timeout,
        "result_path": str(result_path),
        "session_key": f"agent:main:auto-exec-{args.id.lower()}",
        "prompt_preview": prompt[:500],
    }
    spawn_file = SPAWN_QUEUE_DIR / f"{args.id}.json"
    spawn_file.write_text(json.dumps(spawn_record, indent=2, ensure_ascii=False))

    # Dry run mode: print command without executing
    if getattr(args, "dry_run", False):
        print(f"🔍 DRY RUN — would spawn:")
        print(f"   session_key: agent:main:auto-exec-{args.id.lower()}")
        print(f"   model:       {model}")
        print(f"   timeout:     {timeout}s")
        print(f"   result file: {result_path}")
        print(f"   prompt preview (first 500 chars):")
        print("   " + prompt[:500].replace("\n", "\n   "))
        return 0

    # Actually spawn
    spawn_result = run_openclaw_agent(prompt, args.id, model, timeout)

    if not spawn_result.get("ok"):
        log_line(f"SPAWN_FAIL {args.id}  error={spawn_result.get('error')}")
        print(f"❌ Spawn failed: {spawn_result.get('error')}")
        print(f"   Result file NOT created: {result_path}")
        print(f"   Item {args.id} still in_progress — retry with `nova-auto spawn {args.id}`")
        return 1

    log_line(f"SPAWN_OK {args.id}  returncode={spawn_result['returncode']}")
    target["spawned_at"] = dt.datetime.now().isoformat(timespec="seconds")
    target["spawn_model"] = model
    target["spawn_session_key"] = f"agent:main:auto-exec-{args.id.lower()}"
    save_backlog(b)

    print(f"🚀 SPAWNED: {args.id}")
    print(f"   Model:      {model}")
    print(f"   Timeout:    {timeout}s")
    print(f"   Session:    agent:main:auto-exec-{args.id.lower()}")
    print(f"   Result:     {result_path}")
    print()
    print("   Sub-agent will write its result to the file. Nova will pick it up via:")
    print(f"     nova-auto drain {args.id}")
    print(f"   Or run automatically on next heartbeat (watch + drain).")
    return 0


def cmd_watch(args) -> int:
    """Check for picked/in_progress items and spawn sub-agents if needed.

    Idempotent: items already with a recent spawn record are skipped.
    Safe to run from cron (every 5 min) — no picks happen here, only spawns.
    """
    b = load_backlog()
    items = b.get("items", [])
    SPAWN_QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    spawned = []
    skipped = []
    for it in items:
        if it.get("status") not in ("picked", "in_progress"):
            continue
        # Skip if a spawn record exists already (avoid double-spawn)
        spawn_file = SPAWN_QUEUE_DIR / f"{it['id']}.json"
        if spawn_file.exists():
            skipped.append(f"{it['id']} (already spawned)")
            continue
        # Skip if a result file exists (drain instead)
        result_file = RESULTS_DIR / f"{it['id']}.md"
        if result_file.exists():
            skipped.append(f"{it['id']} (result pending drain)")
            continue

        # Mark in_progress and spawn
        if it.get("status") != "in_progress":
            it["status"] = "in_progress"
            it["started_at"] = dt.datetime.now().isoformat(timespec="seconds")
        save_backlog(b)

        result_path = RESULTS_DIR / f"{it['id']}.md"
        model = model_for_category(it.get("category", ""))
        prompt = build_subagent_prompt(it, result_path)

        spawn_record = {
            "id": it["id"],
            "spawned_at": dt.datetime.now().isoformat(timespec="seconds"),
            "model": model,
            "timeout": DEFAULT_SPAWN_TIMEOUT,
            "result_path": str(result_path),
            "session_key": f"agent:main:auto-exec-{it['id'].lower()}",
            "prompt_preview": prompt[:500],
            "spawned_by": "watch",
        }
        spawn_file.write_text(json.dumps(spawn_record, indent=2, ensure_ascii=False))

        spawn_result = run_openclaw_agent(prompt, it["id"], model, DEFAULT_SPAWN_TIMEOUT)
        if spawn_result.get("ok"):
            it["spawned_at"] = spawn_record["spawned_at"]
            it["spawn_model"] = model
            it["spawn_session_key"] = spawn_record["session_key"]
            save_backlog(b)
            spawned.append(it["id"])
            log_line(f"WATCH_SPAWN {it['id']}  model={model}")
        else:
            log_line(f"WATCH_FAIL {it['id']}  error={spawn_result.get('error')}")

    print(f"👁  Watch run complete.")
    print(f"   Spawned: {len(spawned)}  — {spawned or 'none'}")
    print(f"   Skipped: {len(skipped)}  — {skipped[:5]}{'...' if len(skipped) > 5 else ''}")
    return 0


def cmd_drain(args) -> int:
    """Check for completed result files and update backlog items accordingly.

    For each item in picked/in_progress:
      - If a result file exists, parse it and mark done (or blocked) with evidence.
      - If NO result file and item has been in_progress > N minutes, optionally flag stale.
    """
    b = load_backlog()
    items = b.get("items", [])
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    drained = []
    pending = []
    now = dt.datetime.now()

    for it in items:
        if it.get("status") not in ("picked", "in_progress"):
            continue
        result_file = RESULTS_DIR / f"{it['id']}.md"
        if not result_file.exists():
            # Check staleness
            started = it.get("started_at") or it.get("picked_at")
            if started:
                try:
                    age_min = (now - dt.datetime.fromisoformat(started)).total_seconds() / 60
                    if age_min > 30:
                        pending.append(f"{it['id']} (in_progress {age_min:.0f}min, no result yet)")
                    else:
                        pending.append(f"{it['id']} (in_progress {age_min:.0f}min)")
                except Exception:
                    pending.append(f"{it['id']} (no result yet)")
            continue

        # Read result file
        content = result_file.read_text()
        status = "done"
        if "## Status" in content:
            for line in content.split("\n"):
                if line.strip().startswith("## Status"):
                    continue
                s = line.strip().lower()
                if s in ("done", "blocked", "partial"):
                    status = s
                    break

        # Extract summary as evidence
        evidence = ""
        if "## Summary" in content:
            lines = content.split("## Summary", 1)
            if len(lines) > 1:
                tail = lines[1].split("## Evidence", 1)[0] if "## Evidence" in lines[1] else lines[1]
                evidence = tail.strip()[:500]

        it["status"] = "done" if status == "done" else status
        it["completed_at"] = now.isoformat(timespec="seconds")
        it["evidence"] = evidence
        it["result"] = status
        it["result_file"] = str(result_file)
        save_backlog(b)
        drained.append(f"{it['id']} → {status}")
        log_line(f"DRAIN {it['id']} → {status}  evidence={evidence[:120]}")

    print(f"🚰 Drain run complete.")
    print(f"   Drained: {len(drained)}  — {drained or 'none'}")
    print(f"   Pending: {len(pending)}  — {pending[:5]}{'...' if len(pending) > 5 else ''}")
    if args.id:
        # Filter to specific id if requested
        print(f"   Filtered to id={args.id}: {'matched' if any(args.id in d for d in drained) else 'no match'}")
    return 0

def main() -> int:
    p = argparse.ArgumentParser(
        prog="nova-auto",
        description="Nova Auto-Executor — goal queue + auto-pick pattern",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="List all backlog items grouped by status").set_defaults(func=cmd_list)
    p_tick = sub.add_parser("tick", help="Pick the next eligible item (rate-limited 3/day)")
    p_tick.add_argument("--spawn", action="store_true", help="Auto-spawn sub-agent after pick (Tier 2)")
    p_tick.set_defaults(func=cmd_tick)
    sub.add_parser("state", help="Show executor state + counts").set_defaults(func=cmd_state)
    sub.add_parser("watch", help="Spawn sub-agents for any picked/in_progress items without active spawn").set_defaults(func=cmd_watch)
    p_drain = sub.add_parser("drain", help="Read result files from sub-agents and update backlog")
    p_drain.add_argument("--id", help="Drain only a specific item id")
    p_drain.set_defaults(func=cmd_drain)

    p_spawn = sub.add_parser("spawn", help="Spawn sub-agent to execute a picked item")
    p_spawn.add_argument("id", help="Item id (must be picked or in_progress)")
    p_spawn.add_argument("--timeout", type=int, default=DEFAULT_SPAWN_TIMEOUT, help="Sub-agent timeout (seconds)")
    p_spawn.add_argument("--model", help="Override model id (default: category-based)")
    p_spawn.add_argument("--dry-run", action="store_true", help="Print what would happen without spawning")
    p_spawn.set_defaults(func=cmd_spawn)

    p_add = sub.add_parser("add", help="Add a new backlog item")
    p_add.add_argument("title", help="Item title")
    p_add.add_argument("--risk", choices=["low", "medium", "high"], default="low")
    p_add.add_argument("--effort", choices=["small", "medium", "large"], default="small")
    p_add.add_argument("--category", default="misc")
    p_add.add_argument("--approval", choices=["none", "required"], default="none")
    p_add.add_argument("--source", help="Source file or URL")
    p_add.add_argument("--notes", help="Free-form notes")
    p_add.set_defaults(func=cmd_add)

    p_start = sub.add_parser("start", help="Mark item as in_progress")
    p_start.add_argument("id")
    p_start.set_defaults(func=cmd_start)

    p_done = sub.add_parser("complete", help="Mark item as done with evidence")
    p_done.add_argument("id")
    p_done.add_argument("--evidence", required=True, help="What you did + verification")
    p_done.add_argument("--result", help="Optional: done | partial | blocked")
    p_done.set_defaults(func=cmd_complete)

    p_skip = sub.add_parser("skip", help="Skip an item with a reason (or block)")
    p_skip.add_argument("id")
    p_skip.add_argument("--reason", required=True)
    p_skip.add_argument("--block", action="store_true", help="Mark as blocked instead of skipped")
    p_skip.set_defaults(func=cmd_skip)

    args = p.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())