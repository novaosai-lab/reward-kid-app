#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REQUIRED_PANEL_TITLES = {
    'Rows by severity',
    'Rows by service',
    'Incident candidates',
    'Top error signatures',
    'Slow / high rpt endpoints',
}

SECRET_PATTERNS = [
    re.compile(r'https://chat\.googleapis\.com/v1/spaces/[^\s"\']+', re.I),
    re.compile(r'Authorization\s*:\s*Bearer\s+[A-Za-z0-9._\-]+', re.I),
    re.compile(r'Bearer\s+(gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_\-]{20,}|ya29\.[A-Za-z0-9_\-]+)', re.I),
    re.compile(r'gh[pousr]_[A-Za-z0-9_]{30,}', re.I),
    re.compile(r'sk-[A-Za-z0-9_\-]{24,}', re.I),
    re.compile(r'AIza[0-9A-Za-z_\-]{20,}', re.I),
    re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'),
    re.compile(r'(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*["\']?[^\s,"\']{12,}'),
]


def main() -> int:
    ap = argparse.ArgumentParser(description='Validate Nova Grafana dashboard JSON artifact')
    ap.add_argument('path', type=Path)
    args = ap.parse_args()

    errors = []
    raw = args.path.read_text(encoding='utf-8')
    for pat in SECRET_PATTERNS:
        if pat.search(raw):
            errors.append('potential secret/webhook/token in dashboard JSON')
            break

    try:
        data = json.loads(raw)
    except Exception as e:
        print(json.dumps({'ok': False, 'errors': [f'invalid json: {e}']}, ensure_ascii=False, indent=2))
        return 2

    dash = data.get('dashboard') or {}
    panels = dash.get('panels') or []
    titles = {p.get('title') for p in panels}

    if data.get('meta', {}).get('mode') != 'artifact-only' or data.get('meta', {}).get('deploy') is not False:
        errors.append('dashboard must be artifact-only and deploy=false')
    if dash.get('uid') != 'nova-support-digest-sheets':
        errors.append('unexpected dashboard uid')
    missing = sorted(REQUIRED_PANEL_TITLES - titles)
    if missing:
        errors.append(f'missing required panels: {missing}')
    if len(panels) < 5:
        errors.append('expected at least 5 panels')

    datasource_ok = True
    for p in panels:
        ds = p.get('datasource') or {}
        if ds.get('type') != 'grafana-googlesheets-datasource':
            datasource_ok = False
        for t in p.get('targets') or []:
            if 'spreadsheet' not in t or 'sheet' not in t or 'range' not in t:
                errors.append(f"panel {p.get('title')} target missing spreadsheet/sheet/range")
    if not datasource_ok:
        errors.append('all panels must use grafana-googlesheets-datasource placeholder')

    result = {'ok': not errors, 'panels': len(panels), 'titles': sorted(t for t in titles if t), 'errors': errors}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not errors else 2


if __name__ == '__main__':
    raise SystemExit(main())
