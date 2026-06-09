#!/usr/bin/env python3
"""Tiny local command helpers for Nova Skill OS MVP."""
from __future__ import annotations

import csv
import json
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/Users/nova/.openclaw/workspace')
SKILLS = ROOT / 'nova-skill-os/skills.json'
MODULES = ROOT / 'nova-skill-os/modules.json'
PROFILES = ROOT / 'nova-skill-os/profiles.json'
KNOWLEDGE_WIKI = ROOT / 'knowledge-wiki'
CRON_SAFETY_PLAYBOOK = ROOT / 'playbooks/cron-safety-checklist.md'
MEMORY_FENCING_PLAYBOOK = ROOT / 'playbooks/memory-context-fencing.md'
TOOL_LOOP_PLAYBOOK = ROOT / 'playbooks/tool-loop-guardrails.md'
PLUGIN_INTAKE_PLAYBOOK = ROOT / 'playbooks/plugin-intake-check.md'
ARTIFACT_VERIFIER_PLAYBOOK = ROOT / 'playbooks/nova-artifact-verifier.md'
DEFAULT_PLUGIN_INTAKE_PATH = Path('/tmp/claude-plugins-official-review/plugins/example-plugin')
ALERT_CSV = ROOT / 'discord-alert-forwarder/data/prod_order_alerts.csv'
SHEET_URL = 'https://docs.google.com/spreadsheets/d/17bzvqdCf0IHqYvF37eqdEslDSMRRS431WUFYlljkMCw/edit#gid=0'
OPENCLAW = '/opt/homebrew/bin/openclaw'


def run(cmd: list[str]) -> str:
    try:
        return subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT, timeout=30).strip()
    except Exception as exc:
        return f'ERROR: {type(exc).__name__}'


def load_skills() -> list[dict]:
    return json.loads(SKILLS.read_text())


def load_json(path: Path):
    return json.loads(path.read_text())


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


def skill_profiles_report(json_out: bool = False) -> None:
    skills_data = load_skills()
    modules_data = load_json(MODULES)
    profiles_data = load_json(PROFILES)
    skill_ids = {item.get('id') for item in skills_data}
    modules = {item.get('id'): item for item in modules_data.get('modules', [])}
    profiles = profiles_data.get('profiles', {})

    issues: list[str] = []
    for mid, module in modules.items():
        for sid in module.get('skill_ids', []):
            if sid not in skill_ids:
                issues.append(f'module {mid} references unknown skill {sid}')
        for dep in module.get('dependencies', []):
            if dep not in modules:
                issues.append(f'module {mid} references unknown dependency {dep}')
    for pname, profile in profiles.items():
        for mid in profile.get('modules', []):
            if mid not in modules:
                issues.append(f'profile {pname} references unknown module {mid}')
    default_profile = profiles_data.get('default_profile')
    if default_profile not in profiles:
        issues.append(f'default_profile {default_profile!r} not found')

    expanded = {}
    for pname, profile in profiles.items():
        module_ids = profile.get('modules', [])
        skill_list = []
        risk = Counter()
        for mid in module_ids:
            module = modules.get(mid, {})
            risk[module.get('risk_level', 'unknown')] += 1
            skill_list.extend(module.get('skill_ids', []))
        expanded[pname] = {
            'modules': module_ids,
            'skills': sorted(set(skill_list)),
            'module_risk': dict(sorted(risk.items())),
        }

    result = {
        'ok': not issues,
        'mode': 'report-only',
        'default_profile': default_profile,
        'module_count': len(modules),
        'profile_count': len(profiles),
        'issues': issues,
        'profiles': expanded,
        'policy': modules_data.get('policy'),
    }
    if json_out:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    print('Nova Skill OS profiles — report-only')
    print(f"Default profile: {default_profile}")
    print(f"Modules: {len(modules)} · Profiles: {len(profiles)}")
    print('\nProfiles')
    for pname, profile in profiles.items():
        e = expanded[pname]
        print(f"- {pname}: {profile.get('description','')}")
        print(f"  modules={', '.join(e['modules'])}")
        print(f"  skills={', '.join(e['skills']) or '-'}")
    print('\nValidation')
    if issues:
        for issue in issues:
            print(f'- WARN: {issue}')
    else:
        print('- pass: profiles/modules/skills references are consistent')
    print('\nPolicy: report-only. No install/enable/delete/external actions are performed.')


def wiki_status(json_out: bool = False) -> None:
    wiki = KNOWLEDGE_WIKI / 'wiki'
    raw = KNOWLEDGE_WIKI / 'raw'
    index = wiki / 'index.md'
    log = wiki / 'log.md'
    issues: list[str] = []
    if not wiki.exists(): issues.append('missing knowledge-wiki/wiki')
    if not raw.exists(): issues.append('missing knowledge-wiki/raw')
    if not index.exists(): issues.append('missing wiki/index.md')
    if not log.exists(): issues.append('missing wiki/log.md')

    article_files = []
    raw_files = []
    if wiki.exists():
        article_files = sorted(p for p in wiki.glob('*/*.md') if p.is_file())
    if raw.exists():
        raw_files = sorted(p for p in raw.glob('*/*.md') if p.is_file())

    index_text = index.read_text(encoding='utf-8') if index.exists() else ''
    for article in article_files:
        rel = article.relative_to(wiki).as_posix()
        if rel not in index_text:
            issues.append(f'article missing from index: {rel}')

    link_re = re.compile(r'\[[^\]]+\]\(([^)]+)\)')
    for md in article_files + ([index] if index.exists() else []):
        text = md.read_text(encoding='utf-8')
        base = md.parent
        for target in link_re.findall(text):
            if '://' in target or target.startswith('#'):
                continue
            clean = target.split('#', 1)[0]
            if not clean:
                continue
            if not (base / clean).resolve().exists():
                issues.append(f'broken link in {md.relative_to(KNOWLEDGE_WIKI)}: {target}')

    result = {
        'ok': not issues,
        'mode': 'report-only',
        'wiki_articles': len(article_files),
        'raw_sources': len(raw_files),
        'has_index': index.exists(),
        'has_log': log.exists(),
        'issues': issues,
    }
    if json_out:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    print('Nova Knowledge Wiki status — report-only')
    print(f"Articles: {len(article_files)} · Raw sources: {len(raw_files)} · index={index.exists()} · log={log.exists()}")
    print('\nValidation')
    if issues:
        for issue in issues:
            print(f'- WARN: {issue}')
    else:
        print('- pass: wiki structure, index references, and markdown links look consistent')


def improvement_report() -> None:
    script = ROOT / 'nova-skill-os/improvement_loop.py'
    print(run([str(script), '--days', '7']))


def _cron_payload_text(job: dict) -> str:
    payload = job.get('payload') or {}
    return ' '.join(str(payload.get(k) or '') for k in ('message', 'text', 'prompt'))


def cron_safety_report(json_out: bool = False) -> None:
    issues: list[dict] = []
    ok, out = False, ''
    try:
        out = subprocess.check_output([OPENCLAW, 'cron', 'list', '--json', '--all'], text=True, stderr=subprocess.STDOUT, timeout=30).strip()
        ok = True
    except Exception as exc:
        out = f'ERROR: {type(exc).__name__}: {exc}'

    jobs = []
    if ok:
        try:
            jobs = json.loads(out).get('jobs', [])
        except Exception as exc:
            issues.append({'job': '*', 'severity': 'warn', 'issue': f'cron JSON parse failed: {exc}'})

    for job in jobs:
        name = job.get('name') or job.get('id') or '?'
        delivery = job.get('delivery') or {}
        payload = job.get('payload') or {}
        schedule = job.get('schedule') or {}
        text = _cron_payload_text(job)
        mode = delivery.get('mode') or ('announce' if delivery else 'none')
        user_facing = mode == 'announce' or bool(delivery.get('channel') or delivery.get('to'))

        if schedule.get('kind') == 'cron' and not schedule.get('tz'):
            issues.append({'job': name, 'severity': 'warn', 'issue': 'cron schedule has no explicit timezone'})
        if user_facing and not (delivery.get('channel') and delivery.get('to')):
            issues.append({'job': name, 'severity': 'warn', 'issue': 'user-facing delivery needs explicit channel and to'})
        if mode == 'none' and payload.get('kind') == 'agentTurn' and not any(x in text.lower() for x in ('report-only', 'no external send', 'keep internal', 'silent')):
            issues.append({'job': name, 'severity': 'warn', 'issue': 'silent agentTurn should state report-only/internal intent'})
        if payload.get('kind') == 'agentTurn' and not payload.get('toolsAllow'):
            issues.append({'job': name, 'severity': 'info', 'issue': 'agentTurn has no toolsAllow scope; acceptable only when job is low-risk'})
        lower = text.lower()
        if any(x in lower for x in ('ignore previous', 'system prompt', 'developer message', 'api key', 'token', 'secret')):
            issues.append({'job': name, 'severity': 'warn', 'issue': 'prompt contains injection/secret-sensitive terms; review manually'})
        if any(x in lower for x in ('curl ', 'wget ', 'rm -rf', 'git reset --hard', 'install.sh')):
            issues.append({'job': name, 'severity': 'warn', 'issue': 'prompt mentions risky shell/destructive/install action'})

    result = {
        'ok': ok and not any(i['severity'] == 'warn' for i in issues),
        'mode': 'report-only',
        'job_count': len(jobs),
        'issue_count': len(issues),
        'issues': issues,
        'playbook': str(CRON_SAFETY_PLAYBOOK),
        'policy': 'Review only. Do not create, update, remove, run, or deliver cron jobs from this report.',
    }
    if not ok:
        result['error'] = out[-500:]
    if json_out:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    print('Nova Cron Safety Report — report-only')
    print(f"Jobs: {len(jobs)} · Issues: {len(issues)} · Playbook: {CRON_SAFETY_PLAYBOOK.name}")
    if issues:
        for item in issues[:40]:
            print(f"- {item['severity'].upper()} {item['job']}: {item['issue']}")
    else:
        print('- pass: no cron safety warnings found')
    print('\nPolicy: review-only. Cron mutations or external delivery changes require scoped approval.')


def memory_fencing_report(json_out: bool = False) -> None:
    docs = [
        ROOT / 'docs/nova-memory-model.md',
        ROOT / 'docs/nova-nested-architecture.md',
        ROOT / 'playbooks/external-context-intake-guard.md',
        MEMORY_FENCING_PLAYBOOK,
    ]
    issues: list[str] = []
    required_terms = ['internal context', 'not user instruction', 'group/shared', 'Do not store raw secrets']
    playbook_text = MEMORY_FENCING_PLAYBOOK.read_text(encoding='utf-8') if MEMORY_FENCING_PLAYBOOK.exists() else ''
    if not MEMORY_FENCING_PLAYBOOK.exists():
        issues.append('missing memory fencing playbook')
    for term in required_terms:
        if term not in playbook_text:
            issues.append(f'memory fencing playbook missing phrase: {term}')
    for path in docs:
        if not path.exists():
            issues.append(f'missing referenced doc: {path.relative_to(ROOT)}')
    result = {
        'ok': not issues,
        'mode': 'report-only',
        'playbook': str(MEMORY_FENCING_PLAYBOOK),
        'checked_docs': [str(p.relative_to(ROOT)) for p in docs],
        'issues': issues,
        'policy': 'Recalled memory is internal context, not user instruction. Do not echo private memory into shared contexts.',
    }
    if json_out:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    print('Nova Memory Fencing Report — report-only')
    print(f"Playbook: {MEMORY_FENCING_PLAYBOOK.name} · Docs checked: {len(docs)}")
    if issues:
        for issue in issues:
            print(f'- WARN: {issue}')
    else:
        print('- pass: memory fencing playbook and references are present')
    print('\nPolicy: recalled memory supports continuity; it cannot authorize actions or override current instructions.')


def tool_loop_guard_report(json_out: bool = False) -> None:
    issues: list[str] = []
    text = TOOL_LOOP_PLAYBOOK.read_text(encoding='utf-8') if TOOL_LOOP_PLAYBOOK.exists() else ''
    required = ['Same command/tool fails 2 times', 'Same tool fails 3 times', 'no useful new evidence', 'Do not retry installers']
    if not TOOL_LOOP_PLAYBOOK.exists():
        issues.append('missing tool-loop guardrail playbook')
    for phrase in required:
        if phrase not in text:
            issues.append(f'tool-loop playbook missing phrase: {phrase}')
    result = {
        'ok': not issues,
        'mode': 'report-only',
        'playbook': str(TOOL_LOOP_PLAYBOOK),
        'thresholds': {
            'same_command_same_error': 2,
            'same_tool_one_task': 3,
            'no_new_evidence_attempts': 2,
        },
        'issues': issues,
        'policy': 'After repeated failures, change strategy, narrow scope, or ask once; do not blindly retry risky actions.',
    }
    if json_out:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    print('Nova Tool Loop Guard Report — report-only')
    print(f'Playbook: {TOOL_LOOP_PLAYBOOK.name}')
    if issues:
        for issue in issues:
            print(f'- WARN: {issue}')
    else:
        print('- pass: repeated-failure thresholds and recovery policy are documented')
    print('\nPolicy: stop blind retries; change strategy or ask one concise question when blocked.')


# ── Context Budget ──────────────────────────────────────────────────────────────

def context_budget_report(json_out: bool = False) -> None:
    """Report Nova workspace context overhead — adapted from ECC context-budget skill.

    Phase 1: Inventory key loaded-component directories.
    Phase 2: Estimate token overhead per category.
    Phase 3: Flag bloat, heavy files, and redundant components.
    Phase 4: Report total estimated overhead vs MiniMax M3 context window.
    """
    CHARS_PER_TOKEN = 4  # English average; Thai averages ~3 but conservative estimate
    # MiniMax M3 context window ≈ 32K–128K tokens; use 128K as ceiling reference
    M3_CONTEXT = 128_000

    root = Path(__file__).parent.parent  # workspace root
    findings: list[dict] = []
    total_tokens = 0

    # ── Bootstrap files (always loaded in main session) ──────────────────────
    bootstrap_map = {
        'SOUL.md':          200,
        'USER.md':          200,
        'MEMORY.md':       1000,
        'TOOLS.md':         800,
        'AGENTS.md':        500,
        'IDENTITY.md':      200,
        'HEARTBEAT.md':     200,
        'MEMORY_HOT.md':    400,
    }
    bootstrap_total = 0
    for name, threshold in bootstrap_map.items():
        path = root / name
        if not path.exists():
            continue
        size = path.stat().st_size
        tokens = size // CHARS_PER_TOKEN
        bootstrap_total += tokens
        if tokens > threshold:
            findings.append({
                'severity': 'WARN',
                'category': 'bootstrap',
                'file': name,
                'tokens': tokens,
                'threshold': threshold,
                'message': f'{name}: ~{tokens:,} tokens (>{threshold:,} threshold)',
                'action': f'consider trimming or archiving old content'
            })
        else:
            findings.append({
                'severity': 'OK',
                'category': 'bootstrap',
                'file': name,
                'tokens': tokens,
                'threshold': threshold,
                'message': f'{name}: ~{tokens:,} tokens',
                'action': None
            })
    total_tokens += bootstrap_total

    # ── Skills (SKILL.md files) — loaded when skill is invoked ───────────────
    skills_dir = root / 'skills'
    skills_total = 0
    skills_files = 0
    if skills_dir.is_dir():
        for skill_dir in sorted(skills_dir.iterdir()):
            if not skill_dir.is_dir():
                continue
            skill_md = skill_dir / 'SKILL.md'
            if not skill_md.exists():
                continue
            size = skill_md.stat().st_size
            tokens = size // CHARS_PER_TOKEN
            skills_total += tokens
            skills_files += 1
            if tokens > 400:
                findings.append({
                    'severity': 'WARN',
                    'category': 'skills',
                    'file': str(skill_md.relative_to(root)),
                    'tokens': tokens,
                    'threshold': 400,
                    'message': f'skills/{skill_dir.name}: ~{tokens:,} tokens (>400 threshold)',
                    'action': 'consider reducing SKILL.md to essentials or splitting into sub-files'
                })
    total_tokens += skills_total

    # ── Prompts (specialist .md files) — loaded when agent spawns ──────────
    prompts_dir = root / 'prompts'
    prompts_total = 0
    prompts_files = 0
    if prompts_dir.is_dir():
        for prompt_md in sorted(prompts_dir.glob('*.md')):
            size = prompt_md.stat().st_size
            tokens = size // CHARS_PER_TOKEN
            prompts_total += tokens
            prompts_files += 1
            if tokens > 200:
                findings.append({
                    'severity': 'WARN',
                    'category': 'prompts',
                    'file': str(prompt_md.relative_to(root)),
                    'tokens': tokens,
                    'threshold': 200,
                    'message': f'prompts/{prompt_md.name}: ~{tokens:,} tokens (>200 threshold)',
                    'action': 'consider shortening specialist prompt to core instructions only'
                })
    total_tokens += prompts_total

    # ── Playbooks (.md files) — loaded on demand ────────────────────────────
    playbooks_dir = root / 'playbooks'
    playbooks_total = 0
    playbooks_files = 0
    if playbooks_dir.is_dir():
        for pb in sorted(playbooks_dir.glob('*.md')):
            size = pb.stat().st_size
            tokens = size // CHARS_PER_TOKEN
            playbooks_total += tokens
            playbooks_files += 1
            if tokens > 300:
                findings.append({
                    'severity': 'WARN',
                    'category': 'playbooks',
                    'file': str(pb.relative_to(root)),
                    'tokens': tokens,
                    'threshold': 300,
                    'message': f'playbooks/{pb.name}: ~{tokens:,} tokens (>300 threshold)',
                    'action': 'consider archiving or trimming playbook'
                })
    total_tokens += playbooks_total

    # ── Recent memory files (last 14 days) — loaded in main session ─────────
    memory_dir = root / 'memory'
    memory_total = 0
    memory_files = 0
    import time, datetime
    cutoff = time.time() - 14 * 86400  # 14 days
    if memory_dir.is_dir():
        for mf in sorted(memory_dir.glob('*.md'), reverse=True):
            if mf.stat().st_mtime < cutoff:
                break  # stop after first old file (files are sorted by name≈date)
            size = mf.stat().st_size
            tokens = size // CHARS_PER_TOKEN
            memory_total += tokens
            memory_files += 1
            if tokens > 2000:
                findings.append({
                    'severity': 'WARN',
                    'category': 'memory',
                    'file': str(mf.relative_to(root)),
                    'tokens': tokens,
                    'threshold': 2000,
                    'message': f'{mf.name}: ~{tokens:,} tokens (>2,000 threshold)',
                    'action': 'consider archiving or trimming daily memory file'
                })
    total_tokens += memory_total

    # ── Research (recent 30 days) — loaded on demand ────────────────────────
    # NOTE: only scan research/ top-level .md files, NOT external/ or deep subdirs
    # (external repos live under external/ and are not in-session unless explicitly loaded)
    research_dir = root / 'research'
    research_total = 0
    research_files = 0
    research_cutoff = time.time() - 30 * 86400
    if research_dir.is_dir():
        for rf in sorted(research_dir.glob('*.md'), reverse=True):
            if rf.stat().st_mtime < research_cutoff:
                break
            size = rf.stat().st_size
            tokens = size // CHARS_PER_TOKEN
            research_total += tokens
            research_files += 1
            if tokens > 500:
                findings.append({
                    'severity': 'INFO',
                    'category': 'research',
                    'file': str(rf.relative_to(root)),
                    'tokens': tokens,
                    'threshold': 500,
                    'message': f'{rf.name}: ~{tokens:,} tokens (>500 — large research artifact)',
                    'action': 'consider whether this belongs in memory/ or can be archived'
                })
    total_tokens += research_total

    # ── Summary ───────────────────────────────────────────────────────────────
    pct = total_tokens / M3_CONTEXT * 100
    warns = [f for f in findings if f['severity'] in ('WARN', 'INFO')]

    if json_out:
        import json as _json
        print(_json.dumps({
            'total_tokens': total_tokens,
            'context_ceiling': M3_CONTEXT,
            'pct_used': round(pct, 1),
            'categories': {
                'bootstrap': {'tokens': bootstrap_total, 'files': 8},
                'skills':    {'tokens': skills_total,    'files': skills_files},
                'prompts':   {'tokens': prompts_total,   'files': prompts_files},
                'playbooks': {'tokens': playbooks_total, 'files': playbooks_files},
                'memory':    {'tokens': memory_total,    'files': memory_files},
                'research':  {'tokens': research_total,  'files': research_files},
            },
            'findings': findings,
        }, indent=2))
        return

    print('══════════════════════════════════════════')
    print('  Nova Context Budget Report')
    print('  (workspace scan — report-only)')
    print('══════════════════════════════════════════')
    print()
    print(f'  MiniMax M3 ceiling:  ~{M3_CONTEXT:,} tokens')
    print(f'  Total estimated:     ~{total_tokens:,} tokens  ({pct:.1f}% of ceiling)')
    print()
    print('  Breakdown')
    print(f'  ├─ bootstrap (always-loaded)  ~{bootstrap_total:>7,} tokens  (8 files)')
    print(f'  ├─ skills (on-demand)         ~{skills_total:>7,} tokens  ({skills_files} SKILL.md files)')
    print(f'  ├─ prompts (agent spawn)       ~{prompts_total:>7,} tokens  ({prompts_files} specialist files)')
    print(f'  ├─ playbooks (on-demand)      ~{playbooks_total:>7,} tokens  ({playbooks_files} playbooks)')
    print(f'  ├─ memory (last 14 days)      ~{memory_total:>7,} tokens  ({memory_files} files)')
    print(f'  └─ research (last 30 days)    ~{research_total:>7,} tokens  ({research_files} artifacts)')
    print()
    if warns:
        print(f'  ⚠ Issues ({len(warns)} flagged)')
        for f in warns:
            print(f'  [{f["severity"]}] {f["message"]}')
            if f['action']:
                print(f'        → {f["action"]}')
    else:
        print('  ✅ No bloat flags. Context overhead is within safe thresholds.')
    print()
    print('  Policy: keep bootstrap <5% of context; prefer report-only artifacts')
    print('          for large content; lazy-load skills/prompts on demand.')
    print()


def _artifact_paths(argv: list[str]) -> list[Path]:
    return [Path(arg).expanduser() for arg in argv[2:] if not arg.startswith('--')]


def _line_number(text: str, offset: int) -> int:
    return text.count('\n', 0, offset) + 1


def _add_artifact_finding(findings: list[dict], severity: str, path: Path, line: int | None, check: str, message: str, action: str) -> None:
    findings.append({'severity': severity, 'path': str(path), 'line': line, 'check': check, 'message': message, 'action': action})


def _critical_output_fields(text: str) -> dict[str, bool]:
    fields = ('claim', 'evidence', 'assumption', 'counterargument', 'unknown')
    present = {}
    for field in fields:
        aliases = field if field != 'unknown' else r'unknowns?|uncertaint(?:y|ies)'
        present[field] = bool(re.search(
            rf'(?im)^\s*(?:#{1,6}\s*)?(?:[-*]\s*)?(?:\*\*)?(?:{aliases})(?:\*\*)?\s*:',
            text,
        ))
    return present


def _verify_artifact(path: Path, critical_output: bool = False) -> dict:
    findings: list[dict] = []
    result = {'path': str(path), 'ok': False, 'status': 'fail', 'metrics': {}, 'findings': findings}
    if not path.exists():
        _add_artifact_finding(findings, 'fail', path, None, 'path', 'artifact path does not exist', 'Fix the path and rerun the verifier.')
        return result
    if not path.is_file():
        _add_artifact_finding(findings, 'fail', path, None, 'path', 'artifact path is not a file', 'Pass one or more markdown files.')
        return result
    if path.suffix.lower() not in {'.md', '.markdown'}:
        _add_artifact_finding(findings, 'warn', path, None, 'format', 'artifact is not a markdown file', 'Use this verifier for markdown artifacts only.')

    text = path.read_text(encoding='utf-8', errors='replace')
    lines = text.splitlines()
    lower = text.lower()
    link_re = re.compile(r'\[[^\]]+\]\(([^)]+)\)|https?://\S+|[\x60\x27][^\x60\x27]*?(?:/|\.md|\.py|\.json)[^\x60\x27]*?[\x60\x27]')
    source_id_re = re.compile(r'\b(?:source|src|ref|evidence|citation)[-_ ]?(?:id)?\s*[:#-]?\s*[A-Za-z0-9_.:/-]+', re.I)
    quote_re = re.compile(r'["“”][^"“”]{24,}["“”]')
    secret_re = re.compile(
        r'(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|'
        r'AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s\x60]{8,})',
        re.I,
    )
    source_section = bool(re.search(r'^#{1,4}\s*(sources?|references?|evidence|citations?)\b', text, re.I | re.M))
    verification_ref = any(term in lower for term in ('verification', 'verified', 'critique', 'review report', 'smoke test', 'quote verification'))
    link_count = len(link_re.findall(text))
    source_id_count = len(source_id_re.findall(text))
    quote_count = len(quote_re.findall(text))
    result['metrics'] = {
        'lines': len(lines),
        'links_or_file_refs': link_count,
        'source_id_mentions': source_id_count,
        'has_source_section': source_section,
        'has_verification_or_critique_ref': verification_ref,
        'quote_like_claims': quote_count,
        'critical_output_mode': critical_output,
    }

    if len(lines) > 20 and not source_section and link_count < 2 and source_id_count < 2:
        _add_artifact_finding(findings, 'warn', path, None, 'source-coverage', 'artifact has low source/citation coverage', 'Add Sources/Evidence section or inline links/source IDs for key claims.')
    if any(term in lower for term in ('research', 'review', 'playbook', 'skill')) and not verification_ref:
        _add_artifact_finding(findings, 'warn', path, None, 'verification', 'artifact does not reference critique, verification, or smoke-test evidence', 'Add a short verification/critique section before promotion.')

    for match in secret_re.finditer(text):
        _add_artifact_finding(findings, 'fail', path, _line_number(text, match.start()), 'secret-redaction', 'secret-looking content found', 'Redact the value and replace it with a placeholder before sharing or promotion.')

    for match in quote_re.finditer(text):
        line_no = _line_number(text, match.start())
        window = '\n'.join(lines[max(0, line_no - 3):min(len(lines), line_no + 2)])
        if not link_re.search(window) and not source_id_re.search(window):
            _add_artifact_finding(findings, 'warn', path, line_no, 'quote-attribution', 'quote-like claim has no nearby source/link', 'Add attribution next to the quote or convert it to a paraphrase with evidence.')
            break

    promotion_terms = ('agents.md', 'skill.md', 'generated skill', 'promote', 'promotion', 'install skill', 'enable skill')
    if any(term in lower for term in promotion_terms):
        if not verification_ref:
            _add_artifact_finding(findings, 'warn', path, None, 'promotion-risk', 'generated AGENTS/SKILL promotion language lacks verification reference', 'Run critique/verification and cite the report before promoting.')
        if not any(term in lower for term in ('report-only', 'approval', 'human approve', 'requires approval', 'do not auto')):
            _add_artifact_finding(findings, 'warn', path, None, 'promotion-risk', 'promotion language lacks approval/report-only boundary', 'State that install/enable/promotion requires human approval.')

    action_risk_re = re.compile(r'\b(?:deploy|publish|send|email|post|tweet|delete|remove|install|enable|activate|restart|migrate|write to production|create pr|open pr)\b', re.I)
    for i, line in enumerate(lines, start=1):
        if action_risk_re.search(line) and not re.search(r'approval|report-only|manual|review|dry-run|sandbox|do not|no auto', line, re.I):
            _add_artifact_finding(findings, 'warn', path, i, 'action-risk', 'action-risk language has no local approval/dry-run qualifier', 'Qualify risky actions with approval, dry-run, sandbox, or report-only wording.')
            break

    if link_count == 0 and source_id_count == 0 and len(lines) > 8:
        _add_artifact_finding(findings, 'warn', path, None, 'source-links', 'no source IDs, file references, or links found', 'Add at least one source link/file reference for non-trivial artifacts.')

    if critical_output:
        critical_fields = _critical_output_fields(text)
        result['metrics']['critical_output_fields'] = critical_fields
        missing_fields = [name for name, present in critical_fields.items() if not present]
        if missing_fields:
            _add_artifact_finding(
                findings,
                'warn',
                path,
                None,
                'critical-output-structure',
                f"critical output is missing structured fields: {', '.join(missing_fields)}",
                'Add claim, evidence, assumption, counterargument, and unknown fields before using the conclusion operationally.',
            )
        if critical_fields['claim'] and not critical_fields['evidence']:
            _add_artifact_finding(
                findings,
                'fail',
                path,
                None,
                'critical-output-evidence',
                'critical output contains a claim without an evidence field',
                'Add grounded evidence or explicitly mark the claim as unverified.',
            )

    fail_count = sum(1 for item in findings if item['severity'] == 'fail')
    warn_count = sum(1 for item in findings if item['severity'] == 'warn')
    result['ok'] = fail_count == 0
    result['status'] = 'fail' if fail_count else ('warn' if warn_count else 'pass')
    return result


def artifact_verifier_report(argv: list[str], json_out: bool = False) -> None:
    paths = _artifact_paths(argv)
    if not paths:
        paths = [ROOT / 'research/mimeo-review-2026-05-25.md']
    critical_output = '--critical-output' in argv
    reports = [_verify_artifact(path if path.is_absolute() else ROOT / path, critical_output=critical_output) for path in paths]
    result = {
        'ok': not any(report['status'] == 'fail' for report in reports),
        'mode': 'report-only',
        'artifact_count': len(reports),
        'critical_output_mode': critical_output,
        'summary': dict(Counter(report['status'] for report in reports)),
        'playbook': str(ARTIFACT_VERIFIER_PLAYBOOK),
        'reports': reports,
        'policy': 'Local markdown inspection only. No files are modified and no data is sent externally.',
    }
    if json_out:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    print('Nova Artifact Verifier - report-only')
    print(f"Artifacts: {len(reports)} · Summary: {result['summary']} · Critical output: {critical_output} · Playbook: {ARTIFACT_VERIFIER_PLAYBOOK.name}")
    for report in reports:
        print(f"\n{report['status'].upper()} {report['path']}")
        metrics = report['metrics']
        if metrics:
            print(
                f"- metrics: lines={metrics['lines']} links_or_refs={metrics['links_or_file_refs']} "
                f"source_ids={metrics['source_id_mentions']} source_section={metrics['has_source_section']} "
                f"verification_ref={metrics['has_verification_or_critique_ref']}"
            )
        if report['findings']:
            for finding in report['findings'][:20]:
                loc = f":{finding['line']}" if finding.get('line') else ''
                print(f"- {finding['severity'].upper()} {finding['check']}{loc}: {finding['message']} Action: {finding['action']}")
        else:
            print('- pass: no verifier warnings found')
    print('\nPolicy: local/report-only. Promotion, install, enable, publish, or external send still requires the normal approval boundary.')


SECRET_FILE_RE = re.compile(r'(^|[._-])(env|secret|secrets|token|tokens|key|keys|credential|credentials)([._-]|$)', re.I)
NETWORK_RE = re.compile(r'\b(curl|wget|fetch|axios|http|https|git\s+clone|npm\s+install|pip\s+install|brew\s+install|docker\s+pull)\b', re.I)
TELEMETRY_RE = re.compile(r'\b(telemetry|analytics|tracking|sentry|posthog|segment|mixpanel|amplitude|usage statistics|crash report)\b', re.I)
DESTRUCTIVE_RE = re.compile(r'\b(rm\s+-rf|unlink|rmdir|delete|format|mkfs|dd\s+if=|chmod\s+777|git\s+reset\s+--hard|git\s+clean\s+-fd)\b', re.I)
WRITE_ACTION_RE = re.compile(r'\b(writeFile|appendFile|createWriteStream|fs\.write|open\([^)]*[wa]\)|sed\s+-i|tee\s+|mv\s+|cp\s+)\b', re.I)
SOURCE_PIN_RE = re.compile(r'\b(commit|sha|source|repository|repo|url|version|revision)\b', re.I)


def _rel(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return str(path)


def _safe_read_text(path: Path, root: Path, max_bytes: int = 200_000) -> tuple[str, str | None]:
    rel = _rel(path, root)
    if SECRET_FILE_RE.search(path.name):
        return '', f'skipped sensitive-looking file content: {rel}'
    try:
        if path.stat().st_size > max_bytes:
            return '', f'skipped large file content: {rel}'
        return path.read_text(encoding='utf-8', errors='replace'), None
    except Exception as exc:
        return '', f'could not read {rel}: {type(exc).__name__}'


def _severity_rank(level: str) -> int:
    return {'info': 0, 'low': 1, 'medium': 2, 'high': 3}.get(level, 0)


def _add_finding(findings: list[dict], level: str, category: str, detail: str, evidence: str | None = None) -> None:
    item = {'level': level, 'category': category, 'detail': detail}
    if evidence:
        item['evidence'] = evidence
    findings.append(item)


def plugin_intake_check(path_arg: str | None = None, json_out: bool = False) -> None:
    target = Path(path_arg).expanduser() if path_arg else DEFAULT_PLUGIN_INTAKE_PATH
    findings: list[dict] = []
    files: list[Path] = []

    if not target.exists():
        result = {
            'ok': False,
            'mode': 'report-only',
            'target': str(target),
            'error': 'target path does not exist',
            'playbook': str(PLUGIN_INTAKE_PLAYBOOK),
            'policy': 'No install, execute, network, or mutation is performed.',
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    root = target.resolve() if target.is_dir() else target.resolve().parent
    if target.is_file():
        files = [target]
    else:
        files = sorted(p for p in target.rglob('*') if p.is_file() and '.git' not in p.parts)

    rel_files = [_rel(p, target) for p in files]
    plugin_manifests = [p for p in files if p.name == 'plugin.json' and p.parent.name == '.claude-plugin']
    mcp_manifests = [p for p in files if p.name == '.mcp.json']
    plugin_manifest = target / '.claude-plugin/plugin.json'
    mcp_manifest = target / '.mcp.json'
    package_files = [p for p in files if p.name in {'package.json', 'pyproject.toml', 'requirements.txt', 'uv.lock', 'Cargo.toml', 'go.mod'}]
    script_files = [p for p in files if p.suffix in {'.sh', '.bash', '.zsh', '.ps1', '.js', '.ts', '.py'} and any(part in {'scripts', 'bin'} for part in p.parts)]
    hook_files = [p for p in files if 'hooks' in p.parts or '.githooks' in p.parts or p.name in {'preinstall', 'postinstall'}]
    skill_dirs = sorted({_rel(p.parent, target) for p in files if p.name == 'SKILL.md' or 'skills' in p.parts})
    agent_dirs = sorted({_rel(p.parent, target) for p in files if 'agents' in p.parts})
    command_dirs = sorted({_rel(p.parent, target) for p in files if 'commands' in p.parts})
    env_files = [p for p in files if p.name.startswith('.env') or SECRET_FILE_RE.search(p.name)]
    license_files = [p for p in files if p.name.lower() in {'license', 'license.md', 'copying', 'notice'}]

    manifests_to_check = plugin_manifests or ([plugin_manifest] if plugin_manifest.exists() else [])
    if manifests_to_check:
        for manifest_path in manifests_to_check[:40]:
            text, issue = _safe_read_text(manifest_path, target)
            if issue:
                _add_finding(findings, 'medium', 'manifest', issue)
                continue
            try:
                manifest = json.loads(text)
                source_blob = json.dumps(manifest, ensure_ascii=False)
                if not SOURCE_PIN_RE.search(source_blob):
                    _add_finding(findings, 'medium', 'missing_source_pin', 'plugin manifest does not expose obvious source/version/SHA metadata', _rel(manifest_path, target))
                if TELEMETRY_RE.search(source_blob):
                    _add_finding(findings, 'medium', 'telemetry', 'plugin manifest references telemetry/analytics terms', _rel(manifest_path, target))
                if NETWORK_RE.search(source_blob):
                    _add_finding(findings, 'medium', 'network_download', 'plugin manifest references network/download/install terms', _rel(manifest_path, target))
            except json.JSONDecodeError as exc:
                _add_finding(findings, 'high', 'manifest', f'plugin.json is not valid JSON: {exc}', _rel(manifest_path, target))
    else:
        _add_finding(findings, 'medium', 'manifest', 'missing .claude-plugin/plugin.json')

    mcp_to_check = mcp_manifests or ([mcp_manifest] if mcp_manifest.exists() else [])
    if mcp_to_check:
        for mcp_path in mcp_to_check[:40]:
            text, issue = _safe_read_text(mcp_path, target)
            if issue:
                _add_finding(findings, 'medium', 'mcp_command', issue)
                continue
            try:
                mcp = json.loads(text)
                servers = mcp.get('mcpServers') or mcp.get('servers') or {}
                iterable = servers.items() if isinstance(servers, dict) else []
                for name, cfg in iterable:
                    if not isinstance(cfg, dict):
                        cfg = {'value': cfg}
                    cmd = ' '.join(str(cfg.get(k) or '') for k in ('command', 'args', 'url', 'transport', 'value'))
                    _add_finding(findings, 'high', 'mcp_command', f'MCP server declares command/transport for manual review: {name}', f'{_rel(mcp_path, target)} {cmd.strip()[:160]}')
                    if NETWORK_RE.search(cmd):
                        _add_finding(findings, 'medium', 'network_download', f'MCP server references network/download terms: {name}', _rel(mcp_path, target))
            except json.JSONDecodeError as exc:
                _add_finding(findings, 'high', 'mcp_command', f'.mcp.json is not valid JSON: {exc}', _rel(mcp_path, target))
    else:
        _add_finding(findings, 'info', 'mcp_command', 'no .mcp.json found')

    for path in files:
        try:
            resolved = path.resolve()
            try:
                resolved.relative_to(root)
            except ValueError:
                _add_finding(findings, 'high', 'path_containment', 'file resolves outside target root', _rel(path, target))
        except Exception as exc:
            _add_finding(findings, 'medium', 'path_containment', f'could not resolve file path: {type(exc).__name__}', _rel(path, target))
        if path.is_symlink():
            _add_finding(findings, 'medium', 'path_containment', 'symlink requires manual containment review', _rel(path, target))

    for path in env_files:
        _add_finding(findings, 'medium', 'credential_env', 'sensitive/env-looking file present; content intentionally not read', _rel(path, target))

    for path in package_files + script_files + hook_files:
        text, issue = _safe_read_text(path, target)
        if issue:
            _add_finding(findings, 'info', 'file_scan', issue)
            continue
        rel = _rel(path, target)
        if NETWORK_RE.search(text):
            _add_finding(findings, 'medium', 'network_download', 'file references network/download/install behavior', rel)
        if TELEMETRY_RE.search(text):
            _add_finding(findings, 'medium', 'telemetry', 'file references telemetry/analytics behavior', rel)
        if DESTRUCTIVE_RE.search(text):
            _add_finding(findings, 'high', 'destructive_write', 'file references destructive shell/file action', rel)
        if WRITE_ACTION_RE.search(text):
            _add_finding(findings, 'medium', 'destructive_write', 'file references filesystem write/move/copy behavior', rel)
        if path.name == 'package.json':
            try:
                package = json.loads(text)
                scripts = package.get('scripts') or {}
                risky_scripts = {k: v for k, v in scripts.items() if k in {'preinstall', 'install', 'postinstall', 'prepare'} or NETWORK_RE.search(str(v))}
                if risky_scripts:
                    _add_finding(findings, 'high', 'hook_execution', 'package lifecycle/network scripts require manual review', rel)
            except json.JSONDecodeError:
                _add_finding(findings, 'medium', 'package_manifest', 'package.json is not valid JSON', rel)

    for path in hook_files:
        _add_finding(findings, 'high', 'hook_execution', 'hook file/directory present', _rel(path, target))

    if not license_files:
        _add_finding(findings, 'medium', 'missing_license_source_pin', 'missing obvious LICENSE/COPYING/NOTICE file')
    if not plugin_manifests and not mcp_manifests:
        _add_finding(findings, 'medium', 'manifest', 'no plugin or MCP manifest found; treat as untrusted source bundle')

    highest = max((_severity_rank(f['level']) for f in findings), default=0)
    verdict = 'block' if highest >= 3 else ('manual_review' if highest >= 2 else 'low_risk_review')
    result = {
        'ok': verdict == 'low_risk_review',
        'mode': 'report-only',
        'target': str(target),
        'verdict': verdict,
        'risk_level': {0: 'info', 1: 'low', 2: 'medium', 3: 'high'}[highest],
        'inventory': {
            'file_count': len(files),
            'has_plugin_json': bool(plugin_manifests),
            'has_mcp_json': bool(mcp_manifests),
            'plugin_manifests': [_rel(p, target) for p in plugin_manifests[:40]],
            'mcp_manifests': [_rel(p, target) for p in mcp_manifests[:40]],
            'hooks': [_rel(p, target) for p in hook_files[:30]],
            'skills': skill_dirs[:30],
            'agents': agent_dirs[:30],
            'commands': command_dirs[:30],
            'scripts': [_rel(p, target) for p in script_files[:30]],
            'package_manifests': [_rel(p, target) for p in package_files],
            'env_or_secret_filenames': [_rel(p, target) for p in env_files[:30]],
            'license_files': [_rel(p, target) for p in license_files],
            'interesting_top_level_files': [x for x in rel_files if '/' not in x][:40],
        },
        'findings': sorted(findings, key=lambda f: (-_severity_rank(f['level']), f['category'], f.get('evidence', '')))[:120],
        'playbook': str(PLUGIN_INTAKE_PLAYBOOK),
        'policy': 'No install, execute, network, mutation, secret-content reading, or secret printing is performed.',
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


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
    elif cmd in {'skill-profiles', '/skill-profiles'}:
        skill_profiles_report('--json' in argv)
    elif cmd in {'wiki-status', '/wiki-status'}:
        wiki_status('--json' in argv)
    elif cmd in {'improvement-report', '/improvement-report'}:
        improvement_report()
    elif cmd in {'cron-safety', '/cron-safety'}:
        cron_safety_report('--json' in argv)
    elif cmd in {'memory-fencing', '/memory-fencing'}:
        memory_fencing_report('--json' in argv)
    elif cmd in {'tool-loop-guard', '/tool-loop-guard'}:
        tool_loop_guard_report('--json' in argv)
    elif cmd in {'context-budget', '/context-budget'}:
        context_budget_report('--json' in argv)
    elif cmd in {'artifact-verifier', '/artifact-verifier'}:
        artifact_verifier_report(argv, '--json' in argv)
    elif cmd in {'plugin-intake-check', '/plugin-intake-check'}:
        path_args = [x for x in argv[2:] if not x.startswith('--')]
        plugin_intake_check(path_args[0] if path_args else None, '--json' in argv)
    else:
        print('Commands: skills | skill-lifecycle | skill-profiles | wiki-status | improvement-report | cron-safety | memory-fencing | tool-loop-guard | context-budget | artifact-verifier | plugin-intake-check | alert-dashboard | alert-summary | openclaw-health')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
