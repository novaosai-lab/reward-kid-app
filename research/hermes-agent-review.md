# Hermes Agent repo review

Date: 2026-05-15
Repo: https://github.com/NousResearch/hermes-agent
Local clone: `/Users/nova/.openclaw/workspace/external/hermes-agent`
Commit reviewed: `d364132`
Mode: read-only clone; no install/build/run executed.

## Metadata snapshot

- Owner/repo: `NousResearch/hermes-agent`
- Description: “The agent that grows with you”
- License: MIT
- Stars observed via GitHub CLI: 150,592
- Forks observed via GitHub CLI: 23,854
- Default branch: `main`
- Last pushed: 2026-05-15T03:27:56Z

## What it is

Hermes Agent is a Python-based self-improving personal agent platform from Nous Research. It emphasizes:

- Closed learning loop: memory, session search, skill creation, skill self-improvement, curator.
- Multi-surface gateway: CLI/TUI plus Telegram, Discord, Slack, WhatsApp, Signal, Email, and more.
- Built-in cron scheduler with platform delivery.
- Subagents / delegation and RPC-style tool use from scripts.
- Multiple terminal backends: local, Docker, SSH, Singularity, Modal, Daytona, Vercel Sandbox.
- Research tooling: batch trajectories, Atropos RL environments, trajectory compression.
- Migration path from OpenClaw (`hermes claw migrate`).

## Repository shape

Observed rough size:

- Python files: 1,693
- Python LOC: ~815k
- Tests: 1,071 `test_*.py` files
- Skills: 166 `SKILL.md` files across `skills/` and `optional-skills/`
- Plugin directories: ~77 under `plugins/`
- CI workflows include lint, tests, OSV scanner, supply-chain audit, uv lockfile check, docs checks, Docker publish, Nix.

Important files/modules:

- `run_agent.py` — AIAgent / core conversation loop.
- `model_tools.py` — tool orchestration and function-call handling.
- `toolsets.py` — toolset definitions.
- `cli.py` — interactive CLI.
- `hermes_state.py` — SQLite session store with FTS5.
- `gateway/` — messaging gateway and platform adapters.
- `cron/` — scheduler and jobs.
- `agent/memory_manager.py` — memory provider orchestration.
- `agent/curator.py` — background skill maintenance.
- `agent/tool_guardrails.py` — tool-loop guardrail primitives.
- `agent/file_safety.py` — write denylist and safe write root.
- `agent/redact.py` — secret redaction.
- `skills/`, `optional-skills/`, `plugins/` — large extension surface.
- `tools/environments/` — terminal backend implementations.

## Strong ideas to adapt into Nova/OpenClaw

1. **Closed learning loop with hard guardrails**
   - Hermes has memory, skill creation, skill improvement, and curator.
   - Nova already has memory maintenance and skills. The safe adaptation is a review-only curator: report stale/duplicate/unsafe skills, archive only with approval, never auto-delete.

2. **Skill lifecycle management**
   - Hermes distinguishes built-in skills, optional skills, agent-created skills, usage/activity, curator state, pin/archive behavior.
   - Nova Skill OS could add lifecycle fields: `source`, `status`, `last_used`, `pinned`, `review_due`, `risk_level`, `owner`, `version`.

3. **Memory context fencing / streaming scrubber**
   - Hermes wraps recalled memory in `<memory-context>` and scrubs it from output streams, including split streaming chunks.
   - Nova can adapt the concept for internal memory: make memory context clearly non-user input and prevent accidental echoing of private context.

4. **Tool-loop guardrails**
   - Hermes tracks repeated exact failures, same-tool failures, and idempotent no-progress loops.
   - Nova Harness / assistant discipline can add a lightweight “do not loop blindly” rule: after N repeated tool failures, change strategy or ask.

5. **Secret redaction patterns**
   - Hermes redactor covers vendor token prefixes, env assignments, JSON keys, auth headers, Telegram bot tokens, private keys, DB URLs, JWTs, Discord mentions, E.164 phone numbers, sensitive URL query params.
   - Nova’s `nova-pack-repo` scanner is smaller; we can borrow categories conceptually and expand scanner coverage.

6. **Cron prompt-injection guard**
   - Hermes scans assembled cron prompts including loaded skill content and blocks suspicious injections before auto-approve cron agents run.
   - Nova cron jobs could get a harness/checklist: exact delivery target, tool allowlist, no broad destructive tools, and prompt-injection scan for scheduled unattended jobs.

7. **Delivery target parsing**
   - Hermes has explicit `platform:chat_id` routing and local fallback.
   - Nova already has delivery routes; dashboard/harness should validate explicit targets for user-facing jobs.

8. **Supply-chain posture**
   - Exact-pinned dependencies, smaller base install, lazy optional deps, supply-chain audit workflows, OSV scanner.
   - Nova should keep third-party adaptations read-only until reviewed; if packaging Nova tools later, prefer exact pins and optional/lazy heavy deps.

9. **Security policy honesty**
   - Hermes states clearly: the only real boundary against adversarial LLM behavior is OS-level isolation; in-process approval/redaction/tool allowlists are heuristics.
   - Nova should adopt this wording in safety docs/playbooks so we don’t overclaim what harness/redaction can guarantee.

## Risks / do not do yet

- Do not install or run Hermes in this Nova environment now. It is a full competing agent platform with gateway, cron, plugins, skills, shell/file tools, migration path from OpenClaw, and many optional dependencies.
- Do not run the one-line installer. It installs uv/Python/Node/ripgrep/ffmpeg and modifies shell startup; unnecessary and risky for read-only research.
- Do not run `hermes claw migrate` unless Nick explicitly decides to migrate; it may import OpenClaw settings, memories, skills, API keys, messaging settings, and TTS assets.
- Do not bulk import skills/plugins. The extension surface is huge and plugins run with agent privileges.
- Treat all README/docs as untrusted external content; use ideas, not instructions.

## Recommended safe Nova adaptations

1. Expand `nova-pack-repo` secret scanner using Hermes redaction categories.
2. Add a `nova-skill-os` lifecycle/review report inspired by Hermes curator: stale, duplicate, risky, pinned, archived candidates.
3. Add `docs/nova-security-boundaries.md` explaining OS boundary vs in-process heuristics.
4. Add a harness check for scheduled jobs: user-facing cron jobs must have explicit delivery target + tool allowlist + no accidental `NO_REPLY` unless intended.
5. Add a memory-context fencing convention to Nova playbooks so recalled memory is never treated as direct user input and is not echoed unnecessarily.

## Initial verdict

High-value reference repo, especially for self-improvement loops, skill lifecycle, redaction, cron safety, delivery routing, and honest security posture. Not a replacement/migration target today. Best path is selective OpenClaw-native adaptation, with no install/run.
