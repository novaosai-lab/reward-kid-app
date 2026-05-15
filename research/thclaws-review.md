# thClaws repo review

Date: 2026-05-15
Repo: https://github.com/thClaws/thClaws
Local clone: `/Users/nova/.openclaw/workspace/external/thClaws`
Commit reviewed: `9f92aec`
Mode: read-only clone; no install/build/run executed.

## Snapshot

thClaws is a native Rust AI agent workspace/harness. It positions itself as one engine behind multiple surfaces: desktop GUI, CLI REPL, one-shot print mode, and webapp/serve mode. It supports multi-provider LLMs, skills, MCP, plugins, memory, KMS, subagents/side-channels/team agents, plan mode, scheduling, hooks, and document tools.

License appears permissive: MIT OR Apache-2.0 (`LICENSE-MIT`, `LICENSE-APACHE`). Copyright: ThaiGPT Co., Ltd.

## Repository shape

- Rust workspace with core crate under `crates/core`.
- Frontend under `frontend/` using React/Vite.
- Technical manual under `thclaws-technical-manual/`.
- Thai user manual exists under `user-manual-th/`.
- Rust source size observed: 129 `.rs` files, ~98k lines total.

Important modules from technical manual:

- `agent.rs` — streaming agent loop.
- `session.rs` — JSONL session persistence.
- `shared_session.rs` — worker state and GUI/CLI shared session machinery.
- `permissions.rs` — approval gate and permission modes.
- `sandbox.rs` — filesystem sandbox.
- `skills.rs` — skill discovery/lazy load/install.
- `mcp.rs` — MCP support.
- `schedule.rs` — recurring jobs / daemon / watch triggers.
- `kms.rs`, `memory.rs` — knowledge/memory surfaces.
- `side_channel.rs`, `subagent.rs`, `team.rs` — orchestration.

## Useful ideas for Nova/OpenClaw

1. **One engine, multiple surfaces**
   - thClaws has a clear “same Agent + Session + ToolRegistry behind GUI/CLI/print/web” architecture.
   - Nova already has OpenClaw sessions, Telegram, dashboard, cron, voice. Useful next step is to document Nova’s equivalent engine/surface boundary so Dashboard/Telegram/cron/voice stay consistent.

2. **Permission model layering**
   - Strong concept: approval gate + filesystem sandbox + policy layer fail independently.
   - Nova should mirror this thinking in playbooks/harness: delivery permissions, file boundary, external-write guard, and repo-pack secret guard as separate gates.

3. **Plan mode / approval windows**
   - Explicit plan mode blocks mutating tools until approved.
   - Nova can adapt this as a workflow convention: for risky multi-step changes, produce plan → get approval → execute → verify.

4. **Skills lazy loading and scoped overrides**
   - thClaws discovers skill frontmatter first, lazy-loads body on use, and gives project skills priority.
   - Useful for Nova Skill OS: frontmatter-only catalog, lazy body read, explicit override order, skill validation check.

5. **KMS as markdown wiki, no embeddings**
   - Grep + read KMS is simple, auditable, git-friendly.
   - Nova’s memory/second-brain work can use this pattern: index.md + pages + explicit read/write tools + audit trail.

6. **Schedule subsystem layers**
   - Manual run, in-process scheduler, native daemon all call the same run primitive.
   - Nova cron/harness could benefit from a “manual run primitive” plus scenario tests for commute/investment/briefing jobs.

7. **Technical manual quality**
   - The technical manual is unusually useful: maps features to source modules and cross-references.
   - Good pattern for Nova platform docs: architecture, permissions, schedule, skills, sessions, hooks as separate docs.

## Risks / do not do yet

- Do not install or run thClaws on Nova until code review is deeper; it is a full agent harness with shell, file, MCP, scheduling, hooks, and memory surfaces.
- Do not copy code wholesale even with permissive license; first compare architecture and adapt concepts into OpenClaw-native tools.
- Be careful with hooks, external plugin install, MCP stdio, shell escape, and scheduling daemon — these are powerful surfaces that can expand risk.
- It overlaps heavily with OpenClaw, so replacing OpenClaw is not recommended. Treat it as architecture/reference material.

## Recommended next steps

1. Read `thclaws-technical-manual/agentic-loop.md`, `context-composer.md`, `sessions.md`, `kms.md`, and `hooks.md` next.
2. Create a Nova architecture note mapping current components: OpenClaw Gateway, sessions, cron, dashboard, guard, voice, harness, skills, memory.
3. Add two harness checks inspired by thClaws:
   - permission boundary check: external write/send requires explicit delivery route or approval.
   - schedule scenario check: commute cron has delivery target and non-NO_REPLY policy.
4. Consider a Nova Skill OS improvement: frontmatter catalog + lazy body load + validation report.

## Initial verdict

High-value reference repo. Best use is selective architecture learning, not installation. Most directly useful concepts for Nova now: permission layering, technical-manual structure, schedule run primitive, KMS markdown wiki, and skill lazy loading.
