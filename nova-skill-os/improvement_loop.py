#!/usr/bin/env python3
"""Nova Improvement Loop v1.

Report-only self-improvement scanner inspired by Hermes-style learning loops.
It never installs, deletes, enables, disables, sends external messages, or edits
skills automatically. It creates a local improvement report with evidence and
proposed actions for Nick/Nova to approve separately.
"""
from __future__ import annotations

import argparse
import itertools
import json
import re
import subprocess
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path('/Users/nova/.openclaw/workspace')
SKILLS_JSON = ROOT / 'nova-skill-os' / 'skills.json'
REPORT_DIR = ROOT / 'research' / 'improvement-loop'
MEMORY_DIR = ROOT / 'memory'
HARNESS = ROOT / 'nova-harness' / 'nova-harness'

FAILURE_PATTERNS = [
    (re.compile(r'(?i)MEDIA.*(?:not|ไม่).*Telegram|Telegram.*MEDIA|render.*voice'), 'telegram_media_delivery', 'Prefer nova-voice-send for Telegram voice delivery instead of relying only on MEDIA lines.'),
    (re.compile(r'(?i)NO_REPLY|not-delivered|deliveryStatus.*not'), 'silent_or_missing_delivery', 'Scheduled user-facing jobs need explicit delivery target and clear non-silent policy.'),
    (re.compile(r'(?i)rate limit|API rate limit'), 'api_rate_limit', 'Add retry/backoff or fallback model for scheduled jobs that must report.'),
    (re.compile(r'(?i)secret|token|credential|\.unsafe|quarantine'), 'secret_safety', 'Keep repo-pack and GitHub checkpoint secret scans in the quality gate.'),
    (re.compile(r'(?i)timed out|timeout'), 'timeout', 'Avoid tight loops; use longer single waits, background jobs, or narrower checks.'),
]


def run(cmd: list[str], timeout: int = 60, env: dict[str, str] | None = None) -> tuple[bool, str]:
    try:
        run_env = None
        if env:
            import os
            run_env = {**os.environ, **env}
        p = subprocess.run(cmd, cwd=str(ROOT), text=True, capture_output=True, timeout=timeout, env=run_env)
        return p.returncode == 0, ((p.stdout or '') + ('\n' + p.stderr if p.stderr else '')).strip()
    except Exception as exc:
        return False, f'{type(exc).__name__}: {exc}'


def recent_memory_files(days: int) -> list[Path]:
    today = datetime.now(timezone.utc).astimezone().date()
    files = []
    for i in range(days):
        p = MEMORY_DIR / f'{today - timedelta(days=i)}.md'
        if p.exists():
            files.append(p)
    return files


def scan_failure_patterns(files: list[Path]) -> list[dict[str, Any]]:
    hits: dict[str, dict[str, Any]] = {}
    for p in files:
        text = p.read_text(encoding='utf-8', errors='ignore')
        for rx, key, recommendation in FAILURE_PATTERNS:
            matches = rx.findall(text)
            if matches:
                item = hits.setdefault(key, {'pattern': key, 'count': 0, 'sources': [], 'recommendation': recommendation})
                item['count'] += len(matches)
                item['sources'].append(str(p.relative_to(ROOT)))
    return sorted(hits.values(), key=lambda x: (-x['count'], x['pattern']))


def skill_lifecycle() -> dict[str, Any]:
    data = json.loads(SKILLS_JSON.read_text(encoding='utf-8'))
    by_status = Counter((x.get('status') or 'unknown') for x in data)
    by_risk = Counter((x.get('risk_level') or 'unknown') for x in data)
    review = []
    for item in data:
        reasons = []
        if item.get('risk_level') == 'high': reasons.append('high risk')
        if item.get('requires_approval'): reasons.append('requires approval')
        if not item.get('source_files'): reasons.append('no source_files metadata')
        if not item.get('triggers'): reasons.append('no triggers')
        if item.get('status') not in {'active', 'pinned', 'archived', 'draft'}: reasons.append('unknown status')
        if reasons:
            review.append({'id': item.get('id'), 'name': item.get('name_en') or item.get('name_th'), 'reasons': reasons})
    return {'total': len(data), 'status': dict(by_status), 'risk': dict(by_risk), 'review_queue': review}


def skill_curator_v2() -> dict[str, Any]:
    """Report-only skill curator. It never edits, archives, pins, deletes, or enables skills."""
    data = json.loads(SKILLS_JSON.read_text(encoding='utf-8'))
    by_trigger: dict[str, list[str]] = defaultdict(list)
    by_source: dict[str, list[str]] = defaultdict(list)
    findings: list[dict[str, Any]] = []

    for item in data:
        sid = item.get('id') or '?'
        name = item.get('name_en') or item.get('name_th') or sid
        triggers = [str(t).strip().lower() for t in item.get('triggers') or [] if str(t).strip()]
        sources = [str(s).strip() for s in item.get('source_files') or [] if str(s).strip()]
        for trigger in triggers:
            by_trigger[trigger].append(sid)
        for source in sources:
            by_source[source].append(sid)

        source_warnings = []
        missing_sources = []
        for source in sources:
            source_path = ROOT / source
            if not source_path.exists():
                missing_sources.append(source)
            if any(marker in source.lower() for marker in ('external/', '.env', 'credential', 'secret', 'token')):
                source_warnings.append(source)

        reasons = []
        severity = 'info'
        if missing_sources:
            severity = 'warn'
            reasons.append(f'missing source files: {", ".join(missing_sources[:3])}')
        if source_warnings:
            severity = 'warn'
            reasons.append(f'source path needs privacy/supply-chain review: {", ".join(source_warnings[:3])}')
        if item.get('risk_level') == 'high' and not item.get('requires_approval'):
            severity = 'warn'
            reasons.append('high-risk skill does not require approval')
        if item.get('status') == 'active' and item.get('risk_level') == 'high':
            reasons.append('active high-risk skill should have clear guardrails')
        if not triggers:
            severity = 'warn'
            reasons.append('missing triggers')
        if not sources:
            reasons.append('missing source_files metadata')

        if reasons:
            findings.append({'id': sid, 'name': name, 'severity': severity, 'reasons': reasons, 'proposal': 'review metadata/guardrails; do not auto-edit'})

    duplicate_triggers = [{'trigger': trigger, 'skill_ids': sorted(set(ids))} for trigger, ids in sorted(by_trigger.items()) if len(set(ids)) >= 3]
    shared_sources = [{'source_file': source, 'skill_ids': sorted(set(ids))} for source, ids in sorted(by_source.items()) if len(set(ids)) >= 2]
    trigger_sets = {item.get('id') or '?': {str(t).strip().lower() for t in item.get('triggers') or [] if str(t).strip()} for item in data}
    overlaps = []
    for left, right in itertools.combinations(sorted(trigger_sets), 2):
        common = sorted(trigger_sets[left] & trigger_sets[right])
        if len(common) >= 3:
            overlaps.append({'skill_ids': [left, right], 'shared_triggers': common[:8]})

    return {
        'mode': 'report-only',
        'summary': {'findings': len(findings), 'duplicate_triggers': len(duplicate_triggers), 'shared_sources': len(shared_sources), 'trigger_overlaps': len(overlaps)},
        'findings': sorted(findings, key=lambda x: (x['severity'] != 'warn', x['id']))[:50],
        'duplicate_triggers': duplicate_triggers[:30],
        'shared_sources': shared_sources[:30],
        'trigger_overlaps': overlaps[:30],
    }


def memory_reflection_proposal(files: list[Path]) -> dict[str, Any]:
    """Draft memory updates from recent daily notes without applying them."""
    signal_patterns = [
        (re.compile(r'(?i)durable lesson:?\s*(.+)'), 'durable_lesson'),
        (re.compile(r'(?i)verdict:?\s*(.+)'), 'verdict'),
        (re.compile(r'(?i)guardrail:?\s*(.+)'), 'guardrail'),
        (re.compile(r'(?i)policy:?\s*(.+)'), 'policy'),
        (re.compile(r'(?i)do not|ห้าม|ต้องขออนุมัติ|approval'), 'boundary'),
    ]
    candidates: list[dict[str, Any]] = []
    seen = set()
    for p in files:
        for line_no, line in enumerate(p.read_text(encoding='utf-8', errors='ignore').splitlines(), start=1):
            clean = line.strip().lstrip('-').strip()
            if len(clean) < 24:
                continue
            for rx, kind in signal_patterns:
                m = rx.search(clean)
                if not m:
                    continue
                text = (m.group(1).strip() if m.lastindex else clean)
                key = re.sub(r'\s+', ' ', text.lower())[:180]
                if key in seen:
                    continue
                seen.add(key)
                candidates.append({'kind': kind, 'source': f'{p.relative_to(ROOT)}:{line_no}', 'proposal': text[:500], 'action': 'review_before_MEMORY.md_update'})
                break
    return {'mode': 'proposal-only', 'policy': 'Do not write MEMORY.md automatically; Nick/Nova must review and curate.', 'candidate_count': len(candidates), 'candidates': candidates[:30]}


def harness_summary() -> dict[str, Any]:
    ok, out = run([str(HARNESS), 'check', '--json', '--no-tts'], timeout=240, env={'NOVA_HARNESS_SKIP_IMPROVEMENT': '1'})
    try:
        data = json.loads(out)
        return {'ok': ok, 'overall': data.get('overall'), 'failed': data.get('failed'), 'warned': data.get('warned'), 'check_count': len(data.get('checks', []))}
    except Exception:
        return {'ok': ok, 'overall': 'unknown', 'error': out[-500:]}


def git_checkpoint() -> dict[str, Any]:
    ok_log, log = run(['git', 'log', '--oneline', '-1'], timeout=10)
    ok_status, status = run(['git', 'status', '--short'], timeout=10)
    dirty_lines = [x for x in status.splitlines() if x.strip()] if ok_status else []
    return {'last_commit': log if ok_log else 'unknown', 'dirty_count': len(dirty_lines), 'dirty_preview': dirty_lines[:20]}


def proposed_actions(failures: list[dict[str, Any]], skills: dict[str, Any], harness: dict[str, Any], git: dict[str, Any]) -> list[dict[str, str]]:
    actions = []
    if failures:
        actions.append({'type': 'playbook_update', 'title': 'Distill recurring failure patterns into playbooks/harness', 'approval': 'safe-doc-change'})
    if skills.get('review_queue'):
        actions.append({'type': 'skill_metadata', 'title': 'Add missing source_files/risk metadata for reviewed Skill OS entries', 'approval': 'safe-local-edit'})
    if harness.get('overall') != 'pass':
        actions.append({'type': 'quality_gate', 'title': 'Fix failing/warning harness checks before new platform work', 'approval': 'required-before-claiming-done'})
    if git.get('dirty_count', 0) > 0:
        actions.append({'type': 'rollback', 'title': 'Checkpoint sanitized stable changes after verification', 'approval': 'push-only-after-secret-scan'})
    actions.append({'type': 'guardrail', 'title': 'Keep loop report-only; draft skills stay draft until Nick approves', 'approval': 'always'})
    return actions


def write_report(days: int) -> tuple[Path, dict[str, Any]]:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).astimezone()
    mem_files = recent_memory_files(days)
    failures = scan_failure_patterns(mem_files)
    skills = skill_lifecycle()
    curator = skill_curator_v2()
    reflection = memory_reflection_proposal(mem_files)
    harness = harness_summary()
    git = git_checkpoint()
    actions = proposed_actions(failures, skills, harness, git)
    report = {
        'generated_at': now.isoformat(),
        'mode': 'report-only',
        'guardrails': ['no install', 'no delete', 'no external send', 'no auto-enable skills', 'human approval for risky changes'],
        'memory_files_scanned': [str(p.relative_to(ROOT)) for p in mem_files],
        'failure_patterns': failures,
        'skill_lifecycle': skills,
        'skill_curator_v2': curator,
        'memory_reflection_proposal': reflection,
        'harness': harness,
        'git_checkpoint': git,
        'proposed_actions': actions,
    }
    path = REPORT_DIR / f'improvement-report-{now.strftime("%Y%m%d-%H%M%S")}.json'
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

    md = path.with_suffix('.md')
    lines = [
        '# Nova Improvement Loop Report', '',
        f'- Generated: {report["generated_at"]}',
        '- Mode: report-only',
        f'- Memory files scanned: {len(mem_files)}',
        f'- Harness: {harness.get("overall")} ({harness.get("check_count", 0)} checks)',
        f'- Skill review queue: {len(skills.get("review_queue", []))}',
        f'- Curator v2 findings: {curator.get("summary", {}).get("findings", 0)}',
        f'- Memory reflection candidates: {reflection.get("candidate_count", 0)}',
        f'- Git dirty count: {git.get("dirty_count")}', '',
        '## Failure patterns',
    ]
    if failures:
        for f in failures:
            lines.append(f'- **{f["pattern"]}** x{f["count"]}: {f["recommendation"]} Sources: {", ".join(sorted(set(f["sources"]))) }')
    else:
        lines.append('- none detected')
    lines += ['', '## Proposed actions']
    for a in actions:
        lines.append(f'- **{a["type"]}** — {a["title"]} _(approval: {a["approval"]})_')
    lines += ['', '## Skill Curator v2']
    for finding in curator.get('findings', [])[:12]:
        lines.append(f'- **{finding["id"]}** ({finding["severity"]}): {"; ".join(finding["reasons"])}')
    if not curator.get('findings'):
        lines.append('- no findings')
    lines += ['', '## Memory reflection proposal']
    for candidate in reflection.get('candidates', [])[:12]:
        lines.append(f'- **{candidate["kind"]}** from {candidate["source"]}: {candidate["proposal"]}')
    if not reflection.get('candidates'):
        lines.append('- no candidates')
    lines += ['', '## Guardrail', 'This loop does not install, delete, send externally, enable skills automatically, or write MEMORY.md automatically.']
    md.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return path, report


def main() -> int:
    ap = argparse.ArgumentParser(description='Generate Nova self-improvement report (report-only).')
    ap.add_argument('--days', type=int, default=7)
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args()
    path, report = write_report(max(args.days, 1))
    if args.json:
        print(json.dumps({'report': str(path), **report}, ensure_ascii=False, indent=2))
    else:
        print(f'Nova Improvement Loop report: {path}')
        print(f"Harness: {report['harness'].get('overall')} · Skills to review: {len(report['skill_lifecycle'].get('review_queue', []))} · Curator findings: {report['skill_curator_v2'].get('summary', {}).get('findings', 0)} · Memory proposals: {report['memory_reflection_proposal'].get('candidate_count', 0)} · Failure patterns: {len(report['failure_patterns'])}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
