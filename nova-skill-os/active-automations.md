# Active Nova Automations

## Discord Prod Order Monitor → Google Sheet

- Source: Discord `#prod-order-monitor`
- Channel ID: `1296444565708079154`
- Runtime: macOS LaunchAgent `ai.openclaw.discord-prod-order-forwarder`
- Interval: 60 seconds
- Script: `discord-alert-forwarder/forward_prod_order_alerts.py`
- Sheet: `https://docs.google.com/spreadsheets/d/17bzvqdCf0IHqYvF37eqdEslDSMRRS431WUFYlljkMCw/edit#gid=0`
- Tabs: `Summary`, `Alerts`
- Destination Chat: Google Chat receives short sheet-link summary only.
- Safety: no first-run backfill, 10-minute dedupe, max 3 chat notifications/run if chat mode enabled.

## SCB Thai Investment Briefs

- Morning: `b3309fda-26c5-4d46-97ad-b8f477d51ef6` at 08:30 Asia/Bangkok
- Evening: `cf2c1b05-a235-424b-a66e-2319e47e833b` at 18:30 Asia/Bangkok
- Delivery: Telegram
- Guardrail: research-only; no auto-trade or guaranteed returns.

## Second Brain Auto Reindex

- Cron ID: `b07bc0d0-045a-4120-ac48-235f6b170280`
- Schedule: 03:15 Asia/Bangkok
- Delivery: none
- Output: local Second Brain index/dashboard.

## Disabled / Cleaned Up

- `b90625d8-28d6-46fc-be9a-f125829ed076` Morning summary cron disabled due invalid `last` delivery route.
