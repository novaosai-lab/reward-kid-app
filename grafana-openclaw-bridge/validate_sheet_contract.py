#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

HEADERS = [
    'created_at_gmt7', 'window_gmt7', 'env', 'incident_candidate', 'service',
    'endpoint', 'rpc', 'count_sampled', 'max_rpt_ms', 'sample_tid',
    'error_signature', 'likely_dependency', 'severity', 'grafana_url', 'notes'
]

REQUIRED = {'created_at_gmt7', 'window_gmt7', 'env', 'incident_candidate', 'service', 'count_sampled', 'severity'}
SEVERITIES = {'P0', 'P1', 'P2', 'P3', 'P4', 'info', 'unknown'}

SECRET_PATTERNS = [
    re.compile(r'https://chat\.googleapis\.com/v1/spaces/[^\s]+', re.I),
    re.compile(r'Authorization\s*:\s*Bearer\s+[A-Za-z0-9._\-]+', re.I),
    re.compile(r'Bearer\s+(gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_\-]{20,}|ya29\.[A-Za-z0-9_\-]+)', re.I),
    re.compile(r'gh[pousr]_[A-Za-z0-9_]{30,}', re.I),
    re.compile(r'sk-[A-Za-z0-9_\-]{24,}', re.I),
    re.compile(r'AIza[0-9A-Za-z_\-]{20,}', re.I),
    re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'),
    re.compile(r'(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*["\']?[^\s,"\']{12,}'),
    re.compile(r'(?i)(postgres|mysql|mongodb(?:\+srv)?)://[^\s:@]+:[^\s@]+@'),
]

SAMPLE_ROW = [
    '2026-05-15 22:30:00',
    '2026-05-15T12:00:00Z to 2026-05-15T15:00:00Z',
    'prod-v2',
    'HPC/R4M downstream timeout spike',
    'commerce-api',
    '/api/orders',
    '504',
    12,
    8421.5,
    'tid-sample-001',
    'timeout calling point-wallet mid=<id>',
    'customer point / point-wallet',
    'P3',
    'https://grafana.example.com/d/example?var-tid=tid-sample-001',
    'Auto-generated from Quickwit/Grafana; payload sanitized',
]


def row_to_dict(row):
    if isinstance(row, dict):
        return {k: row.get(k, '') for k in HEADERS}
    if isinstance(row, list):
        if len(row) != len(HEADERS):
            raise ValueError(f'row has {len(row)} columns, expected {len(HEADERS)}')
        return dict(zip(HEADERS, row))
    raise ValueError(f'unsupported row type: {type(row).__name__}')


def has_secret(value: str) -> str | None:
    text = str(value or '')
    for pat in SECRET_PATTERNS:
        if pat.search(text):
            return pat.pattern
    return None


def is_number(value) -> bool:
    if value in ('', None):
        return True
    try:
        float(value)
        return True
    except Exception:
        return False


def is_intish(value) -> bool:
    try:
        return int(value) >= 0
    except Exception:
        return False


def validate_header(headers):
    return list(headers) == HEADERS


def validate_row(row, index=1):
    errors = []
    try:
        data = row_to_dict(row)
    except Exception as e:
        return [f'row {index}: {e}']

    for col in REQUIRED:
        if str(data.get(col, '')).strip() == '':
            errors.append(f'row {index}: missing required {col}')

    if not is_intish(data.get('count_sampled')):
        errors.append(f'row {index}: count_sampled must be integer >= 0')

    if not is_number(data.get('max_rpt_ms')):
        errors.append(f'row {index}: max_rpt_ms must be numeric when present')
    elif str(data.get('max_rpt_ms', '')).strip() not in ('', 'None') and float(data.get('max_rpt_ms')) < 0:
        errors.append(f'row {index}: max_rpt_ms must be >= 0')

    sev = str(data.get('severity', '')).strip()
    if sev and sev not in SEVERITIES:
        errors.append(f'row {index}: severity must be one of {sorted(SEVERITIES)}')

    rpc = str(data.get('rpc', '')).strip()
    if rpc and not rpc.isdigit():
        errors.append(f'row {index}: rpc must be numeric when present')

    url = str(data.get('grafana_url', '')).strip()
    if url:
        parsed = urlparse(url)
        if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
            errors.append(f'row {index}: grafana_url must be http(s) URL when present')
        if 'token=' in url.lower() or 'auth=' in url.lower() or 'api_key=' in url.lower():
            errors.append(f'row {index}: grafana_url appears to contain credential-like query parameter')

    for col, val in data.items():
        matched = has_secret(str(val))
        if matched:
            errors.append(f'row {index}: potential secret in {col}')

    return errors


def load_rows(path: Path):
    if path.suffix.lower() == '.json':
        data = json.loads(path.read_text(encoding='utf-8'))
        if isinstance(data, dict) and 'rows' in data:
            data = data['rows']
        return data
    if path.suffix.lower() in {'.csv', '.tsv'}:
        dialect = 'excel-tab' if path.suffix.lower() == '.tsv' else 'excel'
        with path.open(newline='', encoding='utf-8') as f:
            reader = csv.reader(f, dialect=dialect)
            rows = list(reader)
        if rows and validate_header(rows[0]):
            return rows[1:]
        return rows
    raise SystemExit(f'unsupported file type: {path}')


def main():
    ap = argparse.ArgumentParser(description='Validate Nova Google Sheets reporting rows offline')
    ap.add_argument('--rows', type=Path, help='JSON/CSV/TSV rows to validate')
    ap.add_argument('--sample', action='store_true', help='validate built-in sample row')
    ap.add_argument('--print-headers', action='store_true')
    args = ap.parse_args()

    if args.print_headers:
        print(json.dumps(HEADERS, ensure_ascii=False))
        return 0

    if args.sample:
        rows = [SAMPLE_ROW]
    elif args.rows:
        rows = load_rows(args.rows)
    else:
        ap.error('use --sample or --rows PATH')

    all_errors = []
    for i, row in enumerate(rows, start=1):
        all_errors.extend(validate_row(row, i))

    result = {
        'ok': not all_errors,
        'row_count': len(rows),
        'headers': HEADERS,
        'errors': all_errors,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not all_errors else 2


if __name__ == '__main__':
    raise SystemExit(main())
