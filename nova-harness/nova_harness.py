#!/usr/bin/env python3
from __future__ import annotations

import argparse, json, os, shutil, socket, subprocess, sys, tempfile, time, urllib.request
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Callable

WS = Path('/Users/nova/.openclaw/workspace')
OPENCLAW = '/opt/homebrew/bin/openclaw'
VOICE = WS / 'nova-voice'
DASH_URL = 'http://127.0.0.1:18888/api/status'
GUARD_LOG = WS / 'logs/openclaw-guard.log'
PACK_REPO = WS / 'bin/nova-pack-repo'

@dataclass
class Check:
    name: str
    status: str
    detail: str = ''
    duration_ms: int = 0


def run(cmd: list[str], timeout=20, cwd: Path | None = None):
    t = time.time()
    try:
        p = subprocess.run(cmd, cwd=str(cwd or WS), text=True, capture_output=True, timeout=timeout)
        out = ((p.stdout or '') + ('\n' + p.stderr if p.stderr else '')).strip()
        return p.returncode == 0, out, int((time.time()-t)*1000)
    except Exception as e:
        return False, str(e), int((time.time()-t)*1000)


def check_openclaw_health():
    ok, out, ms = run([OPENCLAW, 'gateway', 'health'], 25)
    status = 'pass' if ok and 'OK' in out else 'fail'
    return Check('openclaw.gateway.health', status, out.splitlines()[0:4].__repr__(), ms)


def check_openclaw_status():
    ok, out, ms = run([OPENCLAW, 'status'], 35)
    if not ok: return Check('openclaw.status', 'fail', out[-500:], ms)
    bad = any(x in out.lower() for x in ['unreachable', 'failed'])
    return Check('openclaw.status', 'warn' if bad else 'pass', 'status ok; see openclaw status for full report', ms)


def check_guard():
    ok, out, ms = run(['launchctl', 'print', f'gui/{os.getuid()}/ai.openclaw.guard-agent'], 10)
    if not ok: return Check('guard.launchagent', 'fail', out[-500:], ms)
    loaded = 'type = LaunchAgent' in out and 'Could not find service' not in out
    # StartInterval jobs are often 'not running' between scheduled runs; recent successful log is enough.
    recent_ok = False
    recent = ''
    try:
        lines = GUARD_LOG.read_text(encoding='utf-8').strip().splitlines()
        if lines:
            rec = json.loads(lines[-1]); recent = f"last={rec.get('event')} {rec.get('ts')} ok={rec.get('ok','')}"
            recent_ok = rec.get('event') in {'final_status','health_check'}
    except Exception as e: recent = f'log read issue: {e}'
    return Check('guard.launchagent', 'pass' if loaded and recent_ok else 'warn', recent or 'loaded but no recent log', ms)


def check_dashboard():
    t=time.time()
    try:
        with urllib.request.urlopen(DASH_URL, timeout=20) as r:
            data=json.loads(r.read().decode())
        overall=data.get('overall')
        return Check('dashboard.api', 'pass' if overall=='healthy' else 'warn', f"overall={overall}; services={','.join(s.get('status','?') for s in data.get('services',[]))}", int((time.time()-t)*1000))
    except Exception as e:
        return Check('dashboard.api', 'fail', str(e), int((time.time()-t)*1000))


def check_voice_state():
    ok, out, ms = run([str(VOICE/'nova-voice-mode'), 'status'], 10, VOICE)
    if not ok: return Check('voice.mode', 'fail', out[-500:], ms)
    try:
        s=json.loads(out); detail=f"mode={s.get('mode')} tone={s.get('defaultInstruct')}"
        good=s.get('mode') in {'off','voice','both','auto'} and bool(s.get('defaultInstruct'))
        return Check('voice.mode', 'pass' if good else 'warn', detail, ms)
    except Exception as e: return Check('voice.mode','fail',f'bad json: {e}',ms)


def check_stt():
    samples=sorted((Path('/Users/nova/.openclaw/media/inbound')).glob('*.ogg'), key=lambda p:p.stat().st_mtime, reverse=True)
    if not samples: return Check('voice.stt.local', 'warn', 'no inbound ogg sample found', 0)
    ok, out, ms = run([str(VOICE/'nova-transcribe'), str(samples[0])], 120, VOICE)
    text=' '.join(out.split())
    if not ok: return Check('voice.stt.local', 'fail', out[-500:], ms)
    return Check('voice.stt.local', 'pass' if len(text)>=2 else 'warn', f"sample={samples[0].name}; transcript={text[:120]}", ms)


def check_tts_dry():
    # Dry-run still sends in current OpenClaw media path; avoid external send. Generate local WAV only.
    outp = VOICE/'output/harness-tts-test.wav'
    ok, out, ms = run([str(VOICE/'nova-voice'), '--num-step', '8', '--output', str(outp), 'ทดสอบระบบเสียง Nova harness ค่ะ'], 300, VOICE)
    if not ok: return Check('voice.tts.local', 'fail', out[-700:], ms)
    exists=outp.exists() and outp.stat().st_size > 1000
    return Check('voice.tts.local', 'pass' if exists else 'warn', f"file={outp.name} size={outp.stat().st_size if outp.exists() else 0}", ms)


def check_cron_commute():
    ok,out,ms=run([OPENCLAW,'cron','list'],20)
    if not ok: return Check('cron.jobs','fail',out[-500:],ms)
    found=('commute:true-digital-park:weekday-0800' in out) or ('commute:true-digital-' in out and '7953044c-5329-4733-bb88-c42ef22880a6' in out)
    return Check('cron.jobs','pass' if found else 'warn','commute job found' if found else 'commute job not found',ms)


def check_policy():
    admin_disabled=True
    try:
        html=(WS/'nova-ops-dashboard/public/index.html').read_text(encoding='utf-8')
        admin_disabled='button disabled' in html and 'Restart Gateway' in html
    except Exception: admin_disabled=False
    return Check('policy.admin_actions', 'pass' if admin_disabled else 'warn', 'dashboard admin actions disabled' if admin_disabled else 'admin action state unclear')


def check_pack_repo_safety():
    if not PACK_REPO.exists() or not os.access(PACK_REPO, os.X_OK):
        return Check('repo_pack.safety', 'fail', f'missing or not executable: {PACK_REPO}')
    t=time.time(); tmp=Path(tempfile.mkdtemp(prefix='nova-pack-harness-'))
    out=tmp/'packed.md'
    try:
        repo=tmp/'repo'; (repo/'src').mkdir(parents=True)
        (repo/'src/app.py').write_text("print('hello nova')\n", encoding='utf-8')
        ignored_secret = 'sk-' + 'ignored_' + ('x' * 32)
        inline_secret = 'sk-' + 'harness_' + ('y' * 32)
        env_key = 'OPENAI_' + 'API_' + 'KEY'
        src_key = 'API_' + 'KEY'
        (repo/'.env').write_text(f'{env_key}={ignored_secret}\n', encoding='utf-8')
        (repo/'src/config.py').write_text(f'{src_key} = "{inline_secret}"\n', encoding='utf-8')
        ok, stdout, _ = run([str(PACK_REPO), str(repo), '-o', str(out)], timeout=180)
        unsafe=out.with_suffix(out.suffix + '.unsafe')
        # Expected: wrapper succeeds at packing, then quarantines due to post-output secret scan (exit 3).
        quarantined=(not ok) and unsafe.exists() and not out.exists() and 'Potential sensitive content detected' in stdout
        text=unsafe.read_text(errors='ignore') if unsafe.exists() else ''
        ignored_env='OPENAI_API_KEY' not in text
        status='pass' if quarantined and ignored_env else 'fail'
        detail='quarantined leaky pack; .env ignored' if status=='pass' else f'quarantine={quarantined} ignored_env={ignored_env}; {stdout[-300:]}'
        return Check('repo_pack.safety', status, detail, int((time.time()-t)*1000))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

CHECKS: list[Callable[[],Check]] = [
    check_openclaw_health, check_openclaw_status, check_guard, check_dashboard,
    check_voice_state, check_stt, check_tts_dry, check_cron_commute, check_policy,
    check_pack_repo_safety
]


def main():
    ap=argparse.ArgumentParser(description='Nova Harness health/evaluation checks')
    ap.add_argument('command', choices=['check'])
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--no-tts', action='store_true', help='skip local TTS generation')
    args=ap.parse_args()
    checks=[]
    for fn in CHECKS:
        if args.no_tts and fn is check_tts_dry: continue
        try: checks.append(fn())
        except Exception as e: checks.append(Check(getattr(fn,'__name__','check'), 'fail', str(e)))
    failed=sum(c.status=='fail' for c in checks); warned=sum(c.status=='warn' for c in checks)
    overall='fail' if failed else 'warn' if warned else 'pass'
    result={'overall':overall,'failed':failed,'warned':warned,'checks':[asdict(c) for c in checks]}
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2)); return 0 if overall!='fail' else 2
    icons={'pass':'✅','warn':'⚠️','fail':'❌'}
    print(f"Nova Harness Check: {overall.upper()} ({len(checks)} checks, {failed} failed, {warned} warnings)")
    for c in checks:
        print(f"{icons.get(c.status,'?')} {c.name} [{c.duration_ms}ms] — {c.detail}")
    return 0 if overall!='fail' else 2

if __name__=='__main__':
    raise SystemExit(main())
