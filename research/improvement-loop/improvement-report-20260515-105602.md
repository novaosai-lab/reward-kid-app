# Nova Improvement Loop Report

- Generated: 2026-05-15T10:56:02.252732+07:00
- Mode: report-only
- Memory files scanned: 3
- Harness: pass (11 checks)
- Skill review queue: 7
- Git dirty count: 29

## Failure patterns
- **secret_safety** x21: Keep repo-pack and GitHub checkpoint secret scans in the quality gate. Sources: memory/2026-05-13.md, memory/2026-05-15.md
- **silent_or_missing_delivery** x1: Scheduled user-facing jobs need explicit delivery target and clear non-silent policy. Sources: memory/2026-05-15.md

## Proposed actions
- **playbook_update** — Distill recurring failure patterns into playbooks/harness _(approval: safe-doc-change)_
- **skill_metadata** — Add missing source_files/risk metadata for reviewed Skill OS entries _(approval: safe-local-edit)_
- **rollback** — Checkpoint sanitized stable changes after verification _(approval: push-only-after-secret-scan)_
- **guardrail** — Keep loop report-only; draft skills stay draft until Nick approves _(approval: always)_

## Guardrail
This loop does not install, delete, send externally, or enable skills automatically.
