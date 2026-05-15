#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'grafana-openclaw-bridge'))

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from validate_sheet_contract import HEADERS, validate_row

TOKEN = ROOT / 'google-auth/token.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
DEFAULT_SHEET_ID = '19qTC1B8jM9XRpX_6x3eT7BpMQt4ypciJ1_rKCRkv2Nk'
DEFAULT_TAB = 'IncidentEvidence'


def creds():
    c = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if not c.valid and c.refresh_token:
        c.refresh(Request())
        TOKEN.write_text(c.to_json())
    if not c.valid:
        raise SystemExit('Google token invalid')
    return c


def to_int(value):
    try: return int(float(value or 0))
    except Exception: return 0


def to_float(value):
    try: return float(value or 0)
    except Exception: return 0.0


def read_sheet(sheet_id: str, tab: str):
    svc = build('sheets', 'v4', credentials=creds())
    data = svc.spreadsheets().values().get(spreadsheetId=sheet_id, range=f'{tab}!A:O').execute()
    values = data.get('values', [])
    if not values:
        return []
    header = values[0]
    if header != HEADERS:
        raise SystemExit(f'Unexpected headers. expected={HEADERS} got={header}')
    rows = []
    for raw in values[1:]:
        row = raw + [''] * (len(HEADERS) - len(raw))
        errors = validate_row(row, len(rows) + 1)
        if errors:
            raise SystemExit('Sheet row validation failed: ' + '; '.join(errors[:5]))
        rows.append(dict(zip(HEADERS, row)))
    return rows


def summarize(rows):
    severity = Counter()
    service = Counter()
    candidates = Counter()
    signatures = Counter()
    max_rpt_by_service = defaultdict(float)
    total = 0
    for r in rows:
        count = to_int(r.get('count_sampled'))
        total += count
        severity[r.get('severity') or 'unknown'] += count
        service[r.get('service') or 'unknown'] += count
        candidates[r.get('incident_candidate') or 'unknown'] += count
        sig = (r.get('error_signature') or 'n/a')[:120]
        signatures[sig] += count
        svc = r.get('service') or 'unknown'
        max_rpt_by_service[svc] = max(max_rpt_by_service[svc], to_float(r.get('max_rpt_ms')))
    top_latency = sorted(max_rpt_by_service.items(), key=lambda kv: kv[1], reverse=True)[:8]
    return {
        'row_count': len(rows),
        'sample_count': total,
        'severity': severity.most_common(),
        'service': service.most_common(10),
        'candidates': candidates.most_common(10),
        'signatures': signatures.most_common(10),
        'top_latency': top_latency,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description='Export IncidentEvidence Google Sheet rows to dashboard JSON')
    ap.add_argument('--sheet-id', default=DEFAULT_SHEET_ID)
    ap.add_argument('--tab', default=DEFAULT_TAB)
    ap.add_argument('--out', type=Path, default=ROOT / 'nova-ops-dashboard/public/data/support_digest.json')
    args = ap.parse_args()
    rows = read_sheet(args.sheet_id, args.tab)
    payload = {
        'ok': True,
        'source': 'google-sheets',
        'sheet_id': args.sheet_id,
        'tab': args.tab,
        'generated_at': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
        'summary': summarize(rows),
        'rows': rows,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'ok': True, 'out': str(args.out), 'rows': len(rows)}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
