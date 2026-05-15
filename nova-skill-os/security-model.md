# Nova Skill OS Security Model

## Risk Classes

### Read-only
Examples: status, logs, search, summarize.
Default: allowed.

### Local write
Examples: create docs, CSV, dashboards, local state.
Default: allowed with concise summary.

### External write
Examples: Google Chat, Discord, Google Sheets, GitHub comments.
Default: allowed only when user intent/workflow is explicit.

### Destructive / service-impacting
Examples: delete files, stop services, disable workflows, remove cron.
Default: ask first unless user explicitly requested that exact action.

### Secret handling
Examples: tokens, webhooks, OAuth credentials.
Rules:
- never echo secret values
- store in env/credential store
- redact logs/docs
- prefer placeholders in exported templates

## Audit Note Template

For production/ops-impacting changes, record:
- what changed
- why
- affected services/channels
- rollback command/path
- verification evidence
