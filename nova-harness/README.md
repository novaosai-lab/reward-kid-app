# Nova Harness

`nova-harness` is the first evaluation/control health CLI for Nova's personal agent harness.

## Command

```bash
/Users/nova/.openclaw/workspace/nova-harness/nova-harness check
/Users/nova/.openclaw/workspace/nova-harness/nova-harness check --no-tts
/Users/nova/.openclaw/workspace/nova-harness/nova-harness check --json
```

## Current checks

- `openclaw.gateway.health` — Gateway RPC health and channel config
- `openclaw.status` — high-level OpenClaw state
- `guard.launchagent` — Guard Agent LaunchAgent + recent log
- `dashboard.api` — Nova Ops Dashboard `/api/status`
- `voice.mode` — voice mode/tone state
- `voice.stt.local` — local whisper-cpp STT against latest inbound OGG sample
- `voice.tts.local` — local OmniVoice WAV generation smoke test
- `cron.jobs` — commute/weather cron presence
- `policy.admin_actions` — dashboard admin actions remain disabled/read-only

## Latest verification

2026-05-14: `nova-harness check` returned PASS: 9 checks, 0 failed, 0 warnings.

## Notes

- TTS check generates `nova-voice/output/harness-tts-test.wav` locally only; it does not send Telegram messages.
- `--no-tts` is faster and avoids loading OmniVoice.
- Guard Agent uses `StartInterval`, so launchd may show `not running` between scheduled runs. The harness treats a loaded LaunchAgent plus recent successful guard log as healthy.

## Next steps

1. Add dashboard panel for latest harness result.
2. Add JSON snapshot history under `nova-harness/runs/`.
3. Add policy registry checks for auto/approval actions.
4. Add scheduled daily harness check with alert-on-fail only.
