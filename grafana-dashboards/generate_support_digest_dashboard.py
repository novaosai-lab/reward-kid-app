#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

DASHBOARD_UID = 'nova-support-digest-sheets'
DATASOURCE_UID = '${DS_GOOGLE_SHEETS}'


def panel(panel_id: int, title: str, panel_type: str, grid: dict, query: str, description: str = '') -> dict:
    return {
        'id': panel_id,
        'type': panel_type,
        'title': title,
        'description': description,
        'datasource': {'type': 'grafana-googlesheets-datasource', 'uid': DATASOURCE_UID},
        'gridPos': grid,
        'targets': [
            {
                'refId': 'A',
                'datasource': {'type': 'grafana-googlesheets-datasource', 'uid': DATASOURCE_UID},
                # Placeholder query contract for Grafana Google Sheets datasource.
                # Actual plugin fields may be adjusted during non-sensitive POC.
                'spreadsheet': '${sheet_id}',
                'sheet': '${tab}',
                'range': 'A:O',
                'query': query,
            }
        ],
        'options': {},
        'fieldConfig': {'defaults': {}, 'overrides': []},
    }


def build_dashboard() -> dict:
    panels = [
        panel(1, 'Rows by severity', 'barchart', {'h': 8, 'w': 8, 'x': 0, 'y': 0}, 'GROUP BY severity SUM count_sampled', 'IncidentEvidence severity distribution'),
        panel(2, 'Rows by service', 'barchart', {'h': 8, 'w': 8, 'x': 8, 'y': 0}, 'GROUP BY service SUM count_sampled', 'Top services by sampled count'),
        panel(3, 'Incident candidates', 'table', {'h': 8, 'w': 8, 'x': 16, 'y': 0}, 'SELECT incident_candidate, severity, service, count_sampled, likely_dependency', 'Current grouped incident candidates'),
        panel(4, 'Top error signatures', 'table', {'h': 9, 'w': 12, 'x': 0, 'y': 8}, 'SELECT error_signature, service, endpoint, rpc, count_sampled ORDER BY count_sampled DESC', 'Sanitized signatures only'),
        panel(5, 'Slow / high rpt endpoints', 'table', {'h': 9, 'w': 12, 'x': 12, 'y': 8}, 'SELECT service, endpoint, max_rpt_ms, count_sampled, grafana_url ORDER BY max_rpt_ms DESC', 'Drill-down through Grafana URL'),
    ]
    return {
        'dashboard': {
            'uid': DASHBOARD_UID,
            'title': 'Nova Support Digest — Google Sheets',
            'tags': ['nova', 'support', 'google-sheets', 'incident-evidence'],
            'timezone': 'browser',
            'schemaVersion': 39,
            'version': 1,
            'refresh': '5m',
            'templating': {
                'list': [
                    {'name': 'sheet_id', 'type': 'textbox', 'label': 'Google Sheet ID', 'query': '', 'current': {'text': 'SET_ME_NON_SECRET', 'value': 'SET_ME_NON_SECRET'}},
                    {'name': 'tab', 'type': 'textbox', 'label': 'Sheet tab', 'query': 'IncidentEvidence', 'current': {'text': 'IncidentEvidence', 'value': 'IncidentEvidence'}},
                    {'name': 'env', 'type': 'textbox', 'label': 'Environment', 'query': 'prod-v2', 'current': {'text': 'prod-v2', 'value': 'prod-v2'}},
                ]
            },
            'panels': panels,
            'annotations': {'list': []},
        },
        'overwrite': False,
        'folderUid': 'nova-support',
        'meta': {
            'mode': 'artifact-only',
            'deploy': False,
            'contract': 'playbooks/google-sheets-reporting-contract.md',
            'datasource_plugin': 'grafana/google-sheets-datasource',
            'notes': 'Generated locally. Replace datasource UID and sheet ID during approved POC only.',
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser(description='Generate Nova support digest Grafana dashboard JSON artifact')
    ap.add_argument('--out', type=Path, default=Path(__file__).resolve().parent / 'support_digest_dashboard.json')
    args = ap.parse_args()
    data = build_dashboard()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'ok': True, 'out': str(args.out), 'panels': len(data['dashboard']['panels']), 'mode': 'artifact-only'}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
