# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics, the stuff unique to this setup.

## OpenClaw
- Workspace: `/Users/nova/.openclaw/workspace`
- Main config: `/Users/nova/.openclaw/openclaw.json`
- Docs root: `/opt/homebrew/lib/node_modules/openclaw/docs`
- Support engineering skill: `/Users/nova/.openclaw/workspace/skills/support-engineering`
- Support/RCA automation skill: `/Users/nova/.openclaw/workspace/skills/support-rca-automation`
- Specialist prompt templates: `/Users/nova/.openclaw/workspace/prompts/`

## GitHub / Deploy Targets
- Default GitHub for app/code projects: `https://github.com/novaosai-lab`
- Default Vercel team/account for web deploys: `https://vercel.com/novaosai-8183s-projects`
- Default Supabase project for apps that need a database: `https://supabase.com/dashboard/project/ijqhoovvcsjmnacbdgvt`
- For future app/web work, prefer this GitHub + Vercel pair as the default build/deploy path unless พี่นิค specifies otherwise
- If a project needs a hosted database/backend, prefer this Supabase project unless พี่นิค specifies a different one

## n8n
- n8n runs in Docker
- Main port: `5678`
- Workflow folder: `/Users/nova/.openclaw/workspace/n8n`
- n8n timezone matters for schedule triggers, prefer `Asia/Bangkok`
- n8n in this setup may deny `$env` access in node expressions, hardcoded values or credentials may be needed

## Android / Mobile Testing
- Android Studio installed at `~/Applications/Android Studio.app`
- `studio` launcher available on PATH
- Android SDK root: `/Users/nova/Library/Android/sdk`
- `adb`: `/Users/nova/Library/Android/sdk/platform-tools/adb`
- `emulator`: `/Users/nova/Library/Android/sdk/emulator/emulator`
- Tested app package: `com.amaze.superapp`
- Screenshots folder: `/Users/nova/.openclaw/workspace/screenshots`
- APKPure XAPK for Amaze showed 16 KB compatibility warnings and the app closed itself on Android 15/16/17 emulators

## Current working areas
- OpenClaw Guard Agent watchdog: script `/Users/nova/.openclaw/workspace/guard-agent/openclaw_guard.py`, LaunchAgent `~/Library/LaunchAgents/ai.openclaw.guard-agent.plist`, log `/Users/nova/.openclaw/workspace/logs/openclaw-guard.log`; runs every 5 minutes and rate-limits gateway/node restarts to max 2 per 30 minutes
- **Launcher Watchdog** (NEW 2026-06-12, **KeepAlive refactor 2026-06-15**): `grafana-openclaw-bridge/launcher_watchdog.py` + `bin/launcher-watchdog` + plist `ai.openclaw.launcher-watchdog.plist`; monitors coupon-points + discord-prod-order LaunchAgents for silence, auto-reloads on stall, sends Google Chat alert (prefix `🚨 Watchdog:`). **All three agents (watchdog, discord-prod-order-forwarder, coupon-points-issue-alert) now use the same `KeepAlive` + `bin/loop-runner.sh` pattern** to bypass a macOS launchd `gui/501` interval-scheduler bug (see "LaunchAgents: KeepAlive + loop-runner pattern" below).
- Nova Ops Dashboard: `/Users/nova/.openclaw/workspace/nova-ops-dashboard`, LaunchAgent `~/Library/LaunchAgents/ai.openclaw.nova-ops-dashboard.plist`, local URL `http://127.0.0.1:18888`; read-only dashboard for Gateway/Node/Guard/channels/tasks/cron/Docker/Harness plus Support Digest surface. Support digest endpoint: `/api/support-digest`, optional `?refresh=1` pulls Google Sheet data through local `.venv-google` into `public/data/support_digest.json`.
- Nova Ops model quota pages: Codex quota at `/api/codex-quota`; Gemma fallback quota at `/api/gemma-quota` for `google/gemma-4-31b-it` / alias `gemma-4-31b`. Google AI Studio does not expose exact remaining quota through the probed API, so the card shows auth/API/model readiness plus local Nova usage. Use Gemma as fallback when `openai-codex` quota is exhausted, not as the default Nova model.
- Nova Mobile Web: `/Users/nova/.openclaw/workspace/nova-mobile-web`, local test URL `http://127.0.0.1:18910`; first-party mobile/PWA client surface with Chat/Sessions/System tabs, read-only session history/status, browser speech-recognition push-to-talk, and Nova bridge message sending. Direct gateway-native auth/control is still future work.
- AI Town is **intentionally disabled** as of 2026-05-31 per Nick's instruction: repo `/Users/nova/.openclaw/workspace/ai-town` and LaunchAgent `~/Library/LaunchAgents/ai.openclaw.ai-town.plist` exist but `Disabled=true`; Convex backend/dashboard use local Docker ports `3210`, `3211`, and `6791` (not currently running). **Do not assume port 19000 is in use** — always check `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:19000/` and `pgrep -f ai-town` before any work that depends on agent-office surface. Star Office UI remains preserved at `/Users/nova/.openclaw/workspace/external/Star-Office-UI`, but its LaunchAgent is disabled so it does not reclaim port 19000. Claw3D repo remains at `/Users/nova/.openclaw/workspace/external/Claw3D` with local modifications preserved, but its LaunchAgents were stopped.
- Star Office state helper: `/Users/nova/.openclaw/workspace/bin/star-office-state <idle|writing|researching|executing|syncing|error> "detail"`; best-effort wrapper around `external/Star-Office-UI/set_state.py`.
- Nova Voice / OmniVoice sandbox: `/Users/nova/.openclaw/workspace/nova-voice`, CLI `/Users/nova/.openclaw/workspace/nova-voice/nova-voice`, Telegram sender `/Users/nova/.openclaw/workspace/nova-voice/nova-voice-send`, mode toggle `/Users/nova/.openclaw/workspace/nova-voice/nova-voice-mode` with state `state.json` (current mode auto, Sample 1 / female young adult low pitch), local STT `/Users/nova/.openclaw/workspace/nova-voice/nova-transcribe` using whisper-cpp `ggml-small.bin`, venv Python 3.12, Apple Silicon MPS enabled; verified sample `output/nova-thai-test.wav`
- Nova Harness: `/Users/nova/.openclaw/workspace/nova-harness/nova-harness check`; verifies OpenClaw, Guard, Dashboard, Voice mode, local STT/TTS, commute cron, repo-pack safety, Skill OS lifecycle, improvement-loop report, Google Sheets schema contract, Grafana dashboard artifact, and Support Digest web data. Latest recorded full check passed 14/14 on 2026-05-15.
- n8n workflows for Google Sheet -> OpenClaw -> Google Chat digests
- OpenClaw gateway and local automation setup
- Mobile app testing via emulator + adb
- Support/RCA automation safety notes: `playbooks/support-ai-rca-guardrails.md` and `playbooks/safe-github-workflow-adaptation.md`
- Grafana OpenClaw bridge: `/Users/nova/.openclaw/workspace/grafana-openclaw-bridge`; private per-project env files are `.env.phoenix` and `.env.amaze` (do not copy tokens into memory/docs). MCP wrappers: `run-mcp-grafana-phoenix.sh`, `run-mcp-grafana-amaze.sh`. Phoenix direct API verified on 2026-05-21; Amaze API returned Cloudflare/Grafana HTTP 403 from this environment, but the Prod HPC digest cron is configured to prefer `.env.amaze` through `GRAFANA_ENV_FILE`.
- Fund/investment brief project: `/Users/nova/.openclaw/workspace/fund-research-assistant`
- Thai lottery 2-digit statistical analyzer: `/Users/nova/.openclaw/workspace/lottery-2digit` (guardrail: entertainment/statistical analysis only; use backtest/simulation reports before recommendations)
- Shopee Affiliate Ops: `/Users/nova/.openclaw/workspace/shopee-affiliate-automation`, LaunchAgent `~/Library/LaunchAgents/ai.openclaw.shopee-affiliate-automation.plist`, local URL `http://127.0.0.1:18920`; supports Shopee link intake -> Google Sheet queue -> AI storyboard -> local MP4 draft with no publish/upload step. Shopee anti-bot blocks metadata often, so prefer user-supplied product name/image fallback when needed.
- Safe repo packing wrapper: `/Users/nova/.openclaw/workspace/bin/nova-pack-repo`; uses Repomix with remote fetch disabled, broad secret/media/memory/build ignores, and post-output secret-pattern quarantine to `*.unsafe`. Use this before sharing compact local repo context.
- Cheap public repo reader lane: `/Users/nova/.openclaw/workspace/bin/nova-cheap-repo-reader prepare <public-github-url>`; clones only plain public GitHub repo URLs into `tmp/cheap-repo-reader/`, runs `nova-pack-repo`, and outputs a sanitized pack for low-cost/read-only subagents. Prompt: `prompts/repo-reader-cheap-specialist.md`; provider radar: `research/free-llm-provider-allowlist.md`. If pack becomes `*.unsafe`, do not send to cheap subagent without manual review.
- Nova memory index: `/Users/nova/.openclaw/workspace/bin/nova-memory-index`; local-only SQLite retrieval helper over approved memory/docs/research files. Commands: `nova-memory-index rebuild`, `nova-memory-index stats`, `nova-memory-index query "..." [--limit N] [--type tool|profile|...] [--category ...] [--json]`. DB: `tmp/nova-memory-index/memory.sqlite`, manifest: `tmp/nova-memory-index/manifest.json`, implementation: `tools/nova_memory_index.py`. No cloud/API/LLM calls and does not write to `MEMORY.md`; use as first-pass recall before reading large memory files.
- JobSpy sandbox: venv `/Users/nova/.openclaw/workspace/jobspy-sandbox` uses Python 3.12 and package `python-jobspy==1.1.82`; verified 2026-05-22 with a low-volume Indeed Thailand scrape. Guardrail: run low frequency/results, no login/captcha bypass, no aggressive proxy rotation unless explicitly approved.
- JobSpy UI: local Flask app `/Users/nova/.openclaw/workspace/jobspy-ui`, URL `http://127.0.0.1:18930`; supports source/keyword/location filters, table results, and CSV export. Start with `/Users/nova/.openclaw/workspace/jobspy-sandbox/bin/python /Users/nova/.openclaw/workspace/jobspy-ui/app.py`.
- BillVault / monthly bill app: source `/Users/nova/.openclaw/workspace/Monthly Bill Expense Tracker`; local LaunchAgent `~/Library/LaunchAgents/ai.openclaw.billvault.plist`; local URL `http://127.0.0.1:18940`; public tunnel `https://app.novaosai.work` routes to local port `18940` through `~/.cloudflared/config.yml`. พี่นิค explicitly said to stop using Vercel production for this app and use the local machine instead.
- Team Leave Management app: source `/Users/nova/.openclaw/workspace/team-leave-management`; local URL `http://127.0.0.1:18950`; Google Sheet `1o0Tgo7Rjh-iwNwlUWDagfZozZ-qu06VhabfZDbD1fU8`; Apps Script Web App configured in local `.env`; Google Chat leave summary job LaunchAgent `~/Library/LaunchAgents/ai.openclaw.team-leave-google-chat.plist` runs Mon-Fri 08:30 using `.venv-google`, config `.env.google-chat`, state `.leave-chat-notify-state.json`, logs `logs/google-chat-leave-job.log`.
- Meeting AI Recorder prototype: source `/Users/nova/.openclaw/workspace/meeting-ai-recorder`, local URL `http://127.0.0.1:18960`, public URL `https://app.novaosai.work/voice-meeting/`; LaunchAgent `~/Library/LaunchAgents/ai.openclaw.meeting-ai-recorder.plist`; Cloudflare Tunnel path rule in `~/.cloudflared/config.yml`; browser MediaRecorder microphone capture -> local WebM/WAV files under `data/recordings/` -> local `nova-voice/nova-transcribe` Whisper STT -> local heuristic meeting summary. No external LLM/cloud sync enabled in v0.1.
- Investment Analyst app: source `/Users/nova/.openclaw/workspace/investment analyst`, local URL `http://127.0.0.1:18970/invest/`, public URL `https://app.novaosai.work/invest/`; LaunchAgent `~/Library/LaunchAgents/ai.openclaw.investment-analyst.plist`; Cloudflare Tunnel path rule in `~/.cloudflared/config.yml`; Vite base is `/invest/` and preview allows host `app.novaosai.work`.

---

Keep this file practical. Add paths, aliases, device names, and setup facts that save time later.
## Nova Skill OS
- Roadmap: `/Users/nova/.openclaw/workspace/ideas/nova-skill-os-roadmap.md`
- Registry: `/Users/nova/.openclaw/workspace/nova-skill-os/skills.json`
- Command runner: `/Users/nova/.openclaw/workspace/nova-skill-os/nova_skill_os.py`
- Command routing notes: `/Users/nova/.openclaw/workspace/nova-skill-os/telegram-discord-command-routing.md`
- MVP commands: `/nova-skills`, `/alert-dashboard`, `/alert-summary`, `/openclaw-health`

## Nova Auto-Executor (Goal Queue + Auto-Pick) — NEW 2026-06-21
Implements "backlog -> Nova picks + executes when idle" loop. Replaces manual scanning of multiple backlog files.

- **CLI wrapper:** `/Users/nova/.openclaw/workspace/bin/nova-auto` (Python 3.14 stdlib only)
- **Engine:** `/Users/nova/.openclaw/workspace/nova-skill-os/auto_executor.py` (~500 lines, no external deps)
- **Backlog (single source of truth):** `/Users/nova/.openclaw/workspace/nova-skill-os/backlog.json` (JSON, stdlib only)
- **State (rate limit + runs):** `~/.openclaw/state/auto-executor/state.json`
- **Log (append-only):** `/Users/nova/.openclaw/workspace/logs/auto-executor.log`
- **Spawn queue:** `~/.openclaw/state/auto-executor/spawn-queue/<id>.json` (sub-agent spawn audit)
- **Result files:** `~/.openclaw/state/auto-executor/results/<id>.md` (sub-agent output)
- **Heartbeat integration:** `HEARTBEAT.md` "Auto-executor integration (2026-06-21)" section

**Tier 1 commands (manual execution):**
- `nova-auto list` — show all items grouped by status with 🔒/⚠️/✅ markers
- `nova-auto state` — show today/weekday theme + picks used + counts
- `nova-auto tick` — pick next eligible item (rate-limited 3/day, max 1/heartbeat)
- `nova-auto add "Title" --risk low|medium|high --effort small|medium|large --category X --approval none|required --source PATH --notes "..."` — add item
- `nova-auto start <id>` — mark in_progress (when Nova actually begins work)
- `nova-auto complete <id> --evidence "what you did + verification"` — mark done
- `nova-auto skip <id> --reason "..."` or `--block` — mark skipped/blocked

**Tier 2 commands (sub-agent execution — NEW 2026-06-21):**
- `nova-auto spawn <id>` — spawn isolated sub-agent via `openclaw agent --session-key agent:main:auto-exec-<id>` (model auto-selected by category)
- `nova-auto spawn <id> --dry-run` — preview prompt + metadata without spawning
- `nova-auto spawn <id> --model <id>` — override default model
- `nova-auto spawn <id> --timeout <seconds>` — override default 300s timeout
- `nova-auto watch` — idempotent sweep: spawn sub-agents for picked/in_progress items without spawn record (safe to cron every 5 min)
- `nova-auto drain [--id <id>]` — read result files, mark backlog done/blocked with evidence parsed from result

**Sub-agent lifecycle:**
1. `tick` → item marked `picked`
2. `start` (auto inside `spawn`) → `in_progress`, spawn queue record created
3. `spawn` → `openclaw agent --session-key agent:main:auto-exec-<id> --message "<full prompt>" --model <category-based> --thinking low --timeout 300`
4. Sub-agent writes result to `~/.openclaw/state/auto-executor/results/<id>.md` with Status=done|partial|blocked
5. `drain` reads result file, parses Status, marks backlog done (or blocked/partial)
6. Audit trail: spawn queue + result file + log all linked by `<id>`

**Sub-agent constraints (enforced in prompt):**
- DO NOT install packages, enable services, modify system configs
- DO NOT touch secrets, tokens, credentials
- DO NOT send external messages (no Telegram/Discord/email)
- DO NOT delete files
- Time budget tight: smallest useful result, not exhaustive
- When blocked/risky: write status=blocked in result file with explanation, stop

**Tier 3 — Autonomous cron (NEW 2026-06-22):**
Cron job runs the auto-executor every 5 minutes and notifies Nick on Telegram:
- Cron job: `nova-auto-tick-cron` (id `7bb67006-36b2-457d-a50e-2a1ed165857d`)
- Schedule: `*/5 * * * * @ Asia/Bangkok` (30s stagger to avoid boundary collisions)
- Wrapper: `/Users/nova/.openclaw/workspace/bin/nova-auto-tick-cron.sh` — runs tick → watch → drain, writes `/tmp/nova-auto-cron-results.json` (JSON envelope of new results + picks)
- Sub-agent: isolated agentTurn reads envelope, composes concise Thai message, sends via `bin/nova-telegram-send`. **Idle (no done/blocked) = no notification, just reply "idle: ok".**
- Models: cron sub-agent = `MiniMax-M3` (compose + deliver); task sub-agent = `MiniMax-M2.7-highspeed` (cheap research/learning/cleanup/memory) | `MiniMax-M3` (skill-os/automation)
- Failure path: if cron sub-agent fails 3x in a row, `failureAlert` sends Telegram via `failureDestination`. Wrapper also logs to `logs/auto-executor-cron.log`.
- Manual verify: `openclaw cron runs --id 7bb67006-36b2-457d-a50e-2a1ed165857d --limit 10` (look for `summary: "sent: ok"` vs `"idle: ok"`)
- Disable temporarily: `openclaw cron disable 7bb67006-36b2-457d-a50e-2a1ed165857d`

**Tier 3 + Self-Heal Pipeline (NEW 2026-06-22 02:30):**
Cron sub-agent also runs `bin/nova-self-heal.sh` BEFORE notifying — known-failure-pattern auto-recovery:
- **Patterns supported (v1):**
  - `launchagent_silent` — LaunchAgent dead → `kickstart -k` (idempotent, mapped job-name → plist-label)
  - `cloudflared_dead` — process down → kickstart + verify metrics endpoint `http://127.0.0.1:20241/metrics`
  - `line_bridge_dead` → kickstart (KeepAlive auto-restarts thereafter)
  - `envelope_stale` — 3+ consecutive idle runs while backlog has eligible items → manual `nova-auto tick`
- **Capped retry:** max 2 heal attempts per pattern per hour (prevents storm)
- **Safety:** no deletions, no config changes, no `disable` — only `kickstart -k` + `nova-auto tick` (reversible)
- **Heal state:** `~/.openclaw/state/auto-executor/heal-state.json` (JSON: heals list + last_reset ISO timestamp)
- **Heal log:** `grep self-heal /Users/nova/.openclaw/workspace/logs/auto-executor-cron.log`
- **Verify recovery:** `cat ~/.openclaw/state/auto-executor/heal-state.json | jq .heals` shows recent outcomes
- **Notify format:** `🔧 self-heal: N attempts, S ok, F failed, C capped` per pattern item
- **Unknown patterns:** logged + escalated in notify (manual intervention needed)

**Pick rules (enforced inside `auto_executor.py:eligible_items()`):**
- status=pending AND approval=none AND risk ∈ {low, medium}
- effort=small → eligible every day (heartbeat/cleanup pattern)
- effort=medium → eligible only when category matches today's weekday theme
- effort=large → NEVER auto-pick (must be human-initiated, multi-hour work)
- category=memory → always eligible (Sunday memory cleanup bias is core to the loop)
- DAILY_PICK_LIMIT=3, resets at midnight local time

**Weekday themes (in `auto_executor.py:WEEKDAY_THEMES`):**
- Monday → safety, governance, memory
- Tuesday → support, rca, memory
- Wednesday → automation, n8n, skill-os
- Thursday → skill-os, routing, memory
- Friday → dashboard, observability, memory
- Saturday → research, learning, memory
- Sunday → memory, cleanup, research

**Sub-agent model selection (in `auto_executor.py:model_for_category()`):**
- research, learning, cleanup, memory → `minimax-portal/MiniMax-M2.7-highspeed` (cheap)
- everything else → `minimax-portal/MiniMax-M3` (main)

**Safety constraints (enforced):**
- approval=required items are NEVER auto-picked (must be human-initiated)
- risk=high items are NEVER auto-picked
- Large-effort items are NEVER auto-picked
- All actions append-only on backlog.json with timestamped state transitions
- Logs include `picked_at`, `started_at`, `spawned_at`, `completed_at`, `evidence`, `result_file` for full audit trail
- Sub-agent cannot send to user; all output goes to result file (no `--deliver` flag)
- Sub-agent budget: 300s default timeout per item (configurable via `--timeout`)

**Status flow:** `pending` → `picked` (tick) → `in_progress` (start) → `done` | `skipped` | `blocked` (complete/skip/drain)

**Operational notes:**
- Compatible with KeepAlive + loop-runner pattern: `watch` can be wrapped as a LaunchAgent if needed, but heartbeat integration is preferred (cheaper, simpler, human-in-loop safety)
- Companion `nova-skill-os/backlog.md` is kept as human-readable archive; do not delete — it documents intent behind backlog items
- When picking large-effort items: re-add them as multiple small-effort items or split into phases before next tick
- Sub-agent sessions live in OpenClaw session store at `/Users/nova/.openclaw/agents/main/sessions/<uuid>.jsonl` — inspect via `openclaw sessions tail --session-key agent:main:auto-exec-<id>`
- Cost per sub-agent run: ~$0.01-0.10 depending on task complexity (verified 2026-06-21 with B-006 research item, ~$0.04 total)


## Trading Skills
→ See skill: `trading-skills-index`

## Chrome DevTools MCP
→ See skill: `chrome-devtools-mcp`

## Nova Operating Playbooks
→ See skill: `nova-playbooks`

## Launcher Watchdog (2026-06-12, KeepAlive refactor 2026-06-15)
- Script: `/Users/nova/.openclaw/workspace/grafana-openclaw-bridge/launcher_watchdog.py` + shell wrapper `/Users/nova/.openclaw/workspace/bin/launcher-watchdog`
- LaunchAgent: `~/Library/LaunchAgents/ai.openclaw.launcher-watchdog.plist` (`KeepAlive` + `SuccessfulExit=false` + `ThrottleInterval=10` + `ProcessType=Background`; internal `CHECK_INTERVAL_SECONDS=60` loop)
- State: `~/.openclaw/state/launcher-watchdog/state.json`
- Logs: `~/.opennova/.openclaw/workspace/logs/launcher-watchdog.{out,err}.log`
- Env: `grafana-openclaw-bridge/.env.launcher-watchdog` (reuses `COUPON_POINTS_GOOGLE_CHAT_WEBHOOK` by default)
- Monitors: `coupon-points-issue-alert` (silent > 6h) + `discord-prod-order-forwarder` (silent > 10 min) + `line-native-channel`
- Behavior: `main()` runs a `while _RUNNING: ... time.sleep(1)` loop with `_RUNNING` toggled by `SIGTERM`/`SIGINT` handler. Each cycle checks silence (oldest of out.log, state files) → auto-reloads silent LaunchAgent (bootout+bootstrap) → sends prefixed Google Chat alert (`🚨 Watchdog: <name> silent for Xh — ✅ reloaded | ❌ recovery failed`)
- Rate limits: max 3 auto-recoveries/hour, alert cooldown 30 min, fallback to "manual intervention needed" message when exhausted
- Verified 2026-06-15: detected 40h silence (the original 2026-06-12 25h/40h test predated the launchd bug). Now runs continuously at 60s cycle, healthy after KeepAlive refactor.

## LaunchAgents: KeepAlive + loop-runner pattern (2026-06-15)
**Problem:** macOS launchd `gui/501` domain has a bug where it fires the interval event but does NOT actually spawn the process (`pending spawn, domain in on-demand-only mode` followed by `interval event: domain response: 36` / XPC error). `StartInterval` + `RunAtLoad` plists with one-shot scripts ran once and then never again.

**Workaround:** Convert all monitoring LaunchAgents to `KeepAlive=true` + `SuccessfulExit=false` + an internal sleep loop. launchd only needs to spawn the process ONCE; afterwards it just keeps the same PID alive.

**Files (canonical pattern):**
- `bin/loop-runner.sh` — generic bash wrapper, takes `<interval-seconds> <command...>`, runs command in `while true; do "$@"; sleep N; done`, traps SIGTERM/SIGINT for graceful exit, slices sleep into 1s steps for quick signal response.
- `grafana-openclaw-bridge/launcher_watchdog.py` — Python daemon, `main()` wraps logic in `while _RUNNING: ... time.sleep(1)`; `_RUNNING` flipped by signal handler.
- 3 × `Library/LaunchAgents/ai.openclaw.{coupon-points-issue-alert,discord-prod-order-forwarder,launcher-watchdog}.plist` — all use `KeepAlive` + `ThrottleInterval=10` + `ProcessType=Background`.

**Apply / restart procedure (because launchd won't auto-spawn even with KeepAlive on a fresh bootstrap — the spawn is the broken step):**
1. `launchctl bootout gui/$UID <plist>` (ignore "not loaded" error)
2. `launchctl bootstrap gui/$UID <plist>` (registers, marks `pended = semaphore`)
3. `launchctl kickstart -k gui/$UID/<label>` (FORCES initial spawn, then KeepAlive keeps it alive)
4. Verify: `launchctl print gui/$UID/<label> | grep "active count"` should show `1` and `state = running` indefinitely

**Recovery from the bug:** if a `KeepAlive` agent is in `state = not running` with `runs = 0`, the bootstrap didn't trigger a real spawn. Run step 3 above to force.

**Backups** of pre-refactor plists + Python script live at `/Users/nova/.openclaw/workspace/.backups/2026-06-15-launchd-fix/`.

## discord-prod-order-forwarder: OpenClaw CLI JSON parser must tolerate warnings + truncation (2026-06-16)
- **Script:** `discord-alert-forwarder/forward_prod_order_alerts.py` (NOT in `grafana-openclaw-bridge/`)
- **LaunchAgent plist:** `~/Library/LaunchAgents/ai.openclaw.discord-prod-order-forwarder.plist`
- **Logs:** `/tmp/openclaw-discord-prod-order-forwarder.{out,err}.log` (launchd's stdout/stderr paths, NOT `grafana-openclaw-bridge/logs/...`)
- **Channel ID:** `1296444565708079154`; default `--limit 15`
- **Bug class:** `load_openclaw_json()` (line ~65) used `raw.find("{")` + `json.loads(raw[start:])` which fails when:
  1. OpenClaw CLI emits `[state-migrations]` warning prefix before JSON (always now)
  2. Output is large enough that the JSON truncates mid-message (saw char 64926 / line 1416 → `Expecting property name` error). Triggered 8h of consecutive rc=1 cycles starting 2026-06-15 22:41:31.
- **Fix (2026-06-16):** rewrote `load_openclaw_json` to (a) try direct parse, (b) `json.JSONDecoder().raw_decode()` from any `{` (handles warning prefix + trailing garbage), (c) `_recover_truncated_openclaw_json()` walks `\n        }\n` message-close boundaries, prepends `]\n      }\n    }\n  }\n}` to synth a valid closing. If all fails, raises `openclaw_json_unparseable` with size+line info.
- **Verify after change:** `python -c "import importlib.util; ..."` with 3 synthetic inputs (clean / truncated at 64926 / warning+garbage) — all 3 returned 15 messages.
- **Restart:** `launchctl bootout gui/$UID ai.openclaw.discord-prod-order-forwarder; launchctl bootstrap gui/$UID ~/Library/LaunchAgents/ai.openclaw.discord-prod-order-forwarder.plist; launchctl kickstart -k gui/$UID/ai.openclaw.discord-prod-order-forwarder`. Recovery: cycle 1+2 rc=0, read=15, collected=0.
- **Backup:** `~/.openclaw/workspace/.backups/forward_prod_order_alerts.py.2026-06-16.bak`
- **Watchdog behavior:** when silent > 10 min, launcher_watchdog auto-recovers (bootout+bootstrap). With the parser fix this should no longer fire, but the watchdog is the safety net.

## Coupon-points Quickwit query: use `requests`, not `urllib.request` (2026-06-15)
**Bug:** Python 3.14 + `urllib.request.urlopen` raises `LookupError: unknown encoding: idna` for non-ASCII / IDN hostnames (the internal Quickwit datasource `internal-api.amaze.shop` triggers it). The `requests` library handles the same hosts cleanly.

**Fix applied** in `grafana-openclaw-bridge/coupon_points_issue_alert.py`:
- Replaced `urllib.request.Request` + `urllib.request.urlopen` with `requests.get` / `requests.post` for both the Quickwit search call and the Google Chat webhook POST.
- Wrapped in `try/except requests.exceptions.RequestException` so failures raise a clear `RuntimeError` instead of the cryptic `LookupError`.
- All existing env + state + sheet logic unchanged.

## OpenClaw Learning References
→ See skill: `openclaw-learning-references`

## Public Cloudflare Tunnel Targets
- Nova Auto: `auto.novaosai.work` → local port `18891`
- LINE webhook: `line.novaosai.work` → local port `18789`
- Trade service: `trade.novaosai.work` → local port `8000`
- OpenClaw OS public shortcut: `https://app.novaosai.work/os` → local redirect helper `127.0.0.1:18980` → `https://line.novaosai.work/plugins/openclawos/setup#gateway=wss://line.novaosai.work&token=...`; helper source `/Users/nova/.openclaw/workspace/openclaw-os-public/os_redirect.py`, LaunchAgent `~/Library/LaunchAgents/ai.openclaw.openclaw-os-public.plist`. Use the `line.novaosai.work` origin because OpenClaw OS expects same-origin gateway WebSocket. Cloudflared LaunchAgent must run `cloudflared tunnel --config /Users/nova/.cloudflared/config.yml run ai-trading-bot`.

## Nova Auto Bridge
- Source: `/Users/nova/.openclaw/workspace/android-auto-lab/nova-auto-assistant/bridge`
- LaunchAgent: `~/Library/LaunchAgents/ai.openclaw.nova-auto-bridge.plist`
- Public URL: `https://auto.novaosai.work`
- Protected endpoint `POST /message` requires `X-Nova-Token` from bridge `.env.local`
- Logs: `logs/nova-auto-bridge.out.log`, `logs/nova-auto-bridge.err.log`

## Legacy LINE Webhook
- Deprecated ngrok URL (retire after `line.novaosai.work` is live): `https://quintet-fernlike-placidly.ngrok-free.dev/line/webhook`
