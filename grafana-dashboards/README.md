# Nova Grafana Dashboards

This folder contains **dashboard-as-artifact** prototypes for Nova/Nick workflows.

Guardrail: scripts here generate/validate local JSON only. They do **not** deploy to Grafana, install plugins, or use credentials.

## Support Digest from Google Sheets

Generate:

```bash
./generate_support_digest_dashboard.py --out support_digest_dashboard.json
```

Validate:

```bash
./validate_dashboard_artifact.py support_digest_dashboard.json
```

Purpose:

- Visualize incident/support rows from the `IncidentEvidence` Google Sheet contract.
- Designed for Grafana Google Sheets datasource POC.
- Panels focus on severity, service, incident candidate, and error signatures.

Before real use:

1. Install/enable `grafana/google-sheets-datasource` only with approval.
2. Use a non-sensitive test sheet first.
3. Use read-only, least-privilege Google access.
4. Replace datasource placeholder UID with the actual datasource UID.
5. Keep generated JSON free of secrets/webhook URLs.
