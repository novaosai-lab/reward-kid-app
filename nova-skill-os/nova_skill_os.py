#!/usr/bin/env python3
"""Tiny local command helpers for Nova Skill OS MVP."""
from __future__ import annotations

import csv
import json
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/Users/nova/.openclaw/workspace')
SKILLS = ROOT / 'nova-skill-os/skills.json'
ALERT_CSV = ROOT / 'discord-alert-forwarder/data/prod_order_alerts.csv'
SHEET_URL = 'https://docs.google.com/spreadsheets/d/17bzvqdCf0IHqYvF37eqdEslDSMRRS431WUFYlljkMCw/edit#gid=0'


def run(cmd: list[str]) -> str:
    try:
        return subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT, timeout=30).strip()
    except Exception as exc:
        return f'ERROR: {type(exc).__name__}'


def load_skills() -> list[dict]:
    return json.loads(SKILLS.read_text())


def skills() -> None:
    data = load_skills()
    groups: dict[str, list[dict]] = {}
    for item in data:
        groups.setdefault(item['category'], []).append(item)
    for cat, items in sorted(groups.items()):
        print(f'\n{cat.upper()}')
        for item in items:
            approval = 'approval' if item.get('requires_approval') else 'auto'
            print(f"- {item['name_th']} ({item['id']}) — {item['status']} · risk={item['risk_level']} · {approval}")
            print(f"  {item['description']}")


def alert_dashboard() -> None:
    print(SHEET_URL)


def alert_summary() -> None:
    if not ALERT_CSV.exists():
        print('ยังไม่มี alert CSV')
        return
    rows = list(csv.DictReader(ALERT_CSV.open(encoding='utf-8')))
    print(f'Total local alerts: {len(rows)}')
    for label, key in [('Category', 'category'), ('Impact', 'impact'), ('Endpoint', 'endpoint'), ('ErrCode', 'err_code')]:
        c = Counter((r.get(key) or '-').strip() or '-' for r in rows)
        print(f'\n{label}')
        for name, count in c.most_common(8):
            print(f'- {name}: {count}')
    print(f'\nDashboard: {SHEET_URL}')


def skill_lifecycle_report() -> None:
    data = load_skills()
    now = datetime.now(timezone.utc).date().isoformat()
    print(f'Nova Skill OS lifecycle report — {now}')
    print(f'Total skills: {len(data)}')
    by_status = Counter((x.get('status') or 'unknown') for x in data)
    by_risk = Counter((x.get('risk_level') or 'unknown') for x in data)
    print('\nStatus')
    for k, v in sorted(by_status.items()): print(f'- {k}: {v}')
    print('\nRisk')
    for k, v in sorted(by_risk.items()): print(f'- {k}: {v}')

    review = []
    for item in data:
        reasons = []
        if item.get('risk_level') == 'high': reasons.append('high risk')
        if item.get('requires_approval'): reasons.append('requires approval')
        if not item.get('source_files'): reasons.append('no source_files metadata')
        if not item.get('triggers'): reasons.append('no triggers')
        if item.get('status') not in {'active', 'pinned', 'archived', 'draft'}: reasons.append('unknown status')
        if reasons:
            review.append((item.get('id','?'), item.get('name_en') or item.get('name_th') or '?', reasons))
    print('\nReview queue (report-only; no auto-delete)')
    for sid, name, reasons in review:
        print(f'- {sid} — {name}: {", ".join(reasons)}')
    if not review: print('- none')
    print('\nPolicy: report-only. Archive/delete/enable external actions require Nick approval.')


def openclaw_health() -> None:
    print('Gateway:')
    print(run(['openclaw', 'gateway', 'status']).split('\n')[0:3])
    print('\nChannels:')
    print(run(['openclaw', 'channels', 'status', '--probe']))
    print('\nCron:')
    print(run(['openclaw', 'cron', 'list']))
    print('\nLaunchAgent alert forwarder:')
    print(run(['launchctl', 'list']))


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else 'help'
    if cmd in {'skills', '/nova-skills'}:
        skills()
    elif cmd in {'alert-dashboard', '/alert-dashboard'}:
        alert_dashboard()
    elif cmd in {'alert-summary', '/alert-summary'}:
        alert_summary()
    elif cmd in {'openclaw-health', '/openclaw-health'}:
        openclaw_health()
    elif cmd in {'skill-lifecycle', '/skill-lifecycle'}:
        skill_lifecycle_report()
    else:
        print('Commands: skills | skill-lifecycle | alert-dashboard | alert-summary | openclaw-health')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
