# Grafana Google Sheets Datasource POC Status

Date: 2026-05-15
Mode: safe POC with synthetic data only.

## What was done

Created a synthetic Google Sheet for the `IncidentEvidence` reporting contract.

- Sheet title: `Nova Grafana Sheets POC - IncidentEvidence`
- Sheet URL: https://docs.google.com/spreadsheets/d/19qTC1B8jM9XRpX_6x3eT7BpMQt4ypciJ1_rKCRkv2Nk/edit
- Tab: `IncidentEvidence`
- Rows: 4 synthetic rows
- Data: fake/test-only support incident rows, no customer data
- Script: `grafana-dashboards/create_test_incident_sheet.py`

## Validation

- `validate_sheet_contract.py --sample` passes.
- Synthetic rows are validated before writing to the sheet.
- Generated dashboard artifact validates successfully.

## Grafana check

Target checked: configured Grafana endpoint from `grafana-openclaw-bridge/.env`.

Observed:

- Grafana API health reachable.
- Grafana version observed: `12.0.0`.
- Google Sheets datasource plugin was **not installed/enabled**.
- No datasource of type Google Sheets was found.

Because of this, the dashboard artifact cannot be made live yet without Grafana admin action.

## Existing artifact

Dashboard artifact:

- `grafana-dashboards/support_digest_dashboard.json`

Panels:

1. Rows by severity
2. Rows by service
3. Incident candidates
4. Top error signatures
5. Slow / high rpt endpoints

## Required next action

A Grafana admin must install/enable the official plugin:

- Repo: https://github.com/grafana/google-sheets-datasource
- Plugin docs: https://grafana.com/docs/plugins/grafana-googlesheets-datasource/latest/

Recommended safety settings:

1. Use a non-sensitive Google Sheet first.
2. Use least-privilege/read-only Google access.
3. Avoid production/customer data until POC is reviewed.
4. Use the synthetic sheet above for initial Grafana datasource connection.
5. After datasource exists, replace `${DS_GOOGLE_SHEETS}` and `${sheet_id}` placeholders/import dashboard.

## Status

Blocked at live Grafana visualization until Google Sheets datasource plugin/datasource is available.
