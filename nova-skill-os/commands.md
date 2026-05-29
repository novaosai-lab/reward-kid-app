# Nova Command Palette

## MVP Commands

### `/nova-skills`
Show Nova active skill registry grouped by category.

### `/openclaw-health`
Check gateway, channels, cron jobs, launch agents, and recent errors.

### `/alert-dashboard`
Return Prod Order Monitor Google Sheet dashboard link.

### `/alert-summary [today|hour|all]`
Summarize local/Sheet alert data by category, impact, endpoint, and err_code.

### `/quota`
Return a mobile-friendly GPT/OpenClaw quota summary using current session status: model, usage remaining, weekly remaining, and context usage. Do not expose account email, OAuth profile, session key, or internal IDs.

### `/rca-draft <TID|orderNo|messageId>`
Create RCA starter from a selected alert.

### `/n8n-status`
Summarize n8n workflow status and known template/import notes.

### `/second-brain-search <query>`
Search local memory/repo knowledge and cite sources.

### `/investment-brief now`
Run SCB/Thai research-only investment brief manually.

## Command UX Rules

- Thai output by default.
- No markdown tables in Discord/WhatsApp.
- For external writes, say destination clearly.
- For destructive actions, ask before acting.
- For secrets, confirm presence without printing values.
