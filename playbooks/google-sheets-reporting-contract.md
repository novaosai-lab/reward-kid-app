# Google Sheets Reporting Contract

Purpose: keep Nova support/incident reporting rows consistent, Grafana-friendly, and safe to export.

Scope: rows written by scripts such as `grafana-openclaw-bridge/quickwit_incident_digest.py` into incident/support Google Sheets.

## Contract v1: IncidentEvidence

Canonical tab: `IncidentEvidence`

Required columns, in order:

| # | Column | Type | Required | Notes |
|---|---|---|---|---|
| 1 | `created_at_gmt7` | datetime/string | yes | Row creation time in GMT+7, e.g. `2026-05-15 22:30:00` |
| 2 | `window_gmt7` | string | yes | Evidence time window; ISO UTC range or display range accepted |
| 3 | `env` | enum/string | yes | Example: `prod-v2`, `staging`, `dev` |
| 4 | `incident_candidate` | string | yes | Short grouped issue/candidate name |
| 5 | `service` | string | yes | Service/system name if available |
| 6 | `endpoint` | string | no | Endpoint/path if available |
| 7 | `rpc` | integer/string | no | HTTP/RPC status, e.g. `500`, `502`, `504` |
| 8 | `count_sampled` | integer | yes | Sample/group count; must be >= 0 |
| 9 | `max_rpt_ms` | number | no | Max response time in ms; must be >= 0 when present |
| 10 | `sample_tid` | string | no | Sample trace/request ID; sanitized |
| 11 | `error_signature` | string | no | Sanitized grouped error message/signature |
| 12 | `likely_dependency` | string | no | Human-readable dependency hint |
| 13 | `severity` | enum | yes | `P0`, `P1`, `P2`, `P3`, `P4`, `info`, `unknown` |
| 14 | `grafana_url` | URL | no | Grafana/deep link only; no embedded tokens/secrets |
| 15 | `notes` | string | no | Must not contain credentials, webhook URLs, bearer tokens, or private keys |

## Safety rules

Rows must not contain:

- Google Chat webhook URLs
- API keys/tokens/secrets
- `Authorization: Bearer ...` values
- private keys
- database URLs with passwords
- `.env` style secrets
- raw PII unless explicitly approved for that sheet and scope

## Grafana-friendly rules

For easy visualization via Grafana Google Sheets datasource:

- Keep `created_at_gmt7` parseable and consistent.
- Keep `count_sampled` numeric.
- Keep `max_rpt_ms` numeric when present.
- Use stable values for `env`, `service`, `severity`, and `incident_candidate`.
- Prefer grouped/sanitized `error_signature` over raw payloads.

## Validation

Use:

```bash
/Users/nova/.openclaw/workspace/grafana-openclaw-bridge/validate_sheet_contract.py --sample
```

Or validate JSON rows:

```bash
validate_sheet_contract.py --rows rows.json
```

The validator is local/offline and does not contact Google APIs.

## Approval boundary

This contract/validator can be changed locally. Connecting a sheet to Grafana, installing Grafana plugins, or giving any credential access requires explicit approval and least-privilege scope.
