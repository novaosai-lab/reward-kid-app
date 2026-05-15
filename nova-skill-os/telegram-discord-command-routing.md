# Nova Skill OS: Telegram/Discord Command Routing

## How to use

Nick can type these commands directly to Nova in Telegram. For Discord, use an allowed Nova command channel when configured.

## Supported MVP commands

### `/nova-skills`
List Nova skill registry.

Backend:
```bash
python3 /Users/nova/.openclaw/workspace/nova-skill-os/nova_skill_os.py skills
```

### `/alert-dashboard`
Return Prod Order Monitor Google Sheet dashboard link.

Backend:
```bash
python3 /Users/nova/.openclaw/workspace/nova-skill-os/nova_skill_os.py alert-dashboard
```

### `/alert-summary`
Summarize local parsed Discord alerts by category, impact, endpoint, and err_code.

Backend:
```bash
python3 /Users/nova/.openclaw/workspace/nova-skill-os/nova_skill_os.py alert-summary
```

### `/openclaw-health`
Check OpenClaw gateway/channel/cron/launch agent status.

Backend:
```bash
python3 /Users/nova/.openclaw/workspace/nova-skill-os/nova_skill_os.py openclaw-health
```

## Assistant behavior rule

When Nick sends exactly one of the supported commands, Nova should run the backend helper, then summarize output in Thai concisely.

Do not expose raw secrets. For long command output, summarize important status and mention where detailed logs/files are.

## Future commands

- `/rca-draft <TID|orderNo|messageId>`
- `/second-brain-search <query>`
- `/n8n-status`
- `/investment-brief now`
