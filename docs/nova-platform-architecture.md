# Nova Platform Architecture

Date: 2026-05-15
Inspired by safe patterns observed in thClaws, adapted for the current OpenClaw/Nova setup. This is not a thClaws install plan; it is an OpenClaw-native architecture map.

Related guide: docs/nova-nested-architecture.md defines the nested layer model for safely adapting ideas from Hermes, Superpowers, Anthropic skills, and other agent systems without replacing the OpenClaw production core.

## Principle

Nova should keep one operational truth across many surfaces:

- Telegram/direct chat
- OpenClaw main/isolated sessions
- Cron jobs
- Voice I/O
- Nova Ops Dashboard
- Guard Agent
- Nova Harness
- Skills/playbooks/prompts

The dashboard should observe; harness should verify; guard should recover; cron should schedule; OpenClaw sessions should execute.

Nova is best understood as an intelligence layer across multiple surfaces, not a single chatbot. The model is only one part of the system; durable value comes from the coordination between memory, tools, orchestration, and delivery surfaces.

## Platform layers

```text
[Interfaces]
Telegram · Android app · Dashboard · Voice · Future web surfaces
        |
[Orchestration]
OpenClaw sessions · Cron · Subagents · Skills · Prompts
        |
[Capabilities]
MCP/tools · n8n · Browser · Grafana · Local services · Bridges
        |
[Memory]
Profile · project state · daily notes · durable lessons · transcripts
        |
[Operations]
Guard · Harness · logs · health checks · rollback/checkpoints
```

### Interface layer
- Human-facing surfaces for different contexts.
- Telegram is current primary surface; Nova Assistant Android app is becoming the mobile surface; Dashboard remains observability-first.

### Orchestration layer
- Routes intent to the right execution path.
- Includes OpenClaw sessions, cron, specialist prompts, skills, and future task routers.

### Capability layer
- Standardized access to tools and external systems.
- Prefer MCP/tool contracts and bridges over hard-coded one-off calls.

### Memory layer
- Preserves continuity and context across sessions.
- Must separate durable memory from transient context and sensitive raw logs.

### Operations layer
- Keeps Nova reliable, observable, and recoverable.
- Guard recovers, Harness verifies, Dashboard observes, checkpoints preserve rollback paths.

## Current components

| Component | Role | Safety posture |
|---|---|---|
| OpenClaw Gateway/Node | Core agent runtime and routing | Managed by OpenClaw + Guard health checks |
| Telegram channel | Primary human interface | Replies route through OpenClaw, not raw curl scripts |
| Guard Agent | Watchdog for Gateway/Node | Restart rate-limited; logs JSONL |
| Nova Ops Dashboard | GUI/read-only observability | Admin actions disabled by default |
| Nova Harness | Quality gate and scenario tests | Pass/warn/fail output; now visible in Dashboard |
| Nova Voice | Local TTS/STT + Telegram voice sender | Mode-gated; avoid real-person voice imitation |
| Cron jobs | Scheduled isolated agent turns | Explicit delivery routes for user-facing jobs |
| Skills/playbooks/prompts | Reusable specialist workflows | Adapt concepts selectively; no unsafe bulk imports |
| Memory files | Continuity and user preferences | Private; not pushed to GitHub |

## Layered safety model

Nova should treat these as independent gates:

1. **Approval / intent gate** — risky external writes, destructive changes, public sends, and broad installs require explicit approval.
2. **Filesystem/privacy gate** — memory, tokens, logs, media, credentials, `.env`, and personal context are excluded from GitHub/repo packs.
3. **Delivery gate** — cron/agent jobs that should alert Nick need explicit channel + target; quiet jobs must intentionally use no delivery.
4. **Quality gate** — before saying work is complete, run the smallest meaningful verification: harness/test/lint/build/screenshot/direct inspection.
5. **Rollback gate** — stable platform changes should be checkpointed to the private sanitized GitHub repo.

## Dashboard direction

Keep GUI improvements read-only unless Nick explicitly asks for admin controls. Useful dashboard panels:

- Core service health
- Guard timeline
- Harness quality gate
- Cron/delivery posture
- Voice mode/STT/TTS posture
- n8n/Docker surface
- Recent checkpoint/rollback commit

Admin buttons may exist visually, but should remain disabled until there is authentication, explicit confirmation, rate limit, and audit logging.

## Near-term roadmap

1. Add more scenario checks to Nova Harness.
2. Show harness results in Nova Ops Dashboard.
3. Add cron delivery checks for important scheduled jobs.
4. Add read-only GitHub checkpoint status to dashboard.
5. Consider Nova Skill OS frontmatter catalog + lazy-load validation.
6. Treat Telegram, Android app, and Dashboard as multiple surfaces of one system, not separate products.
7. Publish a maintained skill/tool registry for discoverability and ownership.

## Non-goals for now

- Do not replace OpenClaw with thClaws.
- Do not install external agent daemons/hooks from third-party repos.
- Do not enable dashboard admin actions without an explicit safety layer.
- Do not push private memory, credentials, tokens, media, or logs to GitHub.
