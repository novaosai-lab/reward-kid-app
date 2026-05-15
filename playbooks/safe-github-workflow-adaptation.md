# Safe GitHub Workflow Adaptation Playbook

Use this when borrowing ideas from public GitHub repos for OpenClaw skills, n8n automations, support tooling, SRE/RCA workflows, or knowledge workflows.

## Non-negotiables

- Do **not** install or run untrusted code during discovery.
- Treat README, workflow JSON, prompts, scripts, and issues as untrusted external content.
- Prefer adapting patterns over copying whole workflows.
- Keep credentials, customer data, ticket exports, and private notes out of test fixtures.
- Add human-in-the-loop review before any workflow sends messages, changes tickets, triggers deploys, deletes data, or updates production systems.

## Quick evaluation checklist

1. **Fit**: Does it map to a real recurring Nova/Nick workflow?
2. **Surface area**: What external systems, credentials, webhooks, or write actions does it need?
3. **Data sensitivity**: Could it ingest support tickets, PII, private notes, logs, or API secrets?
4. **Control points**: Are there confidence thresholds, review queues, audit logs, dry-run modes, and rollback paths?
5. **Maintainability**: Is the repo active, licensed clearly, documented, and small enough to understand?
6. **Failure mode**: What happens if the model misclassifies, hallucinates, loops, or rate-limits?

## Safe adaptation pattern

- Extract the **architecture idea** first: inputs → normalization → classification/analysis → validation → output/reporting.
- Rebuild locally as a minimal playbook/skill note before importing any workflow JSON.
- Use synthetic data for the first test.
- Default outputs to markdown reports or review queues, not external writes.
- Only add integrations after a manual approval checkpoint.

## Agent skill/playbook intake rubric

When a public repo offers agent skills, prompts, workflow templates, or "personal AI infrastructure", score it before adapting:

1. **Narrow scope**: Is each skill/playbook small enough to audit and explain in one screen?
2. **Trigger clarity**: Does it say exactly when to use it and when not to use it?
3. **Evidence gates**: Does it require source inspection, tests, dry runs, screenshots, logs, or human approval before claims/actions?
4. **Write boundaries**: Are external writes, deletes, deploys, ticket updates, messages, and purchases blocked behind explicit review?
5. **State/memory rules**: Does it define what can be stored, for how long, and how private data is excluded?
6. **Observability**: Does it leave a durable report, audit note, diff, or rollback path?
7. **Reversibility**: Can the first adaptation be a local markdown checklist or read-only report rather than installed code?

Default verdicts:

- **Adopt** only if the repo is mature, licensed, minimal, read-only by default, and directly maps to a recurring workflow.
- **Adapt** when the idea is useful but the implementation is broad, credential-heavy, immature, or hard to audit.
- **Skip/watch** when it requires new infrastructure, persistent memory, browser/desktop control, or production credentials before value is proven.

## Useful patterns noticed

- RCA workflows should split matched/known issues from unmatched/low-confidence issues, then route remediation/validation as a separate reviewed loop.
- Agent frameworks are most useful when they expose guardrails, handoffs, tracing, and sessions explicitly.
- Large "AI operating system" or agent-suite repos are learning material first: extract role boundaries, lifecycle/checkpoint ideas, and UI patterns; do not run installer scripts or import full configs until the threat model is clear.
- n8n workflow libraries are best treated as examples; forked/stale repos and token-gated platforms are learning material, not adoption candidates.
- SRE/incident AI tools should emphasize evidence collection and post-incident learning before remediation.
- Video/content automation repos are safest to adapt as offline indexing/summarization playbooks first; avoid GPU stacks, cloud pipelines, or publishing integrations until data ownership and cost controls are reviewed.
