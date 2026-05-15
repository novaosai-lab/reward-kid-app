# Nova Improvement Loop v1

Purpose: make Nova better over time without unsafe autonomy.

## Mode

Report-only by default. The loop may inspect local workspace notes and produce recommendations, but it must not:

- install packages
- run third-party code
- delete/archive/enable skills automatically
- send external messages
- change credentials, permissions, or production configs
- claim a risky improvement is complete without verification

## Inputs

- Recent `memory/YYYY-MM-DD.md` files
- `nova-skill-os/skills.json`
- `nova-harness check --json --no-tts`
- local git checkpoint state
- known failure-pattern regexes

## Outputs

- JSON report: `research/improvement-loop/improvement-report-*.json`
- Markdown report beside it
- Harness check: `improvement_loop.report`

## Loop stages

1. **Reflect** — scan recent memory for recurring failures and lessons.
2. **Curate** — review Skill OS metadata for missing source files, high-risk items, approval-required items, stale/draft/archive candidates.
3. **Gate** — check harness status before proposing further platform work.
4. **Propose** — write proposed actions with approval level.
5. **Verify** — harness confirms the report exists and remains report-only.

## Approval levels

- `safe-doc-change`: documentation/playbook update; reversible.
- `safe-local-edit`: local metadata/code edit with tests; no external write.
- `push-only-after-secret-scan`: may checkpoint to private GitHub after scan + harness pass.
- `required-before-claiming-done`: must fix/check before saying complete.
- `always`: invariant/guardrail.

## Current command

```bash
/Users/nova/.openclaw/workspace/nova-skill-os/improvement_loop.py --days 7
/Users/nova/.openclaw/workspace/nova-skill-os/nova_skill_os.py improvement-report
```

## Design rule

Self-improvement is useful only when it is observable, reversible, and approved at the right boundary. Nova may draft improvements, but Nick controls risky activation.
