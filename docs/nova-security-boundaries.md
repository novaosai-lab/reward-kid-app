# Nova Security Boundaries

Date: 2026-05-15

This note adapts the useful security posture from Hermes Agent to Nova/OpenClaw without installing Hermes.

## Core truth

The only strong boundary against adversarial LLM behavior is **OS-level isolation**: filesystem permissions, sandboxing, containers/VMs, network egress policy, and credential scoping outside the agent process.

Everything inside the agent process is a helpful heuristic, not a hard boundary:

- approval prompts
- secret redaction
- repo-pack scanners
- tool allowlists
- prompt-injection checks
- dashboard warnings
- harness checks

These reduce accidents and catch common failures. They must not be treated as containment against a determined malicious input or compromised plugin/skill.

## Nova's current safety layers

1. **Intent / approval gate**
   - Ask before destructive commands, public posts, external sends, broad installs, or production-impacting changes.

2. **Filesystem / privacy gate**
   - Private memory, auth tokens, `.env`, logs, media, models, and personal context are excluded from GitHub and repo packs.

3. **Delivery gate**
   - User-facing cron jobs need explicit `delivery.channel` and `delivery.to`.
   - Quiet jobs must intentionally use no delivery or explicit silent behavior.

4. **Quality gate**
   - Before claiming completion, run a relevant check: harness/test/lint/build/screenshot/direct inspection.

5. **Rollback gate**
   - Stable platform changes should be committed to the private sanitized GitHub repo.

## What Nova should not overclaim

- `nova-pack-repo` secret scanning does not prove a repo is safe; it is a sharing guardrail.
- Dashboard health does not prove every automation is correct; it proves selected checks currently pass.
- Cron delivery checks do not prove the content is safe; they prove routing/policy posture.
- Skill metadata does not prove a skill is safe; scripts and dependencies still need review.

## Safer default posture

- Prefer read-only inspection before install/run.
- Prefer selective adaptation over bulk importing third-party code.
- Prefer exact allowlists for external writes and delivery routes.
- Prefer `trash` or archive over irreversible delete.
- Keep admin dashboard actions disabled until auth, confirmation, rate limit, and audit log exist.

## Escalation rule

If a task crosses from local/read-only into external write, destructive file operation, credentials, public communication, production system, or broad install: pause and ask Nick unless he explicitly approved that exact scope.
