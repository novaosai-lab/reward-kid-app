#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'grafana-openclaw-bridge'))

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from validate_sheet_contract import HEADERS, validate_row

TOKEN = ROOT / 'google-auth/token.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']


def creds():
    c = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if not c.valid and c.refresh_token:
        c.refresh(Request())
        TOKEN.write_text(c.to_json())
    if not c.valid:
        raise SystemExit('Google token invalid')
    return c


def sample_rows():
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=7))).strftime('%Y-%m-%d %H:%M:%S')
    return [
        [now, '2026-05-15T12:00:00Z to 2026-05-15T15:00:00Z', 'test', 'HPC/R4M downstream timeout spike', 'commerce-api', '/api/orders', '504', 12, 8421.5, 'tid-test-001', 'timeout calling point-wallet mid=<id>', 'customer point / point-wallet', 'P3', 'https://grafana.example.com/d/example?var-tid=tid-test-001', 'Synthetic POC row; no customer data'],
        [now, '2026-05-15T12:00:00Z to 2026-05-15T15:00:00Z', 'test', 'Slow API endpoint', 'catalog-api', '/api/products', '200', 45, 12880.0, 'tid-test-002', 'slow endpoint avg=4200ms method=GET rpc=200', 'latency / downstream performance', 'P2', 'https://grafana.example.com/d/example?var-tid=tid-test-002', 'Synthetic POC row; no customer data'],
        [now, '2026-05-15T15:00:00Z to 2026-05-15T18:00:00Z', 'test', 'Promotion dependency errors', 'promotion-api', '/api/coupons/apply', '500', 8, 3100.0, 'tid-test-003', 'coupon validation failed RDM-<ref>', 'promotion / coupon', 'P3', 'https://grafana.example.com/d/example?var-tid=tid-test-003', 'Synthetic POC row; no customer data'],
        [now, '2026-05-15T15:00:00Z to 2026-05-15T18:00:00Z', 'test', 'Gateway upstream 502', 'gateway', '/api/payment/callback', '502', 5, 2200.0, 'tid-test-004', 'bad gateway upstream reset', 'gateway / nginx upstream', 'P3', 'https://grafana.example.com/d/example?var-tid=tid-test-004', 'Synthetic POC row; no customer data'],
    ]


def main() -> int:
    ap = argparse.ArgumentParser(description='Create/update synthetic IncidentEvidence Google Sheet for Grafana datasource POC')
    ap.add_argument('--title', default='Nova Grafana Sheets POC - IncidentEvidence')
    ap.add_argument('--tab', default='IncidentEvidence')
    ap.add_argument('--json-out', type=Path, default=ROOT / 'grafana-dashboards/poc_sheet_result.json')
    args = ap.parse_args()

    rows = sample_rows()
    errors = []
    for i, row in enumerate(rows, 1):
        errors.extend(validate_row(row, i))
    if errors:
        raise SystemExit('Sample row validation failed: ' + '; '.join(errors))

    svc = build('sheets', 'v4', credentials=creds())
    body = {'properties': {'title': args.title}, 'sheets': [{'properties': {'title': args.tab}}]}
    created = svc.spreadsheets().create(body=body, fields='spreadsheetId,spreadsheetUrl').execute()
    sid = created['spreadsheetId']
    values = [HEADERS] + rows
    svc.spreadsheets().values().update(
        spreadsheetId=sid,
        range=f'{args.tab}!A1:O{len(values)}',
        valueInputOption='RAW',
        body={'values': values},
    ).execute()
    # Basic formatting/frozen header only; no sharing/public access.
    meta = svc.spreadsheets().get(spreadsheetId=sid).execute()
    sheet_id = next(s['properties']['sheetId'] for s in meta.get('sheets', []) if s['properties']['title'] == args.tab)
    svc.spreadsheets().batchUpdate(spreadsheetId=sid, body={'requests': [
        {'updateSheetProperties': {'properties': {'sheetId': sheet_id, 'gridProperties': {'frozenRowCount': 1}}, 'fields': 'gridProperties.frozenRowCount'}},
        {'autoResizeDimensions': {'dimensions': {'sheetId': sheet_id, 'dimension': 'COLUMNS', 'startIndex': 0, 'endIndex': len(HEADERS)}}},
    ]}).execute()

    result = {'ok': True, 'spreadsheet_id': sid, 'url': created['spreadsheetUrl'], 'tab': args.tab, 'rows': len(rows), 'note': 'Synthetic POC data only; not shared publicly'}
    args.json_out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
