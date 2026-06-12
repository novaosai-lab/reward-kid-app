const $ = id => document.getElementById(id);
window.dashboardState = {
  isAgentRunning: false
};
const APP_BASE_PATH = window.location.pathname === '/novaops' || window.location.pathname.startsWith('/novaops/')
  ? '/novaops'
  : '';
const label = s => s === 'healthy' ? 'Healthy' : s === 'critical' ? 'Critical' : s === 'warning' ? 'Warning' : s === 'loading' ? 'Loading' : 'Unknown';
const esc = x => String(x ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const pill = s => `<span class="pill ${s}">${label(s)}</span>`;
const hStatus = s => s === 'pass' ? 'healthy' : s === 'fail' ? 'critical' : s === 'warn' ? 'warning' : s === 'loading' ? 'loading' : 'unknown';
const severityStatus = s => s === 'P0' || s === 'P1' ? 'critical' : s === 'P2' ? 'warning' : 'healthy';
const soundState = {
  ctx: null,
  speaking: false
};

function setHtml(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function apiUrl(url) {
  return APP_BASE_PATH && typeof url === 'string' && url.startsWith('/api/')
    ? `${APP_BASE_PATH}${url}`
    : url;
}

async function getJson(url) {
  const res = await fetch(apiUrl(url));
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function skeleton(rows = 3) {
  return Array.from({ length: rows }, () => '<div class="skeleton"></div>').join('');
}

function ageLabel(ageMs) {
  if (!Number.isFinite(Number(ageMs))) return 'time unknown';
  const mins = Math.round(Number(ageMs) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function freshnessPill(value = {}) {
  const state = value.stale ? 'warning' : 'healthy';
  return `<span class="freshness ${state}">${value.stale ? 'STALE' : 'FRESH'} · ${esc(ageLabel(value.ageMs))}</span>`;
}

function getAudioContext() {
  if (!soundState.ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    soundState.ctx = new AudioContext();
  }
  return soundState.ctx;
}

function playTone(ctx, start, frequency, duration, type, gainValue, destination, detune = 0) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  osc.detune.setValueAtTime(detune, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.04);
}

function playCommandSound(kind = 'tap') {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const t = ctx.currentTime;
  const master = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const delay = ctx.createDelay();
  const feedback = ctx.createGain();
  const wet = ctx.createGain();

  master.gain.value = 0.22;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(kind === 'error' ? 520 : 1500, t);
  filter.Q.value = 7;
  delay.delayTime.value = 0.045;
  feedback.gain.value = 0.18;
  wet.gain.value = 0.12;

  filter.connect(master);
  filter.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(master);
  master.connect(ctx.destination);

  if (kind === 'confirm') {
    playTone(ctx, t, 880, 0.055, 'triangle', 0.18, filter);
    playTone(ctx, t + 0.052, 1320, 0.075, 'sine', 0.15, filter);
    playTone(ctx, t + 0.112, 1760, 0.07, 'sine', 0.09, filter);
  } else if (kind === 'error') {
    playTone(ctx, t, 392, 0.08, 'sawtooth', 0.12, filter);
    playTone(ctx, t + 0.06, 246, 0.12, 'triangle', 0.11, filter);
  } else {
    playTone(ctx, t, 1240, 0.045, 'square', 0.11, filter, -5);
    playTone(ctx, t + 0.028, 1860, 0.06, 'sine', 0.08, filter);
  }
}

function getPreferredVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.find(v => /samantha|victoria|ava|allison|karen|zira/i.test(v.name))
    || voices.find(v => /^en[-_]/i.test(v.lang) && /female|woman/i.test(v.name))
    || voices.find(v => /^en[-_]/i.test(v.lang))
    || voices[0]
    || null;
}

function setIntroButtonState(active) {
  soundState.speaking = active;
  const button = $('sound-toggle');
  if (button) {
    button.classList.toggle('speaking', active);
    button.disabled = active;
    button.title = active ? 'Nova is introducing the command center' : 'Play Nova introduction';
    button.querySelector('span').textContent = active ? 'Speaking' : 'Intro';
  }
  const holo = document.querySelector('.holo-display');
  if (holo) {
    holo.classList.toggle('speaking', active);
  }
}

function playIntroVoice() {
  const synth = window.speechSynthesis;
  if (!synth) {
    playCommandSound('error');
    return;
  }

  synth.cancel();
  setIntroButtonState(true);
  playCommandSound('confirm');

  let line;
  let useThai = false;
  const voices = synth.getVoices();
  const thVoice = voices.find(v => /^th/i.test(v.lang));

  if (thVoice) {
    useThai = true;
    line = [
      'สวัสดีค่ะพี่นิค ระบบปฏิบัติการ โนวา ออปส์ ออนไลน์แล้วค่ะ',
      'ศูนย์สั่งการร่วมกำลังตรวจสอบสถานะเกตเวย์ ข้อมูลระบบ บันทึกความปลอดภัย และเส้นทางแจ้งเตือนทั้งหมดอย่างต่อเนื่อง',
      'ข้อมูลปัจจุบันพร้อมแสดงผลบนหน้าจอแล้วค่ะ'
    ].join(' ');
  } else {
    line = [
      'Good afternoon, Phi Nik.',
      'Nova Ops Dashboard is online.',
      'OpenClaw Multi Agent Command Center is monitoring gateway health, node telemetry, guard recovery, alert routes, and local workflow surfaces.',
      'Current posture is visible on screen. Command interface is standing by.'
    ].join(' ');
  }

  const utterance = new SpeechSynthesisUtterance(line);
  if (useThai) {
    utterance.voice = thVoice;
    utterance.lang = 'th-TH';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
  } else {
    utterance.voice = getPreferredVoice();
    utterance.lang = utterance.voice?.lang || 'en-US';
    utterance.rate = 0.86;
    utterance.pitch = 0.72;
  }
  utterance.volume = 0.95;
  utterance.onend = () => {
    playCommandSound('tap');
    setIntroButtonState(false);
  };
  utterance.onerror = () => {
    playCommandSound('error');
    setIntroButtonState(false);
  };

  synth.speak(utterance);
}

function bars(items) {
  const max = Math.max(...items.map(x => Number(x[1] || 0)), 1);
  return items.map(([name, val]) => `<div class="bar-row"><span>${esc(name)}</span><div class="bar"><i style="width:${Math.max(4, Number(val || 0) / max * 100)}%"></i></div><strong>${esc(val)}</strong></div>`).join('');
}

function renderFastStatus(d) {
  const ageMs = Date.now() - Date.parse(d.generatedAt);
  const stale = Boolean(d.stale) || ageMs > 60000;
  $('updated').textContent = new Date(d.generatedAt).toLocaleString() + (d.cached ? ' · cached' : '');
  setHtml('status-freshness', `${stale ? 'STALE' : 'FRESH'} · ${esc(ageLabel(ageMs))}`);
  $('status-freshness').className = `freshness ${stale ? 'warning' : 'healthy'}`;
  $('overall').textContent = d.overall === 'healthy' ? 'Core systems online' : d.overall === 'critical' ? 'Critical attention required' : 'Watch items detected';
  $('overall-dot').className = `dot ${d.overall}`;
  $('m-sessions').textContent = d.summary.sessions;
  $('m-tasks').textContent = d.summary.tasks;
  $('m-heartbeat').textContent = d.summary.heartbeat;
  $('m-restarts').textContent = d.summary.recentRestarts;
  setHtml('services', d.services.map(s => `<div class="service"><span class="dot ${s.status}"></span><div><strong>${esc(s.name)}</strong><div class="detail">${esc(s.detail)}</div></div>${pill(s.status)}</div>`).join(''));
  setHtml('channels', d.channels.map(c => `${pill(c.status)}<span>${esc(c.name)}</span>`).join(''));
  renderHarness(d.harness);
  setHtml('guard', d.guard.recent.map(g => `<div class="timeline-item"><div><code>${esc(g.event)}</code> <span class="muted">${esc(g.ts)}</span></div><div class="detail">${esc(g.reason || g.policy || g.output || g.gateway_health || g.node_status || '')}</div></div>`).join('') || '<p class="muted">No guard events yet.</p>');
  setHtml('docker', d.docker.length ? `<div class="row head"><span>Name</span><span>Status</span><span>Ports</span></div>` + d.docker.map(r => `<div class="row"><strong>${esc(r.name)}</strong><span>${esc(r.status)}</span><span class="muted">${esc(r.ports)}</span></div>`).join('') : '<p class="muted">No Docker containers visible, or Docker not running.</p>');
  setHtml('roadmap', d.roadmap.map(x => `<li>${esc(x)}</li>`).join(''));
  $('raw').textContent = d.raw.openclawStatus;
}

function renderHarness(h = {}) {
  const hs = h.overall === 'pass' ? 'healthy' : h.overall === 'fail' ? 'critical' : h.overall === 'warn' ? 'warning' : h.overall === 'loading' ? 'loading' : 'unknown';
  const meta = h.deferred ? 'Deferred check · loading after page is interactive' : `${esc(h.checks?.length || 0)} checks · ${esc(h.failed || 0)} failed · ${esc(h.warned || 0)} warnings`;
  setHtml('harness-summary', `<div class="gate ${hs}"><span class="dot ${hs}"></span><strong>${esc((h.overall || 'unknown').toUpperCase())}</strong><span>${meta}</span></div>${h.error ? `<p class="detail">${esc(h.error)}</p>` : ''}`);
  setHtml('harness', (h.checks || []).map(c => `<div class="check"><span class="dot ${hStatus(c.status)}"></span><div><strong>${esc(c.name)}</strong><div class="detail">${esc(c.detail)}</div></div><span class="muted">${esc(c.duration_ms)}ms</span></div>`).join('') || '<p class="muted">Harness runs in background; status will appear here.</p>');
}

function renderGrafana(grafana) {
  setHtml('grafana-mcp', (grafana.items || []).map(item => {
    const statusPill = pill(item.status).replace(label(item.status), esc(item.statusLabel || label(item.status)));
    const facts = [
      ['URL', item.url],
      ['MCP server', item.mcpServer],
      ['Env', item.envFile],
      ['Runner', item.runner],
      ['Token', item.tokenPresent ? 'present (redacted)' : 'missing'],
      ['Env mode', item.envMode || 'missing']
    ].map(([k, v]) => '<div><span>' + esc(k) + '</span><strong>' + esc(v) + '</strong></div>').join('');
    const checks = [
      ['env file', item.envExists],
      ['token', item.tokenPresent],
      ['url match', item.urlMatches],
      ['mode 600', item.modeOk],
      ['runner', item.runnerExists]
    ].map(([name, ok]) => '<span class="' + (ok ? 'ok' : 'bad') + '">' + esc(name) + ': ' + (ok ? 'ok' : 'check') + '</span>').join('');
    const cron = item.cron ? '<div class="grafana-cron"><strong>Owner:</strong> ' + esc(item.cronName || item.usage) + '<br><span>' + esc(item.cron.evidence) + '</span></div>' : '';
    return '<article class="grafana-item"><div class="grafana-head"><div><strong>' + esc(item.project) + '</strong><span>' + esc(item.usage) + '</span></div>' + statusPill + '</div><div class="grafana-facts">' + facts + '</div><div class="grafana-checks">' + checks + '</div>' + cron + '</article>';
  }).join('') || '<p class="muted">No Grafana MCP projects configured.</p>');
}

function renderWeb(web) {
  setHtml('web-inventory', (web.items || []).map(item => {
    const ports = (item.ports || []).map(p => '<span class="' + (p.active ? 'ok' : 'bad') + '">' + esc(p.port) + ' ' + (p.active ? 'on' : 'off') + '</span>').join('');
    const facts = [
      ['Exposure', item.exposure],
      ['Owner', item.owner]
    ].map(([k, v]) => '<div><span>' + esc(k) + '</span><strong>' + esc(v || 'unknown') + '</strong></div>').join('');
    const links = [...(item.publicUrls || []), ...(item.localUrls || [])].map(u => '<a href="' + esc(u) + '" target="_blank" rel="noreferrer"><code>' + esc(u) + '</code></a>').join('');
    const statusPill = pill(item.status).replace(label(item.status), esc(item.statusLabel || label(item.status)));
    return '<article class="web-item"><div class="web-main"><span class="dot ' + esc(item.status) + '"></span><div><div class="web-title"><strong>' + esc(item.name) + '</strong>' + statusPill + '</div><p>' + esc(item.purpose) + '</p></div></div><div class="web-body"><div class="web-facts">' + facts + '</div><div class="web-port-list"><span>Ports</span><div>' + (ports || '<span>none</span>') + '</div></div><div class="web-links">' + (links || '<span class="muted">No URLs configured.</span>') + '</div></div><div class="detail">' + esc(item.note) + '</div></article>';
  }).join('') || '<p class="muted">No web inventory configured.</p>');
}

function renderAlerts(alerts) {
  setHtml('alert-routes', (alerts.items || []).map(item => {
    const statusPill = pill(item.status).replace(label(item.status), esc(item.statusLabel || label(item.status)));
    return '<article class="alert-route"><div class="alert-route-head"><div><strong>' + esc(item.name) + '</strong><span>' + esc(item.destination) + '</span></div>' + statusPill + '</div><div class="alert-route-flow"><span>' + esc(item.source) + '</span><b>→</b><span>' + esc(item.trigger) + '</span></div><div class="web-meta"><span>' + esc(item.evidence) + '</span></div><div class="detail">' + esc(item.note) + '</div></article>';
  }).join('') || '<p class="muted">No alert routes configured.</p>');
}

function fmtMs(ms) {
  const n = Number(ms || 0);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1000) return `${Math.round(n)}ms`;
  return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}s`;
}

function renderTelegramHealth(d = {}) {
  const status = d.status || 'unknown';
  const statusPill = pill(status).replace(label(status), esc(d.statusLabel || label(status)));
  const reasons = (d.reasons || []).length ? d.reasons.map(x => `<li>${esc(x)}</li>`).join('') : '<li>No active warning from latest log window.</li>';
  const metrics = [
    ['Bridge', d.running ? `Running pid ${d.pid}` : 'Stopped'],
    ['Gateway', d.gatewayOk ? 'OK' : 'Check'],
    ['Connect', fmtMs(d.lastConnectMs)],
    ['First token', fmtMs(d.lastFirstTokenMs)],
    ['Delivered', fmtMs(d.lastElapsedMs)],
    ['Last inbound', d.lastInbound ? ageLabel(d.lastInbound.ageMs) : 'none seen']
  ].map(([k, v]) => `<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
  const events = (d.events || []).map(ev => `<div class="telegram-event ${esc(ev.level || 'unknown')}"><span>${ev.ts ? esc(new Date(ev.ts).toLocaleTimeString()) : '—'}</span><code>${esc(ev.text)}</code></div>`).join('');
  setHtml('telegram-health',
    `<div class="telegram-alert-head"><div><span class="dot ${esc(status)}"></span><strong>${esc(d.statusLabel || 'Unknown')}</strong><p>${esc(d.running ? 'Telegram bridge is monitored from local LaunchAgent and bridge logs.' : 'Telegram bridge is not currently running.')}</p></div>${statusPill}</div>` +
    `<div class="telegram-metrics">${metrics}</div>` +
    `<div class="telegram-reasons"><strong>Alert decision</strong><ul>${reasons}</ul></div>` +
    `<div class="telegram-events">${events || '<p class="muted">No recent Telegram bridge events.</p>'}</div>`
  );
  if (status !== 'healthy' && typeof window.appendConsoleLog === 'function') {
    window.appendConsoleLog(`[TELEGRAM] ${d.statusLabel || status}: first token ${fmtMs(d.lastFirstTokenMs)}, delivered ${fmtMs(d.lastElapsedMs)}`);
  }
}

function renderIncidents(data) {
  const source = $('incident-source');
  if (source) source.innerHTML = `${esc(data.classification || data.source || 'Evidence')} · ${freshnessPill(data.freshness)}`;
  const totals = data.totals || {};
  const banner = `<div class="incident-summary"><div><span>Candidates</span><strong>${esc(totals.candidates || 0)}</strong></div><div><span>Samples</span><strong>${esc(totals.samples || 0)}</strong></div><div><span>P0/P1</span><strong>${esc(totals.urgent || 0)}</strong></div></div>`;
  const warning = data.classification === 'Synthetic POC evidence' ? '<p class="evidence-note warning">Test/synthetic evidence only. Do not treat as live production impact.</p>' : '';
  const items = (data.items || []).map(item => `<article class="incident-item"><div class="incident-head">${pill(severityStatus(item.severity)).replace(label(severityStatus(item.severity)), esc(item.severity))}<strong>${esc(item.title)}</strong><span>${esc(item.count)} samples</span></div><div class="incident-meta"><code>${esc(item.service)}</code><code>${esc(item.endpoint)}</code><span>max ${esc(item.maxRptMs)} ms</span></div><p>${esc(item.signature)}</p><div class="detail">Dependency: ${esc(item.dependency || 'unknown')}</div></article>`).join('');
  setHtml('incident-radar', banner + warning + (items || `<p class="muted">${esc(data.error || 'No incident evidence available.')}</p>`));
}

function renderWorkflows(data) {
  const runtime = data.runtime || {};
  const header = `<div class="workflow-summary"><div>${pill(runtime.status || 'unknown')}<strong>n8n runtime ${runtime.active ? 'listening on :5678' : 'not detected'}</strong></div><span>${esc(data.summary?.activeConfigs || 0)} active configs / ${esc(data.summary?.configured || 0)} artifacts</span></div><p class="evidence-note warning">Execution history is not connected yet. Status below confirms local config and runtime presence only.</p>`;
  const items = (data.items || []).map(item => `<article class="workflow-item"><div><span class="dot ${esc(item.status)}"></span><strong>${esc(item.name)}</strong></div><span>${esc(item.statusLabel)}</span><span>${esc(item.nodeCount)} nodes</span><small>${esc(item.evidence)}</small></article>`).join('');
  setHtml('workflow-health', header + (items || '<p class="muted">No workflow artifacts found.</p>'));
}

function renderJobRuns(data) {
  const summary = data.summary || {};
  const banner = '<div class="jobrun-summary">'
    + '<div><span>Jobs</span><strong>' + esc(summary.jobs || 0) + '</strong></div>'
    + '<div><span>Runs</span><strong>' + esc(summary.runs || 0) + '</strong></div>'
    + '<div><span>Healthy</span><strong>' + esc(summary.healthy || 0) + '</strong></div>'
    + '<div><span>Attention</span><strong>' + esc((summary.warning || 0) + (summary.critical || 0)) + '</strong></div>'
    + '</div>'
    + '<p class="evidence-note">Read-only prototype inspired by Harbour: static job definitions are shown separately from execution/run evidence. No scheduler or runner is controlled from this page.</p>';

  const jobs = (data.jobs || []).map(job => {
    const next = job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : 'No next run surfaced';
    const statusPill = pill(job.status).replace(label(job.status), esc(job.statusLabel || label(job.status)));
    return '<article class="jobrun-item jobrun-job">'
      + '<div class="jobrun-head"><div><strong>' + esc(job.name) + '</strong><span>' + esc(job.source) + ' · ' + esc(job.category || 'job') + '</span></div>' + statusPill + '</div>'
      + '<div class="jobrun-meta"><span>Next: ' + esc(next) + '</span><span>' + esc(job.schedule || 'schedule unknown') + '</span></div>'
      + '<div class="detail">' + esc(job.evidence || '') + '</div>'
      + '</article>';
  }).join('');

  const runs = (data.runs || []).map(run => {
    const when = run.completedAt || run.startedAt;
    const time = when ? new Date(when).toLocaleString() : 'time unknown';
    const statusPill = pill(run.status).replace(label(run.status), esc(run.statusLabel || label(run.status)));
    return '<article class="jobrun-item jobrun-run">'
      + '<div class="jobrun-head"><div><strong>' + esc(run.title || run.jobName) + '</strong><span>' + esc(run.jobName || run.jobId) + ' · ' + esc(run.source) + '</span></div>' + statusPill + '</div>'
      + '<div class="jobrun-meta"><span>' + esc(time) + '</span><span>' + esc(run.durationLabel || '') + '</span></div>'
      + '<div class="detail">' + esc(run.evidence || '') + '</div>'
      + '</article>';
  }).join('');

  setHtml('job-runs', banner
    + '<div class="jobrun-columns"><section><h3>Jobs</h3>' + (jobs || '<p class="muted">No jobs surfaced.</p>') + '</section>'
    + '<section><h3>Recent Runs</h3>' + (runs || '<p class="muted">No run records surfaced.</p>') + '</section></div>');
}

function renderOpsLedger(data) {
  const summary = data.summary || {};
  const banner = '<div class="jobrun-summary ops-ledger-summary">'
    + '<div><span>Tracked Jobs</span><strong>' + esc(summary.jobs || 0) + '</strong></div>'
    + '<div><span>Healthy</span><strong>' + esc(summary.healthy || 0) + '</strong></div>'
    + '<div><span>Needs Review</span><strong>' + esc(summary.needsReview || 0) + '</strong></div>'
    + '<div><span>Mode</span><strong>' + esc(data.mode || 'read-only') + '</strong></div>'
    + '</div>';

  const guardrails = (data.guardrails || []).map(item => '<li>' + esc(item) + '</li>').join('');
  const guardrailHtml = '<div class="ops-ledger-guardrails"><strong>Backfill guardrails</strong><ul>' + guardrails + '</ul></div>';

  const jobs = (data.jobs || []).map(job => {
    const statusPill = pill(job.status).replace(label(job.status), esc((job.status || 'unknown').toUpperCase()));
    const last = job.lastEventAt ? new Date(job.lastEventAt).toLocaleString() : 'No local signal';
    const age = ageLabel(job.ageMs);
    const dryRun = job.backfillDryRunCommand || '';
    const append = job.backfillAppendCommand || '';
    return '<article class="ops-ledger-job">'
      + '<div class="jobrun-head"><div><strong>' + esc(job.name) + '</strong><span>' + esc(job.source) + '</span></div>' + statusPill + '</div>'
      + '<div class="ops-ledger-metrics">'
      + '<div><span>Last event</span><strong>' + esc(last) + '</strong></div>'
      + '<div><span>Age</span><strong>' + esc(age) + '</strong></div>'
      + '<div><span>Last count</span><strong>' + esc(job.lastCount ?? 'n/a') + '</strong></div>'
      + '<div><span>Watchdog recoveries</span><strong>' + esc(job.recoveryCount || 0) + '</strong></div>'
      + '</div>'
      + '<div class="detail">' + esc(job.risk || '') + '</div>'
      + '<div class="ops-ledger-cursor"><span>Cursor</span><code>' + esc(job.lastCursor || 'not surfaced') + '</code></div>'
      + '<details class="ops-command-block"><summary>Backfill commands</summary>'
      + '<label>Dry run / review</label><code>' + esc(dryRun) + '</code>'
      + '<label>Append to Google Sheet</label><code>' + esc(append) + '</code>'
      + '</details>'
      + '</article>';
  }).join('');

  const events = (data.events || []).map(event => {
    const when = event.ts ? new Date(event.ts).toLocaleString() : 'time unknown';
    return '<article class="ops-ledger-event">'
      + '<span class="dot ' + esc(event.status || 'unknown') + '"></span>'
      + '<div><strong>' + esc(event.source || 'event') + '</strong><p>' + esc(event.message || '') + '</p><small>' + esc(when) + (event.id ? ' · ' + esc(event.id) : '') + '</small></div>'
      + '</article>';
  }).join('');

  setHtml('ops-ledger', banner + guardrailHtml
    + '<div class="ops-ledger-grid"><section><h3>Backfill Control Center</h3>' + (jobs || '<p class="muted">No tracked jobs surfaced.</p>') + '</section>'
    + '<section><h3>Event Ledger</h3>' + (events || '<p class="muted">No recent operational events surfaced.</p>') + '</section></div>');
}

function renderAlertQuality(data) {
  const summary = data.summary || {};
  const banner = '<div class="jobrun-summary alert-quality-summary">'
    + '<div><span>Raw Alerts</span><strong>' + esc(summary.rawAlerts || 0) + '</strong></div>'
    + '<div><span>Groups</span><strong>' + esc(summary.groups || 0) + '</strong></div>'
    + '<div><span>Escalate</span><strong>' + esc(summary.escalate || 0) + '</strong></div>'
    + '<div><span>Investigate</span><strong>' + esc(summary.investigate || 0) + '</strong></div>'
    + '</div>';

  const suggestions = (data.suggestions || []).map(item => '<li>' + esc(item) + '</li>').join('');
  const guardrails = (data.guardrails || []).map(item => '<li>' + esc(item) + '</li>').join('');
  const suggestionHtml = '<div class="alert-quality-guidance"><div><strong>Suggested rule work</strong><ul>' + suggestions + '</ul></div><div><strong>Guardrails</strong><ul>' + guardrails + '</ul></div></div>';

  const actionLabel = action => String(action || 'watch').toUpperCase();
  const groups = (data.groups || []).slice(0, 12).map(group => {
    const statusPill = pill(group.status || 'unknown').replace(label(group.status || 'unknown'), esc(actionLabel(group.action)));
    const codes = (group.httpCodes || []).join(', ') || 'n/a';
    const tids = (group.tids || []).join(' · ') || 'n/a';
    const last = group.lastSeenAt ? new Date(group.lastSeenAt).toLocaleString() : 'unknown';
    return '<article class="alert-quality-group">'
      + '<div class="jobrun-head"><div><strong>' + esc(group.title || group.signature) + '</strong><span>' + esc(group.endpoint || 'no endpoint') + '</span></div>' + statusPill + '</div>'
      + '<div class="alert-quality-metrics">'
      + '<div><span>Total</span><strong>' + esc(group.count || 0) + '</strong></div>'
      + '<div><span>Last 6h</span><strong>' + esc(group.last6h || 0) + '</strong></div>'
      + '<div><span>HTTP</span><strong>' + esc(codes) + '</strong></div>'
      + '<div><span>Last seen</span><strong>' + esc(last) + '</strong></div>'
      + '</div>'
      + '<div class="detail">' + esc(group.reason || '') + '</div>'
      + '<div class="alert-quality-meta"><span>Category: ' + esc(group.category || 'n/a') + '</span><span>Impact: ' + esc(group.impact || 'n/a') + '</span><span>TIDs: ' + esc(tids) + '</span></div>'
      + '<div class="alert-quality-signature"><span>Signature</span><code>' + esc(group.signature || '') + '</code></div>'
      + '</article>';
  }).join('');

  const endpoints = (data.endpointHotspots || []).map(item => '<article class="alert-quality-mini"><strong>' + esc(item.count) + '</strong><span>' + esc(item.endpoint) + '</span></article>').join('');
  const categories = (data.categories || []).map(item => '<article class="alert-quality-mini"><strong>' + esc(item.count) + '</strong><span>' + esc(item.category) + '</span></article>').join('');
  const coupon = (data.couponSignals || []).map(item => '<article class="alert-quality-group coupon-signal"><div class="jobrun-head"><div><strong>' + esc(item.title) + '</strong><span>' + esc(item.endpoint) + '</span></div>' + pill(item.status).replace(label(item.status), esc(actionLabel(item.action))) + '</div><div class="detail">' + esc(item.reason || '') + '</div><div class="alert-quality-meta"><span>matched: ' + esc(item.count || 0) + '</span><span>sheet rows: ' + esc(item.sheetRows || 0) + '</span></div></article>').join('');

  setHtml('alert-quality', banner + suggestionHtml
    + '<div class="alert-quality-grid"><section><h3>Top Alert Groups</h3>' + (groups || '<p class="muted">No grouped alerts surfaced.</p>') + '</section>'
    + '<section><h3>Hotspots</h3><div class="alert-quality-mini-grid">' + (endpoints || '<p class="muted">No endpoint hotspots.</p>') + '</div><h3>Categories</h3><div class="alert-quality-mini-grid">' + (categories || '<p class="muted">No category counts.</p>') + '</div><h3>Coupon Rollup</h3>' + coupon + '</section></div>');
}

function renderLifeCommand(data) {
  const summary = data.summary || {};
  const brief = data.dailyBrief || {};
  const banner = '<div class="jobrun-summary life-summary">'
    + '<div><span>Open</span><strong>' + esc(summary.open || 0) + '</strong></div>'
    + '<div><span>Tasks</span><strong>' + esc(summary.tasks || 0) + '</strong></div>'
    + '<div><span>Reminders</span><strong>' + esc(summary.reminders || 0) + '</strong></div>'
    + '<div><span>Due Soon</span><strong>' + esc(summary.dueSoon || 0) + '</strong></div>'
    + '</div>';

  const guardrails = (brief.guardrails || []).map(item => '<li>' + esc(item) + '</li>').join('');
  const nextActions = (brief.nextActions || []).map(item => {
    const due = item.dueAt ? new Date(item.dueAt).toLocaleString() : 'No due date';
    return '<article class="life-item next-action">'
      + '<div class="jobrun-head"><div><strong>' + esc(item.title || item.text) + '</strong><span>' + esc(item.type || 'task') + ' · ' + esc(item.channel || 'local') + '</span></div><span class="pill ' + (item.priority === 'P1' ? 'warning' : 'healthy') + '">' + esc(item.priority || 'P2') + '</span></div>'
      + '<div class="detail">' + esc(item.text || '') + '</div>'
      + '<div class="life-meta"><span>' + esc(item.status || 'open') + '</span><span>' + esc(due) + '</span></div>'
      + '</article>';
  }).join('');

  const items = (data.items || []).slice(0, 16).map(item => {
    const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'time unknown';
    return '<article class="life-item">'
      + '<div class="jobrun-head"><div><strong>' + esc(item.title || item.text) + '</strong><span>' + esc(item.type || 'task') + ' · ' + esc(item.channel || 'local') + '</span></div><span class="pill ' + (item.priority === 'P1' ? 'warning' : 'healthy') + '">' + esc(item.priority || 'P2') + '</span></div>'
      + '<div class="detail">' + esc(item.text || '') + '</div>'
      + '<div class="life-meta"><span>' + esc(item.status || 'open') + '</span><span>' + esc(created) + '</span></div>'
      + '</article>';
  }).join('');

  const commands = (data.lineCommands || []).map(command => {
    return '<article class="life-command-card">'
      + '<div><strong>' + esc(command.label) + '</strong><span>' + esc(command.postback || command.example) + '</span><span>' + esc(command.example) + '</span></div>'
      + '<code>' + esc(command.command) + '</code>'
      + '</article>';
  }).join('');

  const byType = Object.entries(data.byType || {}).map(([name, count]) => '<article class="alert-quality-mini"><strong>' + esc(count) + '</strong><span>' + esc(name) + '</span></article>').join('');
  const byChannel = Object.entries(data.byChannel || {}).map(([name, count]) => '<article class="alert-quality-mini"><strong>' + esc(count) + '</strong><span>' + esc(name) + '</span></article>').join('');
  const policy = data.reminderPolicy || {};
  const policyHtml = policy
    ? '<div class="life-policy"><strong>Reminder Policy</strong><span>' + (policy.enabled ? 'ENABLED' : 'DISABLED') + ' · ' + esc(policy.channel || 'line') + ' · ' + esc((policy.schedule || []).join(' / ') || 'no schedule') + '</span><span>Quiet: ' + esc(policy.quietHours?.start || '?') + '-' + esc(policy.quietHours?.end || '?') + ' · Max/day: ' + esc(policy.rateLimit?.maxSendsPerDay || '?') + '</span></div>'
    : '';

  setHtml('life-command', banner
    + '<div class="life-brief"><div><strong>' + esc(brief.headline || 'Daily Life Brief') + '</strong><span>' + esc(data.mode || 'preview') + '</span></div><ul>' + guardrails + '</ul></div>' + policyHtml
    + '<div class="life-grid"><section><h3>Next Actions</h3>' + (nextActions || '<p class="muted">No priority life actions surfaced.</p>') + '<h3>LINE Menu Commands</h3>' + commands + '</section>'
    + '<section><h3>Inbox</h3>' + (items || '<p class="muted">No inbox items yet.</p>') + '<h3>Breakdown</h3><div class="alert-quality-mini-grid">' + byType + byChannel + '</div></section></div>');
}

function compactNumber(n) {
  const val = Number(n || 0);
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return String(Math.round(val));
}

function formatReset(value) {
  if (!value) return 'Reset unknown';
  return 'Resets ' + new Date(value).toLocaleString();
}

function renderQuotaWindow(title, window, fallbackMessage = 'Realtime usage not returned', fallbackLabel = 'Unavailable') {
  if (!window || window.usedPercent == null) {
    return '<div class="quota-window unknown"><div><span>' + esc(title) + '</span><strong>' + esc(fallbackLabel) + '</strong></div><p>' + esc(fallbackMessage) + '</p></div>';
  }
  const used = Math.round(Number(window.usedPercent || 0));
  const remaining = Math.max(0, 100 - used);
  const danger = used >= 90 ? ' danger' : used >= 75 ? ' warn' : '';
  return '<div class="quota-window' + danger + '">'
    + '<div class="quota-window-top"><div><span>' + esc(title) + '</span><strong>' + esc(used) + '% used</strong></div><em>' + esc(remaining) + '% left</em></div>'
    + '<div class="quota-bar" aria-label="' + esc(title) + ' usage"><i style="width:' + esc(used) + '%"></i></div>'
    + '<p>' + esc(formatReset(window.resetsAt)) + '</p>'
    + '</div>';
}

function renderCodexQuota(data) {
  const note = data.note ? '<p class="quota-note">' + esc(data.note) + '</p>' : '';
  const items = (data.items || []).map(item => {
    const statusPill = pill(item.status).replace(label(item.status), esc(item.statusLabel || label(item.status)));
    const latest = item.latestTurnAt ? new Date(item.latestTurnAt).toLocaleString() : 'No local turn found';
    const cost7d = '$' + Number(item.usage7d?.cost || 0).toFixed(3);
    const realtime = item.realtimeLimit || {};
    const realtimeAt = realtime.generatedAt ? new Date(realtime.generatedAt).toLocaleTimeString() : 'Unavailable';
    const realtimeFallback = realtime.error || 'Realtime usage not returned';
    return '<article class="quota-item">'
      + '<div class="quota-head"><div><strong>' + esc(item.email) + '</strong><span>' + esc(item.accountId) + '</span></div>' + statusPill + '</div>'
      + '<div class="quota-limit"><span>Realtime quota usage limit</span><strong>' + esc(item.limitLabel || 'Unavailable') + '</strong><em>Updated ' + esc(realtimeAt) + '</em></div>'
      + '<div class="quota-windows">'
      + renderQuotaWindow('5 hour usage limit', realtime.primary, realtimeFallback, realtime.error ? 'Auth required' : 'Unavailable')
      + renderQuotaWindow('Weekly usage limit', realtime.secondary, realtimeFallback, realtime.error ? 'Auth required' : 'Unavailable')
      + '</div>'
      + '<div class="quota-grid">'
      + '<div><span>24h tokens</span><strong>' + esc(compactNumber(item.usage24h?.totalTokens)) + '</strong></div>'
      + '<div><span>24h turns</span><strong>' + esc(item.usage24h?.turns || 0) + '</strong></div>'
      + '<div><span>7d tokens</span><strong>' + esc(compactNumber(item.usage7d?.totalTokens)) + '</strong></div>'
      + '<div><span>7d est. cost</span><strong>' + esc(cost7d) + '</strong></div>'
      + '</div>'
      + '<div class="quota-meta"><span>7d sessions: ' + esc(item.sessions7d || 0) + '</span><span>Latest: ' + esc(latest) + '</span></div>'
      + '</article>';
  }).join('');
  setHtml('codex-quota', note + (items || '<p class="muted">No Codex accounts configured.</p>'));
}

function renderGroqQuota(data) {
  const note = data.note ? '<p class="quota-note">' + esc(data.note) + '</p>' : '';
  const items = (data.items || []).map(item => {
    const statusPill = pill(item.status).replace(label(item.status), esc(item.statusLabel || label(item.status)));
    const latest = item.latestCallAt ? new Date(item.latestCallAt).toLocaleString() : 'No Groq local call found';
    const realtime = item.realtimeLimit || {};
    const realtimeAt = realtime.generatedAt ? new Date(realtime.generatedAt).toLocaleTimeString() : 'Unavailable';
    const models = item.models || {};
    const modelSummary = models.reachable
      ? esc(models.active || 0) + ' active models' + (models.region ? ' · ' + esc(models.region) : '')
      : 'Model probe unavailable';
    const sample = (models.sample || []).length ? '<div class="quota-meta"><span>Sample models: ' + esc(models.sample.join(' · ')) + '</span></div>' : '';
    return '<article class="quota-item">'
      + '<div class="quota-head"><div><strong>' + esc(item.provider || 'Groq') + '</strong><span>' + esc(item.accountId) + '</span></div>' + statusPill + '</div>'
      + '<div class="quota-limit"><span>Free-tier quota guide</span><strong>' + esc(item.limitLabel || 'Unavailable') + '</strong><em>Updated ' + esc(realtimeAt) + '</em></div>'
      + '<div class="quota-windows">'
      + renderQuotaWindow('Daily request guide', realtime.primary)
      + renderQuotaWindow('Per-minute burst guide', realtime.secondary)
      + '</div>'
      + '<div class="quota-grid">'
      + '<div><span>24h calls</span><strong>' + esc(item.usage24h?.calls || 0) + '</strong></div>'
      + '<div><span>24h complete</span><strong>' + esc(item.usage24h?.completed || 0) + '</strong></div>'
      + '<div><span>7d calls</span><strong>' + esc(item.usage7d?.calls || 0) + '</strong></div>'
      + '<div><span>7d artifacts</span><strong>' + esc(item.reviewArtifacts7d || 0) + '</strong></div>'
      + '</div>'
      + '<div class="quota-meta"><span>API: ' + modelSummary + '</span><span>Key: ' + esc(item.configured ? 'present (redacted)' : 'missing') + '</span><span>Mode: ' + esc(item.keyMode || 'n/a') + '</span><span>Latest: ' + esc(latest) + '</span></div>'
      + sample
      + '</article>';
  }).join('');
  setHtml('groq-quota', note + (items || '<p class="muted">No Groq provider configured.</p>'));
}

function renderGemmaQuota(data) {
  const note = data.note ? '<p class="quota-note">' + esc(data.note) + '</p>' : '';
  const items = (data.items || []).map(item => {
    const statusPill = pill(item.status).replace(label(item.status), esc(item.statusLabel || label(item.status)));
    const latest = item.latestCallAt ? new Date(item.latestCallAt).toLocaleString() : 'No local Gemma call found';
    const realtime = item.realtimeLimit || {};
    const realtimeAt = realtime.generatedAt ? new Date(realtime.generatedAt).toLocaleTimeString() : 'Unavailable';
    const models = item.models || {};
    const modelSummary = models.reachable
      ? esc(models.active || 0) + ' listed models · target ' + esc(models.targetAvailable ? 'available' : 'missing')
      : 'Model probe unavailable';
    const sample = (models.sample || []).length ? '<div class="quota-meta"><span>Available Google models: ' + esc(models.sample.join(' · ')) + '</span></div>' : '';
    return '<article class="quota-item">'
      + '<div class="quota-head"><div><strong>' + esc(item.model || 'google/gemma-4-31b-it') + '</strong><span>' + esc(item.accountId) + '</span></div>' + statusPill + '</div>'
      + '<div class="quota-limit"><span>Fallback quota posture</span><strong>' + esc(item.limitLabel || 'Remaining quota not exposed') + '</strong><em>Updated ' + esc(realtimeAt) + '</em></div>'
      + '<div class="quota-windows">'
      + renderQuotaWindow('Daily request guide', realtime.primary)
      + renderQuotaWindow('Per-minute burst guide', realtime.secondary)
      + '</div>'
      + '<div class="quota-grid">'
      + '<div><span>24h calls</span><strong>' + esc(item.usage24h?.calls || 0) + '</strong></div>'
      + '<div><span>24h complete</span><strong>' + esc(item.usage24h?.completed || 0) + '</strong></div>'
      + '<div><span>7d calls</span><strong>' + esc(item.usage7d?.calls || 0) + '</strong></div>'
      + '<div><span>7d failed</span><strong>' + esc(item.usage7d?.failed || 0) + '</strong></div>'
      + '</div>'
      + '<div class="quota-meta"><span>API: ' + modelSummary + '</span><span>Key: ' + esc(item.configured ? 'present (redacted)' : 'missing') + '</span><span>Alias: ' + esc(item.fallback?.alias || 'gemma-4-31b') + '</span><span>Role: ' + esc(item.fallback?.role || 'Fallback only') + '</span><span>Latest: ' + esc(latest) + '</span></div>'
      + '<div class="quota-meta"><span>Command: ' + esc(item.fallback?.command || '') + '</span></div>'
      + sample
      + '</article>';
  }).join('');
  setHtml('gemma-quota', note + (items || '<p class="muted">No Gemma provider configured.</p>'));
}

function renderMinimaxQuota(data) {
  const note = data.note ? '<p class="quota-note">' + esc(data.note) + '</p>' : '';
  const items = (data.items || []).map(item => {
    const statusPill = pill(item.status).replace(label(item.status), esc(item.statusLabel || label(item.status)));
    const latest = item.latestCallAt ? new Date(item.latestCallAt).toLocaleString() : 'No local MiniMax call found';
    const realtime = item.realtimeLimit || {};
    const realtimeAt = realtime.generatedAt ? new Date(realtime.generatedAt).toLocaleTimeString() : 'Unavailable';
    const expires = item.tokenExpiresAt ? new Date(item.tokenExpiresAt).toLocaleString() : 'Expiry unknown';
    const aliases = (item.aliases || []).join(' · ');
    const models = item.models || {};
    const sample = (models.sample || []).length ? '<div class="quota-meta"><span>Models: ' + esc(models.sample.join(' · ')) + '</span></div>' : '';
    return '<article class="quota-item">'
      + '<div class="quota-head"><div><strong>' + esc(item.provider || 'MiniMax Token Plan') + '</strong><span>' + esc(item.accountId || 'minimax-portal:default') + '</span></div>' + statusPill + '</div>'
      + '<div class="quota-limit"><span>Realtime token-plan quota</span><strong>' + esc(item.limitLabel || 'Unavailable') + '</strong><em>Updated ' + esc(realtimeAt) + '</em></div>'
      + '<div class="quota-windows">'
      + renderQuotaWindow(realtime.primary?.label || '5h Token Plan', realtime.primary, 'MiniMax quota shape not returned', item.configured ? 'Unavailable' : 'OAuth required')
      + renderQuotaWindow(realtime.secondary?.label || 'Weekly Token Plan', realtime.secondary, 'MiniMax weekly quota shape not returned', item.configured ? 'Unavailable' : 'OAuth required')
      + '</div>'
      + '<div class="quota-grid">'
      + '<div><span>Plan</span><strong>' + esc(item.plan || 'Unknown') + '</strong></div>'
      + '<div><span>24h calls</span><strong>' + esc(item.usage24h?.calls || 0) + '</strong></div>'
      + '<div><span>7d calls</span><strong>' + esc(item.usage7d?.calls || 0) + '</strong></div>'
      + '<div><span>7d failed</span><strong>' + esc(item.usage7d?.failed || 0) + '</strong></div>'
      + '</div>'
      + '<div class="quota-meta"><span>OAuth: ' + esc(item.configured ? 'connected' : 'missing') + '</span><span>Expires: ' + esc(expires) + '</span><span>Aliases: ' + esc(aliases || 'n/a') + '</span><span>Latest: ' + esc(latest) + '</span></div>'
      + sample
      + '</article>';
  }).join('');
  setHtml('minimax-quota', note + (items || '<p class="muted">No MiniMax provider configured.</p>'));
}

function renderTokenSessions(data) {
  const note = data.note ? '<p class="quota-note">' + esc(data.note) + '</p>' : '';
  const total = compactNumber(data.totalTokens || 0);
  const header = '<div class="token-session-summary">'
    + '<div><span>Total tokens</span><strong>' + esc(total) + '</strong></div>'
    + '<div><span>Window</span><strong>' + esc((data.hours || 5) + 'h') + '</strong></div>'
    + '<div><span>Warn at</span><strong>' + esc(compactNumber(data.warnTokens || 0)) + '</strong></div>'
    + '</div>';
  const items = (data.items || []).map(item => {
    const cls = item.warning ? ' token-session danger' : ' token-session';
    const pct = Math.max(0, Math.min(100, Number(item.tokenShare || 0)));
    const latest = item.latestTurnAt ? new Date(item.latestTurnAt).toLocaleString() : 'n/a';
    return '<article class="' + cls + '">'
      + '<div class="token-session-head"><div><strong>' + esc(item.sessionKey || item.sessionId) + '</strong><span>' + esc(item.kind || 'session') + ' · ' + esc(item.model || 'unknown') + ' · ' + esc(item.account || 'unknown') + '</span></div>' + pill(item.warning ? 'critical' : 'healthy', item.warning ? 'High' : 'OK') + '</div>'
      + '<div class="token-session-bar"><i style="width:' + esc(pct) + '%"></i></div>'
      + '<div class="quota-grid">'
      + '<div><span>Tokens</span><strong>' + esc(compactNumber(item.totalTokens || 0)) + '</strong></div>'
      + '<div><span>Share</span><strong>' + esc(pct + '%') + '</strong></div>'
      + '<div><span>Turns</span><strong>' + esc(item.turns || 0) + '</strong></div>'
      + '<div><span>Cache read</span><strong>' + esc(compactNumber(item.cacheRead || 0)) + '</strong></div>'
      + '</div>'
      + '<div class="quota-meta"><span>Input: ' + esc(compactNumber(item.input || 0)) + '</span><span>Output: ' + esc(compactNumber(item.output || 0)) + '</span><span>Latest: ' + esc(latest) + '</span></div>'
      + '</article>';
  }).join('');
  setHtml('token-sessions', note + header + (items || '<p class="muted">No session token usage in the selected window.</p>'));
}

function renderContextBudget(data) {
  const status = data.status || 'unknown';
  const statusPill = pill(status).replace(label(status), esc(data.statusLabel || label(status)));
  const pct = Math.max(0, Math.min(100, Number(data.budgetPercent || 0)));
  const files = (data.files || []).map(item => {
    return '<article class="token-session">'
      + '<div class="token-session-head"><div><strong>' + esc(item.label) + '</strong><span>' + esc(item.file) + '</span></div><span class="pill ' + (item.exists ? 'healthy' : 'warning') + '">' + esc(item.exists ? 'Present' : 'Missing') + '</span></div>'
      + '<div class="quota-grid">'
      + '<div><span>Chars</span><strong>' + esc(compactNumber(item.chars || 0)) + '</strong></div>'
      + '<div><span>Approx tokens</span><strong>' + esc(compactNumber(item.approxTokens || 0)) + '</strong></div>'
      + '</div>'
      + '</article>';
  }).join('');
  const risks = (data.risks || []).map(x => '<li>' + esc(x) + '</li>').join('') || '<li>No active context-budget risk from local files.</li>';
  const commands = (data.commands || []).map(x => '<code>' + esc(x) + '</code>').join('');
  const bootstrap = data.bootstrap || {};
  const skills = data.skills || {};
  const startup = data.startupContext || {};
  const limits = data.contextLimits || {};
  const html = '<div class="token-session-summary">'
    + '<div><span>First-turn estimate</span><strong>' + esc(compactNumber(data.approxFirstTurnTokens || 0)) + '</strong></div>'
    + '<div><span>Budget</span><strong>' + esc(compactNumber(data.firstTurnBudgetTokens || 0)) + '</strong></div>'
    + '<div><span>Hot memory saved</span><strong>' + esc(compactNumber(data.savedByHotMemoryTokens || 0)) + '</strong></div>'
    + '</div>'
    + '<div class="quota-limit"><span>Context posture</span><strong>' + esc(data.statusLabel || 'Unknown') + '</strong><em>' + esc(data.source || '') + '</em></div>'
    + '<div class="token-session-bar"><i style="width:' + esc(pct) + '%"></i></div>'
    + '<div class="quota-meta"><span>Bootstrap max: ' + esc(compactNumber(bootstrap.approxBootstrapMaxTokens || 0)) + ' tokens/file</span><span>Total cap: ' + esc(compactNumber(bootstrap.approxBootstrapTotalMaxTokens || 0)) + ' tokens</span><span>Estimated injected: ' + esc(compactNumber(bootstrap.approxEstimatedInjectedTokens || 0)) + ' tokens · ' + esc(bootstrap.capPercent || 0) + '% cap</span><span>Injection: ' + esc(bootstrap.contextInjection || 'unknown') + '</span><span>Startup prelude: ' + esc(compactNumber(startup.maxTotalChars || 0)) + ' chars</span><span>Tool result cap: ' + esc(compactNumber(limits.toolResultMaxChars || 0)) + ' chars</span><span>Skills: ' + esc(skills.enabled || 0) + '/' + esc(skills.configured || 0) + ' · cap ' + esc(compactNumber(skills.maxSkillsPromptChars || 0)) + ' chars</span></div>'
    + '<div class="telegram-reasons"><strong>Budget decision</strong><ul>' + risks + '</ul></div>'
    + '<div class="command-tags">' + commands + '</div>'
    + '<div class="token-sessions">' + (files || '<p class="muted">No context files surfaced.</p>') + '</div>';
  setHtml('context-budget', '<div class="telegram-alert-head"><div><span class="dot ' + esc(status) + '"></span><strong>' + esc(data.statusLabel || 'Unknown') + '</strong><p>First-call context is controlled by hot memory, bootstrap caps, deferred skills, and local slimming tools.</p></div>' + statusPill + '</div>' + html);
}

function updateProcessingVisuals() {
  const isRunning = (window.dashboardState?.tasksRunning ?? false) || (window.dashboardState?.sessionsActive ?? false);
  const active = isRunning || isSimulating;

  if (window.dashboardState) {
    window.dashboardState.isAgentRunning = active;
  }

  const holoDisplay = document.querySelector('.holo-display');
  if (holoDisplay) {
    holoDisplay.classList.toggle('processing', active);
    const statusValEl = document.querySelector('.hud-right .hud-data-row:nth-child(1) .hud-val');
    if (statusValEl) {
      if (active) {
        statusValEl.textContent = 'COGNITION';
        statusValEl.className = 'hud-val text-cyan';
      } else {
        statusValEl.textContent = 'ONLINE';
        statusValEl.className = 'hud-val text-green';
      }
    }
    const mainNodeTagStrong = document.querySelector('.main-node-wrapper .node-hud-tag strong');
    if (mainNodeTagStrong) {
      mainNodeTagStrong.textContent = active ? 'RUNNING' : 'SYS_OK';
    }
  }
}

function renderAgents(data) {
  setHtml('configured-agents', (data || []).map(agent => {
    const isDefaultBadge = agent.isDefault ? '<span class="pill healthy">Default</span>' : '';
    const bindingsText = agent.bindings || '0 rules';
    
    return `<article class="agent-config-card">
      <div class="agent-card-header">
        <div class="agent-card-title">
          <strong>${esc(agent.identityEmoji || '🤖')} ${esc(agent.identityName || agent.id)}</strong>
          <span>ID: ${esc(agent.id)}</span>
        </div>
        ${isDefaultBadge}
      </div>
      <div class="agent-card-grid">
        <div><span>Workspace</span><strong title="${esc(agent.workspace)}">${esc(agent.workspace.split('/').pop())}</strong></div>
        <div><span>Directory</span><strong title="${esc(agent.agentDir)}">${esc(agent.agentDir.split('/').pop())}</strong></div>
        <div><span>Default Model</span><strong title="${esc(agent.model)}">${esc(agent.model)}</strong></div>
        <div><span>Bindings</span><strong>${esc(bindingsText)}</strong></div>
      </div>
    </article>`;
  }).join('') || '<p class="muted">No agents configured.</p>');
}

function renderActiveWork(data = {}) {
  const sections = data.sections || [];
  const wanted = new Set(['Current Focus', 'Stable / Monitoring', 'Paused / Not Now']);
  const visibleSections = sections.filter(section => wanted.has(section.title));
  const html = visibleSections.map(section => {
    const tone = section.title.includes('Paused') ? 'paused' : section.title.includes('Monitoring') ? 'monitoring' : 'focus';
    const items = (section.items || []).map(item => {
      const dossier = item.match(/Dossier:\s+`?([^`]+)`?/i);
      const next = item.toLowerCase().includes('next best step');
      const status = item.toLowerCase().includes('status:');
      const klass = next ? 'next' : status ? 'status' : '';
      const text = esc(item).replace(/`([^`]+)`/g, '<code>$1</code>');
      return `<li class="${klass}">${text}${dossier ? ` <span class="active-work-dossier">${esc(dossier[1])}</span>` : ''}</li>`;
    }).join('');
    return `<article class="active-work-section ${tone}">
      <div class="active-work-section-head">
        <strong>${esc(section.title)}</strong>
        <span>${esc((section.items || []).length)} signals</span>
      </div>
      <ul>${items}</ul>
    </article>`;
  }).join('');
  const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'unknown';
  setHtml('active-work', `<div class="active-work-meta"><span>Source: <code>ACTIVE_WORK.md</code></span><span>Updated: ${esc(updated)}</span></div>${html || '<p class="muted">No active work index found.</p>'}`);
}

function renderSkillRegistry(data = {}) {
  const registry = data.registry || {};
  const evalFlywheel = data.evalFlywheel || {};
  const latestEval = data.latestEvalResult || {};
  const summary = registry.summary || {};
  const evalSummary = latestEval.summary || {};
  const categories = registry.categories || {};
  const lanes = evalFlywheel.lanes || [];
  const risk = summary.risk || {};
  const categoryCards = Object.entries(categories).slice(0, 8).map(([category, skills]) => `
    <article class="skill-registry-category">
      <strong>${esc(category)}</strong>
      <span>${esc((skills || []).length)} skills</span>
    </article>
  `).join('');
  const laneHtml = lanes.map(lane => `
    <article class="skill-eval-lane">
      <strong>${esc(lane.id)}</strong>
      <p>${esc(lane.goal)}</p>
      <span>${esc((lane.metrics || []).join(' · '))}</span>
    </article>
  `).join('');
  const updated = registry.generatedAt ? new Date(registry.generatedAt).toLocaleString() : 'unknown';
  setHtml('skill-registry', `
    <div class="skill-registry-meta">
      <div><span>Total skills</span><strong>${esc(summary.skillCount || 0)}</strong></div>
      <div><span>Categories</span><strong>${esc(summary.categoryCount || 0)}</strong></div>
      <div><span>High risk</span><strong>${esc(risk.high || 0)}</strong></div>
      <div><span>Eval lanes</span><strong>${esc(lanes.length)}</strong></div>
    </div>
    <div class="skill-eval-result">
      <div>
        <span>Latest skill-routing eval</span>
        <strong>${esc(evalSummary.total || 0)} cases · ${esc(Math.round((evalSummary.categoryAccuracy || 0) * 100))}% category · ${esc(Math.round((evalSummary.riskAccuracy || 0) * 100))}% risk</strong>
      </div>
      <span>${esc(latestEval.generatedAt ? new Date(latestEval.generatedAt).toLocaleString() : 'no run yet')}</span>
    </div>
    <div class="active-work-meta"><span>Source: <code>nova-skill-os/out</code></span><span>Updated: ${esc(updated)}</span></div>
    <div class="skill-registry-grid">${categoryCards || '<p class="muted">No categories generated.</p>'}</div>
    <div class="skill-eval-grid">${laneHtml || '<p class="muted">No eval lanes generated.</p>'}</div>
  `);
}

function renderTeamControl(data) {
  const summary = data.summary || {};
  const healthClass = data.health === 'critical' ? 'critical' : data.health === 'warning' ? 'warning' : 'healthy';
  const runningTasks = data.live?.runningTasks || [];
  const failedTasks = data.live?.failedTasks || [];
  const sessions = data.live?.sessions || [];
  const reports = data.reports || [];
  const roles = data.roles || [];
  const roster = data.roster || [];
  const activeSubTab = window.dashboardState.activeSubTab || 'orchestrator';

  const metricHtml = [
    ['Roles', summary.roles || 0],
    ['Agents', summary.registeredAgents || 0],
    ['Sessions', summary.activeSessions || 0],
    ['Running', summary.runningTasks || 0],
    ['Reports', summary.recentReports || 0],
    ['Passed', summary.passedReports || 0],
  ].map(([labelText, value]) => `<div><span>${esc(labelText)}</span><strong>${esc(value)}</strong></div>`).join('');

  const rolesHtml = roles.map(role => `
    <article class="team-role cockpit-agent-card" data-role-id="${esc(role.id || '')}">
      <div class="team-role-head">
        <div><strong>${esc(role.name)}</strong><span>${esc(role.owner)}</span></div>
        <span class="pill ${esc(role.status || 'unknown')}">${esc((role.status || 'unknown').toUpperCase())}</span>
      </div>
      <p>${esc(role.purpose)}</p>
      <div class="cockpit-card-metrics">
        <span>Evidence</span>
        <strong>${esc(role.evidence)}</strong>
      </div>
    </article>
  `).join('');

  const visibleReports = reports.slice(0, 2);
  const extraReports = reports.slice(2, 5);
  const reportsHtml = visibleReports.map(report => {
    const reportPath = report.path || '';
    const reportFile = reportPath.split('/').pop() || reportPath || 'verification report';
    const generatedAt = report.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'unknown time';
    return `
      <article class="verification-card">
        <div class="verification-card-head">
          <div class="verification-card-title">
            <strong>${esc(report.taskId || reportFile)}</strong>
            <span>${esc(report.summary || reportFile)}</span>
          </div>
          <span class="pill ${report.passed ? 'healthy' : 'critical'}">${report.passed ? 'PASSED' : 'NEEDS WORK'}</span>
        </div>
        <div class="verification-card-meta">
          <span>${esc(generatedAt)}</span>
          <span>Findings: ${esc(report.findings || 0)}</span>
        </div>
        <div class="verification-path" title="${esc(reportPath)}">${esc(reportFile)}</div>
      </article>
    `;
  }).join('');
  const reportsToggleHtml = extraReports.length > 0 ? `
    <button type="button" class="cockpit-toggle-btn" id="reports-toggle-btn" data-scope="reports">
      Show ${extraReports.length} more report${extraReports.length > 1 ? 's' : ''} (${extraReports.length + visibleReports.length} total)
    </button>
    <div id="reports-extra" class="reports-extra" style="display:none">
      ${extraReports.map(report => {
        const reportPath = report.path || '';
        const reportFile = reportPath.split('/').pop() || reportPath || 'verification report';
        const generatedAt = report.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'unknown time';
        return `
          <article class="verification-card">
            <div class="verification-card-head">
              <div class="verification-card-title">
                <strong>${esc(report.taskId || reportFile)}</strong>
                <span>${esc(report.summary || reportFile)}</span>
              </div>
              <span class="pill ${report.passed ? 'healthy' : 'critical'}">${report.passed ? 'PASSED' : 'NEEDS WORK'}</span>
            </div>
            <div class="verification-card-meta">
              <span>${esc(generatedAt)}</span>
              <span>Findings: ${esc(report.findings || 0)}</span>
            </div>
            <div class="verification-path" title="${esc(reportPath)}">${esc(reportFile)}</div>
          </article>
        `;
      }).join('')}
    </div>` : '';

  const runningHtml = runningTasks.map(task => `
    <article class="jobrun-item">
      <div class="jobrun-head">
        <div><strong>${esc(task.label || task.task)}</strong><span>${esc(task.taskId)} · ${esc(task.runtime)}</span></div>
        <span class="pill warning">${esc(task.status || 'running')}</span>
      </div>
      <div class="jobrun-meta"><span>${esc(task.progressSummary || 'in progress')}</span></div>
    </article>
  `).join('');

  const activityHtml = [
    ...runningTasks.map(task => ({ tone: 'warning', text: `RUNNING ${task.taskId || task.task || 'task'} ${task.progressSummary || ''}` })),
    ...failedTasks.map(task => ({ tone: 'critical', text: `ATTENTION ${task.taskId || task.task || 'task'} ${task.status || 'failed'}` })),
    ...reports.slice(0, 6).map(report => ({ tone: report.passed ? 'healthy' : 'critical', text: `${report.passed ? 'VERIFY PASS' : 'VERIFY REVIEW'} ${report.taskId || report.path}` })),
    ...roles.slice(0, 4).map(role => ({ tone: role.status || 'healthy', text: `ROLE ${role.name}: ${role.status || 'ready'}` })),
  ].slice(0, 12).map((item, index) => `
    <div class="cockpit-feed-line ${esc(item.tone)}">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <code>${esc(item.text)}</code>
    </div>
  `).join('');

  const uptimeBars = roles.map((role, index) => {
    const status = role.status || 'healthy';
    const pct = status === 'critical' ? 42 : status === 'warning' ? 68 : Math.max(72, 96 - (index * 3));
    return `<div class="cockpit-bar-row"><span>${esc(role.name)}</span><i><b class="${esc(status)}" style="width:${pct}%"></b></i><strong>${pct}%</strong></div>`;
  }).join('');

  const performancePoints = roles.map((role, index) => {
    const x = roles.length <= 1 ? 50 : (index / (roles.length - 1)) * 100;
    const status = role.status || 'healthy';
    const y = status === 'critical' ? 78 : status === 'warning' ? 54 : 28 + ((index % 3) * 8);
    return `${x},${y}`;
  }).join(' ');

  const networkLegend = [
    ['healthy', 'Healthy'],
    ['active', 'Active'],
    ['warning', 'Warning'],
    ['critical', 'Critical'],
  ].map(([tone, text]) => `<span class="cockpit-legend ${tone}">${text}</span>`).join('');

  const routingHtml = (data.routerRules || []).map(rule => `<li>${esc(rule)}</li>`).join('');
  const nextHtml = (data.nextActions || []).map(action => `<li>${esc(action)}</li>`).join('');
  const playbooks = data.playbooks || {};
  const playbookHtml = [
    ['Handoff', playbooks.handoffTemplate],
    ['QA Feedback', playbooks.qaFeedbackTemplate],
    ['Escalation', playbooks.escalationTemplate],
    ['Incident Runbook', playbooks.incidentRunbook],
    ['Adaptation Plan', playbooks.adaptationPlan],
  ].map(([name, ok]) => `<span class="pill ${ok ? 'healthy' : 'warning'}">${esc(name)}</span>`).join('');

  const rosterHtml = roster.map(agent => `
    <article class="agent-config-card" style="border: 1px solid rgba(0, 240, 255, 0.1); background: rgba(15, 23, 42, 0.5); padding: 10px; border-radius: 6px;">
      <div class="agent-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div class="agent-card-title">
          <strong style="color: var(--text-primary); font-size: 13px;">${esc(agent.emoji || '🤖')} ${esc(agent.name)}</strong>
          <span style="font-size: 10px; color: var(--text-muted); margin-left: 6px;">ID: ${esc(agent.id)}</span>
        </div>
        ${agent.isDefault ? '<span class="pill healthy">Default</span>' : ''}
      </div>
      <div class="agent-card-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div><span style="font-size: 10px; color: var(--text-muted); display: block; text-transform: uppercase;">Role</span><strong style="font-size: 11px; color: var(--cyan);">${esc(agent.role)}</strong></div>
        <div><span style="font-size: 10px; color: var(--text-muted); display: block; text-transform: uppercase;">Model</span><strong style="font-size: 11px; color: var(--text-primary);">${esc(agent.model)}</strong></div>
      </div>
    </article>
  `).join('') || '<p class="muted">No agents configured in roster.</p>';

  const runtime = data.runtime || {};
  const runtimeSummary = runtime.summary || {};
  const queue = runtime.queue || [];
  const handoffs = runtime.handoffs || [];
  const lifecycleSteps = [
    ['queued', 'Queue'],
    ['assigned', 'Assign'],
    ['handoff', 'Handoff'],
    ['running', 'Execute'],
    ['verification', 'Verify'],
    ['qualityReview', 'Quality'],
    ['done', 'Done'],
  ];
  const pipelineHtml = lifecycleSteps.map(([key, name], index) => {
    const countValue = runtimeSummary[key] || 0;
    const isActive = countValue > 0 || (key === 'done' && runtimeSummary.done > 0);
    return `
      <article class="agent-pipeline-step ${isActive ? 'active' : ''}">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <strong>${esc(name)}</strong>
        <em>${esc(countValue)}</em>
      </article>
    `;
  }).join('');
  const dagSteps = lifecycleSteps.map(([key, name], index) => ({
    id: key,
    name,
    count: runtimeSummary[key] || 0,
    status: (runtimeSummary[key] || 0) > 0 ? 'active' : key === 'done' && runtimeSummary.done > 0 ? 'done' : 'idle',
    x: 8 + (index * 14.2),
    y: index % 2 ? 60 : 24,
  }));
  const dagNodesHtml = dagSteps.map(step => `
    <article class="dag-node ${esc(step.status)}" style="--dag-x:${esc(step.x)}%; --dag-y:${esc(step.y)}%;">
      <strong>${esc(step.name)}</strong>
      <span>${esc(step.count)}</span>
    </article>
  `).join('');
  const dagEdgesHtml = dagSteps.slice(0, -1).map((step, index) => {
    const next = dagSteps[index + 1];
    const left = Math.min(step.x, next.x) + 4;
    const top = ((step.y + next.y) / 2) + 7;
    return `<span class="dag-edge ${step.status !== 'idle' || next.status !== 'idle' ? 'active' : ''}" style="--edge-left:${esc(left)}%; --edge-top:${esc(top)}%;"></span>`;
  }).join('');
  const vibeDraftNodes = [
    { type: 'Intent', label: 'Goal Brief', detail: 'Natural-language objective', tone: 'source', x: 8, y: 24 },
    { type: 'ContextBlock', label: 'Memory / RAG / MCP', detail: 'Local context bundle', tone: 'context', x: 23, y: 60 },
    { type: 'Switch', label: 'Route', detail: 'Pick agent/tool lane', tone: 'decision', x: 38, y: 24 },
    { type: 'Agent', label: 'Worker Graph', detail: 'Role + instructions + tools', tone: 'agent', x: 53, y: 60 },
    { type: 'Loop', label: 'Revise', detail: 'Retry until gate passes', tone: 'loop', x: 68, y: 24 },
    { type: 'Human', label: 'Approval', detail: 'Telegram checkpoint', tone: 'human', x: 83, y: 60 },
    { type: 'Trace', label: 'Report', detail: 'Evidence + shared state', tone: 'trace', x: 92, y: 24 },
  ];
  const vibeDraftEdgesHtml = vibeDraftNodes.slice(0, -1).map((node, index) => {
    const next = vibeDraftNodes[index + 1];
    const left = Math.min(node.x, next.x) + 4;
    const top = ((node.y + next.y) / 2) + 7;
    return `<span class="vibe-edge" style="--edge-left:${esc(left)}%; --edge-top:${esc(top)}%;"></span>`;
  }).join('');
  const vibeDraftNodesHtml = vibeDraftNodes.map(node => `
    <article class="vibe-node ${esc(node.tone)}" style="--vibe-x:${esc(node.x)}%; --vibe-y:${esc(node.y)}%;">
      <span>${esc(node.type)}</span>
      <strong>${esc(node.label)}</strong>
      <em>${esc(node.detail)}</em>
    </article>
  `).join('');
  const vibeTemplateHtml = [
    ['Research', 'Intent -> ContextBlock -> Agent -> Human -> Report'],
    ['Build', 'Intent -> Switch -> Tool -> Loop -> Quality Gate'],
    ['Support RCA', 'Incident -> ContextBlock -> Agent -> Human -> Timeline'],
  ].map(([name, path]) => `<span><strong>${esc(name)}</strong>${esc(path)}</span>`).join('');

  const activeGoals = queue
    .filter(task => task.status !== 'done')
    .slice(0, 4);
  const recentGoals = activeGoals.length ? activeGoals : queue.slice(0, 4);
  const visibleGoals = recentGoals.slice(0, 2);
  const extraGoals = recentGoals.slice(2);
  const goalHtml = visibleGoals.map(task => `
    <article class="goal-card">
      <div class="goal-card-head">
        <div>
          <strong>${esc(task.title || task.taskId)}</strong>
          <span>${esc(task.taskId)} · ${esc(task.assignedRole || 'unassigned')}</span>
        </div>
        <span class="pill ${task.status === 'done' ? 'healthy' : task.status === 'blocked' ? 'critical' : 'warning'}">${esc(task.status || 'unknown')}</span>
      </div>
      <p>${esc(task.objective || 'No objective captured.')}</p>
      <div class="goal-card-meta">
        <span>Risk: ${esc(task.risk || 'local')}</span>
        <span>Evidence: ${esc((task.evidence || []).length)}</span>
        <span>QA: ${esc(task.qualityReviewDecision || 'pending')}</span>
      </div>
    </article>
  `).join('');
  const goalToggleHtml = extraGoals.length > 0 ? `
    <button type="button" class="cockpit-toggle-btn" id="goal-toggle-btn">
      Show ${extraGoals.length} more goal${extraGoals.length > 1 ? 's' : ''} (${extraGoals.length + visibleGoals.length} total)
    </button>
    <div id="goal-extra" style="display:none">
      ${extraGoals.map(task => `
        <article class="goal-card">
          <div class="goal-card-head">
            <div>
              <strong>${esc(task.title || task.taskId)}</strong>
              <span>${esc(task.taskId)} · ${esc(task.assignedRole || 'unassigned')}</span>
            </div>
            <span class="pill ${task.status === 'done' ? 'healthy' : task.status === 'blocked' ? 'critical' : 'warning'}">${esc(task.status || 'unknown')}</span>
          </div>
          <p>${esc(task.objective || 'No objective captured.')}</p>
          <div class="goal-card-meta">
            <span>Risk: ${esc(task.risk || 'local')}</span>
            <span>Evidence: ${esc((task.evidence || []).length)}</span>
            <span>QA: ${esc(task.qualityReviewDecision || 'pending')}</span>
          </div>
        </article>
      `).join('')}
    </div>` : '';

  const lastTokenRun = runtimeSummary.lastTokenAttributionRun || {};
  const tokenSummary = lastTokenRun.summary || {};
  const lastTrustRun = runtimeSummary.lastTrustScoreRun || {};
  const trustSummary = lastTrustRun.summary || {};
  const lastUiAuditRun = runtimeSummary.lastUiDesignAuditRun || {};
  const uiAuditSummary = lastUiAuditRun.summary || {};
  const tokenTotal = tokenSummary.totalTokens || 0;
  const tokenPct = Math.max(4, Math.min(100, tokenTotal ? Math.round(tokenTotal / 10000) : 8));
  const qualityEvents = [
    runtimeSummary.lastWorkerExecution && {
      title: 'Worker Execution',
      value: runtimeSummary.lastWorkerExecution.passed ? 'Passed' : 'Review',
      meta: runtimeSummary.lastWorkerExecution.report,
      tone: runtimeSummary.lastWorkerExecution.passed ? 'healthy' : 'warning',
    },
    runtimeSummary.lastQaCloseout && {
      title: 'QA Closeout',
      value: runtimeSummary.lastQaCloseout.passed ? 'Passed' : 'Review',
      meta: runtimeSummary.lastQaCloseout.report,
      tone: runtimeSummary.lastQaCloseout.passed ? 'healthy' : 'warning',
    },
    runtimeSummary.lastReview && {
      title: 'Peer Review',
      value: runtimeSummary.lastReview.decision || 'Captured',
      meta: runtimeSummary.lastReview.report,
      tone: runtimeSummary.lastReview.passed ? 'healthy' : 'warning',
    },
    runtimeSummary.lastQualityReview && {
      title: 'Quality Gate',
      value: runtimeSummary.lastQualityReview.decision || 'Captured',
      meta: runtimeSummary.lastQualityReview.report,
      tone: runtimeSummary.lastQualityReview.passed ? 'healthy' : 'warning',
    },
    runtimeSummary.lastDoctorRun && {
      title: 'Doctor',
      value: `${runtimeSummary.lastDoctorRun.readiness || 'unknown'} ${runtimeSummary.lastDoctorRun.score ?? ''}`,
      meta: runtimeSummary.lastDoctorRun.report,
      tone: runtimeSummary.lastDoctorRun.readiness === 'ready' ? 'healthy' : 'warning',
    },
  ].filter(Boolean);
  const qualityTimelineHtml = qualityEvents.map((event, index) => `
    <article class="quality-timeline-item ${esc(event.tone)}">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <div>
        <strong>${esc(event.title)} · ${esc(event.value)}</strong>
        <code title="${esc(event.meta || '')}">${esc((event.meta || '').split('/').pop() || 'report pending')}</code>
      </div>
    </article>
  `).join('');

  const visibleHandoffs = handoffs.slice(0, 2);
  const extraHandoffs = handoffs.slice(2);
  const handoffHtml = visibleHandoffs.map(item => `
    <article class="handoff-card">
      <strong>${esc(item.fromRole || 'orchestrator')} -> ${esc(item.toRole || 'worker')}</strong>
      <span>${esc(item.taskId || item.id)} · ${esc(item.risk || 'local')}</span>
      <p>${esc(item.objective || item.nextAction || 'No handoff detail captured.')}</p>
    </article>
  `).join('');
  const handoffToggleHtml = extraHandoffs.length > 0 ? `
    <button type="button" class="cockpit-toggle-btn" id="handoff-toggle-btn">
      Show ${extraHandoffs.length} more handoff${extraHandoffs.length > 1 ? 's' : ''} (${extraHandoffs.length + visibleHandoffs.length} total)
    </button>
    <div id="handoff-extra" style="display:none">
      ${extraHandoffs.map(item => `
        <article class="handoff-card">
          <strong>${esc(item.fromRole || 'orchestrator')} -> ${esc(item.toRole || 'worker')}</strong>
          <span>${esc(item.taskId || item.id)} · ${esc(item.risk || 'local')}</span>
          <p>${esc(item.objective || item.nextAction || 'No handoff detail captured.')}</p>
        </article>
      `).join('')}
    </div>` : '';

  setHtml('team-control-room', `
    <div class="commander-cockpit" data-health="${esc(healthClass)}">
      <div class="cockpit-command-bar">
        <div class="cockpit-brand">
          <span class="claw-mark" aria-hidden="true">OC</span>
          <div>
            <strong>OpenClaw Agent Control</strong>
            <small>${esc(data.mode || 'read-only control room')}</small>
          </div>
        </div>
        <div class="cockpit-health-strip">
          <span class="cockpit-chip ${healthClass}">Overall ${esc(label(healthClass))}</span>
          <span class="cockpit-chip healthy">Gateway</span>
          <span class="cockpit-chip healthy">Node</span>
          <span class="cockpit-chip ${runningTasks.length ? 'active' : 'healthy'}">Tasks ${esc(runningTasks.length)}</span>
          <span class="cockpit-chip ${summary.failedReports ? 'warning' : 'healthy'}">Verify ${esc(summary.passedReports || 0)}/${esc(summary.recentReports || 0)}</span>
        </div>
        <div class="cockpit-actions">
          <button type="button" id="cockpit-btn-deploy" class="cockpit-action primary">Deploy Agent</button>
          <button type="button" id="cockpit-btn-verify" class="cockpit-action">Run Verification</button>
          <button type="button" id="cockpit-btn-logs" class="cockpit-action danger">Logs</button>
        </div>
      </div>

      <nav class="cockpit-subtabs" role="tablist">
        <button type="button" class="subtab-btn ${activeSubTab === 'orchestrator' ? 'active' : ''}" data-subtab="orchestrator" role="tab" aria-selected="${activeSubTab === 'orchestrator'}">
          <span class="subtab-icon">⌬</span> Orchestrator
        </button>
        <button type="button" class="subtab-btn ${activeSubTab === 'workbench' ? 'active' : ''}" data-subtab="workbench" role="tab" aria-selected="${activeSubTab === 'workbench'}">
          <span class="subtab-icon">🖥️</span> Workbench
        </button>
        <button type="button" class="subtab-btn ${activeSubTab === 'workers' ? 'active' : ''}" data-subtab="workers" role="tab" aria-selected="${activeSubTab === 'workers'}">
          <span class="subtab-icon">🤖</span> Workers
        </button>
        <button type="button" class="subtab-btn ${activeSubTab === 'quality' ? 'active' : ''}" data-subtab="quality" role="tab" aria-selected="${activeSubTab === 'quality'}">
          <span class="subtab-icon">🛡️</span> Quality
        </button>
        <button type="button" class="subtab-btn ${activeSubTab === 'security' ? 'active' : ''}" data-subtab="security" role="tab" aria-selected="${activeSubTab === 'security'}">
          <span class="subtab-icon">🔒</span> Security
        </button>
        <button type="button" class="subtab-btn ${activeSubTab === 'analytics' ? 'active' : ''}" data-subtab="analytics" role="tab" aria-selected="${activeSubTab === 'analytics'}">
          <span class="subtab-icon">📈</span> Analytics
        </button>
        <button type="button" class="subtab-btn ${activeSubTab === 'routing' ? 'active' : ''}" data-subtab="routing" role="tab" aria-selected="${activeSubTab === 'routing'}">
          <span class="subtab-icon">🔀</span> Routing
        </button>
      </nav>

      <div id="subtab-orchestrator" class="subtab-content ${activeSubTab === 'orchestrator' ? 'active' : ''}">
        <div class="orchestrator-grid">
          <section class="orchestrator-panel goal-orchestrator-panel">
            <div class="cockpit-panel-header"><span>Goal Orchestrator</span></div>
            <div class="orchestrator-metrics">
              <div><span>Total Goals</span><strong>${esc(runtimeSummary.total || 0)}</strong></div>
              <div><span>Active</span><strong>${esc((runtimeSummary.queued || 0) + (runtimeSummary.assigned || 0) + (runtimeSummary.running || 0) + (runtimeSummary.handoff || 0))}</strong></div>
              <div><span>Needs Approval</span><strong>${esc(runtimeSummary.needsApproval || 0)}</strong></div>
              <div><span>Done</span><strong>${esc(runtimeSummary.done || 0)}</strong></div>
            </div>
            <div class="goal-list">${goalHtml || '<p class="muted">No goal queue entries captured.</p>'}</div>
            ${goalToggleHtml}
          </section>

          <section class="orchestrator-panel">
            <div class="cockpit-panel-header"><span>Agent Pipeline</span></div>
            <div class="agent-pipeline">${pipelineHtml}</div>
            <div class="handoff-stream">
              <h3>Latest Handoffs</h3>
              ${handoffHtml || '<p class="muted">No handoffs captured.</p>'}
              ${handoffToggleHtml}
            </div>
          </section>

          <section class="orchestrator-panel">
            <div class="cockpit-panel-header"><span>Token / Context Budget</span></div>
            <div class="budget-panel">
              <div class="budget-ring" style="--budget:${esc(tokenPct)}%">
                <strong>${esc(compactNumber(tokenTotal))}</strong>
                <span>tokens</span>
              </div>
              <div class="budget-list">
                <div><span>High Sessions</span><strong>${esc(tokenSummary.highTokenSessions || 0)}</strong></div>
                <div><span>Mapped Runtime</span><strong>${esc(tokenSummary.runtimeMappedSessions || 0)}</strong></div>
                <div><span>Trust Score</span><strong>${esc(lastTrustRun.score || 0)}/100</strong></div>
                <div><span>Threat Findings</span><strong>${esc(trustSummary.threatFindings || 0)}</strong></div>
              </div>
            </div>
            <div class="cockpit-action-toolbar compact-toolbar">
              <button type="button" id="cockpit-btn-token-attribution" class="cockpit-action">Token Attribution</button>
              <button type="button" id="cockpit-btn-watch" class="cockpit-action">Run Watch</button>
            </div>
          </section>

          <section class="orchestrator-panel">
            <div class="cockpit-panel-header"><span>Quality Gate Timeline</span></div>
            <div class="quality-timeline">${qualityTimelineHtml || '<p class="muted">No quality events captured.</p>'}</div>
            <div class="cockpit-action-toolbar compact-toolbar">
              <button type="button" id="cockpit-btn-supervisor" class="cockpit-action primary">Supervisor</button>
              <button type="button" id="cockpit-btn-worker" class="cockpit-action">Worker</button>
              <button type="button" id="cockpit-btn-quality-review" class="cockpit-action">Quality Gate</button>
            </div>
          </section>
        </div>
        <section class="orchestrator-panel dag-orchestration-panel">
          <div class="cockpit-panel-header">
            <span>DAG Orchestration View</span>
            <small class="dag-reference-note">Synapse review captured locally</small>
          </div>
          <div class="dag-stage" aria-label="Read-only deterministic orchestration DAG">
            ${dagEdgesHtml}
            ${dagNodesHtml}
          </div>
          <div class="dag-legend">
            <span>Source: local runtime artifacts</span>
            <span>Human gate: ${esc(runtimeSummary.needsApproval || 0)} pending</span>
            <span>Restart-safe watch: ${runtimeSummary.watchLaunchAgent?.installed ? 'installed' : 'not configured'}</span>
            <span>License mode: reference only, no AGPL code copied</span>
          </div>
        </section>
        <section class="orchestrator-panel vibe-graph-panel">
          <div class="cockpit-panel-header">
            <span>Vibe Graph Draft</span>
            <small class="dag-reference-note">MASFactory review captured locally</small>
          </div>
          <div class="vibe-graph-stage" aria-label="Read-only Vibe Graph Draft">
            ${vibeDraftEdgesHtml}
            ${vibeDraftNodesHtml}
          </div>
          <div class="vibe-template-strip">${vibeTemplateHtml}</div>
          <div class="dag-legend">
            <span>Mode: proposed structure, not execution</span>
            <span>Nodes: Agent / Tool / Human / Switch / Loop / ContextBlock</span>
            <span>Reference: Apache-2.0 MASFactory, no install</span>
          </div>
        </section>
      </div>


      <div id="subtab-workbench" class="subtab-content ${activeSubTab === 'workbench' ? 'active' : ''}">
        <div class="cockpit-hero-grid">
          <section class="cockpit-network-panel">
            <div class="cockpit-panel-header">
              <span>Cyber Office Agent Floor</span>
            </div>
            <div id="team-agent-network" class="team-agent-network" aria-label="Interactive holographic agent network"></div>
            <div class="cockpit-network-footer">
              ${networkLegend}
            </div>
          </section>

          <section class="cockpit-console-panel">
            <div class="cockpit-panel-header">
              <span>COMMAND CONSOLE</span>
            </div>
            <div class="cockpit-terminal-wrapper">
              <span class="terminal-prompt">&gt;</span>
              <input type="text" id="cockpit-terminal-input" placeholder="Type command (e.g. status, verify, help)..." autocomplete="off" />
            </div>
            <div id="cockpit-terminal-log" class="cockpit-terminal-log">
              <div class="terminal-line muted">Welcome to Nova Commander. Type 'help' to see available tactical operations.</div>
            </div>
            <div class="cockpit-console-footer">
              <small>${esc(roster.length || roles.length)} nodes linked · ${esc(sessions.length)} live sessions · ${esc(reports.length)} evidence reports</small>
            </div>
          </section>

          <section class="cockpit-overview-panel">
            <div class="cockpit-panel-header">
              <span>Mission Overview</span>
            </div>
            <div class="team-control-summary cockpit-summary">
              <div>
                <span>Control Mode</span>
                <strong>${esc(data.mode || 'read-only')}</strong>
              </div>
              <div>
                <span>Overall</span>
                <strong class="text-${healthClass === 'healthy' ? 'green' : healthClass === 'critical' ? 'pink' : 'yellow'}">${esc(label(healthClass))}</strong>
              </div>
              ${metricHtml}
            </div>
            <div class="cockpit-route-card">
              <span>Primary Route</span>
              <strong>Feature/App Build -> Senior Full Stack Developer -> QA / Verification</strong>
              <small>Evidence-backed closeout through dashboard reports.</small>
            </div>
          </section>
        </div>

        <div class="team-control-grid cockpit-lower-grid">
          <section>
            <h3>Running Work</h3>
            ${runningHtml || '<p class="muted">No running routed work right now.</p>'}
          </section>
          <section>
            <h3>Recent Verification</h3>
            <div class="verification-list">
              ${reportsHtml || '<p class="muted">No verification reports found.</p>'}
              ${reportsToggleHtml}
            </div>
          </section>
        </div>
      </div>

      <div id="subtab-workers" class="subtab-content ${activeSubTab === 'workers' ? 'active' : ''}">
        <div class="team-control-grid cockpit-lower-grid">
          <section>
            <h3>Configured Agents Roster</h3>
            <div class="team-roles" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px;">
              ${rosterHtml}
            </div>
          </section>
          <section>
            <h3>Agent Status Overview</h3>
            <div class="team-roles">${rolesHtml || '<p class="muted">No roles surfaced.</p>'}</div>
          </section>
        </div>
        <div class="team-control-grid cockpit-lower-grid" style="margin-top: 14px;">
          <section>
            <h3>Active Instances Telemetry</h3>
            <div class="cockpit-bars">${uptimeBars || '<p class="muted">No role telemetry.</p>'}</div>
          </section>
        </div>
      </div>

      <div id="subtab-quality" class="subtab-content ${activeSubTab === 'quality' ? 'active' : ''}">
        <div class="team-control-grid cockpit-lower-grid">
          <section>
            <h3>Playbook Coverage Checklist</h3>
            <div class="team-playbooks">${playbookHtml}</div>
            <h3 style="margin-top: 20px;">Next Build Steps</h3>
            <ul class="team-rules">${nextHtml}</ul>
          </section>
          <section>
            <h3>Recent Verification Reports</h3>
            <div class="verification-list">
              ${reportsHtml || '<p class="muted">No verification reports found.</p>'}
              ${reportsToggleHtml}
            </div>
          </section>
        </div>
      </div>

      <div id="subtab-security" class="subtab-content ${activeSubTab === 'security' ? 'active' : ''}">
        <div class="team-control-grid cockpit-lower-grid">
          <section>
            <h3>Security Controls</h3>
            <p class="muted" style="font-size: 12px; line-height: 1.4; margin-bottom: 12px;">
              Trigger guardrail scans, trust level checking, audit generation, and supervisor autopilot.
            </p>
            <div class="cockpit-action-toolbar" style="margin-top: 0;">
              <div class="action-group">
                <span class="group-label">Autonomous Safety & Auditing</span>
                <div class="group-buttons">
                  <button type="button" id="cockpit-btn-autopilot" class="cockpit-action primary">Autopilot Mode</button>
                  <button type="button" id="cockpit-btn-trust-score" class="cockpit-action">Run Trust Score</button>
                  <button type="button" id="cockpit-btn-ui-design-audit" class="cockpit-action">Design Quality Gate</button>
                  <button type="button" id="cockpit-btn-audit-export" class="cockpit-action">Export Audit Logs</button>
                  <button type="button" id="cockpit-btn-doctor-diagnose" class="cockpit-action">Run Doctor</button>
                </div>
              </div>
            </div>
          </section>
          <section>
            <h3>Security Diagnostics Telemetry</h3>
            <div class="team-control-summary cockpit-summary">
              <div>
                <span>Trust Score Runs</span>
                <strong>${esc(data.runtime?.summary?.trustScoreRuns || 0)}</strong>
              </div>
              <div>
                <span>Token Attributions</span>
                <strong>${esc(data.runtime?.summary?.tokenAttributionRuns || 0)}</strong>
              </div>
              <div>
                <span>Audit Exports</span>
                <strong>${esc(data.runtime?.summary?.auditExports || 0)}</strong>
              </div>
              <div>
                <span>Doctor Runs</span>
                <strong>${esc(data.runtime?.summary?.doctorRuns || 0)}</strong>
              </div>
              <div>
                <span>UI Design Gate</span>
                <strong>${esc(data.runtime?.summary?.uiDesignAuditRuns || 0)}</strong>
              </div>
              <div>
                <span>UI Score</span>
                <strong class="text-${(lastUiAuditRun.score || 0) >= 90 ? 'green' : (lastUiAuditRun.score || 0) >= 70 ? 'yellow' : 'pink'}">${esc(lastUiAuditRun.score || 0)}/100</strong>
              </div>
              <div>
                <span>UI Findings</span>
                <strong>${esc(uiAuditSummary.findings || 0)}</strong>
              </div>
              <div>
                <span>Watchdog Daemon</span>
                <strong class="text-${data.runtime?.summary?.watchLaunchAgent?.installed ? 'green' : 'yellow'}">
                  ${data.runtime?.summary?.watchLaunchAgent?.installed ? 'Installed' : 'Not Configured'}
                </strong>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div id="subtab-analytics" class="subtab-content ${activeSubTab === 'analytics' ? 'active' : ''}">
        <div class="cockpit-analytics-grid">
          <section class="cockpit-module">
            <h3>Global Network</h3>
            <div class="cockpit-mini-map" id="cockpit-mini-map-container">
              <canvas id="cockpit-minimap-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
            </div>
          </section>
          <section class="cockpit-module">
            <h3>Performance Analytics</h3>
            <svg class="cockpit-line-chart" viewBox="0 0 100 100" role="img" aria-label="Agent performance trend">
              <defs>
                <linearGradient id="chart-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#00f0ff"/>
                  <stop offset="50%" stop-color="#38bdf8"/>
                  <stop offset="100%" stop-color="#34d399"/>
                </linearGradient>
              </defs>
              <polyline points="${esc(performancePoints || '0,60 100,60')}" fill="none" />
              ${(performancePoints || '').split(' ').filter(Boolean).map(point => {
                const [x, y] = point.split(',');
                return `<circle cx="${esc(x)}" cy="${esc(y)}" r="2.5" />`;
              }).join('')}
            </svg>
          </section>
          <section class="cockpit-module">
            <h3>Latest Updates</h3>
            <div class="cockpit-feed">${activityHtml || '<p class="muted">No recent agent activity.</p>'}</div>
          </section>
        </div>
      </div>

      <div id="subtab-routing" class="subtab-content ${activeSubTab === 'routing' ? 'active' : ''}">
        <div class="team-control-grid cockpit-lower-grid">
          <section>
            <h3>Routing Protocol Rules</h3>
            <ul class="team-rules">${routingHtml}</ul>
          </section>
        </div>
      </div>
    </div>
  `);

  initTeamAgentNetwork({ roles, roster, runningTasks, failedTasks, reports, health: healthClass });
  initCockpitMinimap({ roles, health: healthClass });

  // Bind Interactive Cockpit console terminal and buttons
  const termInput = document.getElementById('cockpit-terminal-input');
  const termLog = document.getElementById('cockpit-terminal-log');

  function appendTerminalLine(text, type = 'info') {
    if (!termLog) return;
    const line = document.createElement('div');
    line.className = `terminal-line ${type}`;
    line.textContent = text;
    termLog.appendChild(line);
    termLog.scrollTop = termLog.scrollHeight;
    while (termLog.children.length > 50) {
      termLog.removeChild(termLog.firstChild);
    }
  }

  // Bind sub-tabs navigation
  const subtabBtns = document.querySelectorAll('.subtab-btn');
  const subtabPanels = document.querySelectorAll('.subtab-content');

  subtabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSubtab = btn.getAttribute('data-subtab');
      window.dashboardState.activeSubTab = targetSubtab;

      subtabBtns.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-subtab') === targetSubtab);
        b.setAttribute('aria-selected', b.getAttribute('data-subtab') === targetSubtab);
      });

      subtabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `subtab-${targetSubtab}`);
      });

      if (typeof playCommandSound === 'function') {
        playCommandSound('confirm');
      }

      // Fire a resize event so WebGL canvases adapt to newly shown container sizes
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
    });
  });

  // Goal toggle: show/hide extra goals
  const goalToggleBtn = document.getElementById('goal-toggle-btn');
  const goalExtra = document.getElementById('goal-extra');
  if (goalToggleBtn && goalExtra) {
    goalToggleBtn.addEventListener('click', () => {
      const isHidden = goalExtra.style.display === 'none';
      goalExtra.style.display = isHidden ? 'block' : 'none';
      goalToggleBtn.textContent = isHidden ? `Hide extra goals` : `Show ${goalExtra.children.length} more goal${goalExtra.children.length > 1 ? 's' : ''}`;
    });
  }

  // Handoff toggle: show/hide extra handoffs
  const handoffToggleBtn = document.getElementById('handoff-toggle-btn');
  const handoffExtra = document.getElementById('handoff-extra');
  if (handoffToggleBtn && handoffExtra) {
    handoffToggleBtn.addEventListener('click', () => {
      const isHidden = handoffExtra.style.display === 'none';
      handoffExtra.style.display = isHidden ? 'block' : 'none';
      handoffToggleBtn.textContent = isHidden ? `Hide extra handoffs` : `Show ${handoffExtra.children.length} more handoff${handoffExtra.children.length > 1 ? 's' : ''}`;
    });
  }

  // Reports toggle: show/hide extra verification reports (handles multiple instances via class)
  const allReportsToggles = document.querySelectorAll('[data-scope="reports"]');
  allReportsToggles.forEach(btn => {
    const extra = btn.nextElementSibling;
    if (extra && extra.classList.contains('reports-extra')) {
      btn.addEventListener('click', () => {
        const isHidden = extra.style.display === 'none';
        extra.style.display = isHidden ? 'block' : 'none';
        btn.textContent = isHidden ? `Hide extra reports` : `Show ${extra.children.length} more report${extra.children.length > 1 ? 's' : ''}`;
      });
    }
  });

  // Action Button Setup Helper
  function setupActionButton(btnId, apiPath, actionName, successCallback) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    let resetTimeout = null;
    btn.addEventListener('click', async () => {
      termInput?.focus();
      
      if (!btn.classList.contains('confirm-prompt')) {
        playCommandSound('tap');
        btn.classList.add('confirm-prompt');
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'Confirm?';
        
        resetTimeout = setTimeout(() => {
          btn.classList.remove('confirm-prompt');
          btn.textContent = btn.dataset.originalText;
        }, 3000);
      } else {
        if (resetTimeout) clearTimeout(resetTimeout);
        btn.classList.remove('confirm-prompt');
        btn.classList.add('is-loading');
        
        appendTerminalLine(`Triggering ${actionName}...`, 'loading');
        
        try {
          const res = await fetch(apiUrl(apiPath));
          const resData = await res.json();
          if (resData.ok || resData.status === 'healthy' || resData.hasOwnProperty('overall')) {
            appendTerminalLine(`${actionName} successful!`, 'success');
            if (successCallback) successCallback(resData);
            if (typeof load === 'function') {
              load(true);
            }
          } else {
            appendTerminalLine(`${actionName} failed: ${resData.error || resData.output || 'unknown error'}`, 'error');
          }
        } catch (err) {
          appendTerminalLine(`${actionName} error: ${err.message}`, 'error');
        } finally {
          btn.classList.remove('is-loading');
          btn.textContent = btn.dataset.originalText;
        }
      }
    });
  }

  // Setup Actions
  setupActionButton('cockpit-btn-verify', '/api/run-verification', 'Verification Gate');
  setupActionButton('cockpit-btn-trust-score', '/api/run-trust-score', 'Trust Score');
  setupActionButton('cockpit-btn-ui-design-audit', '/api/run-ui-design-audit', 'Design Quality Gate');
  setupActionButton('cockpit-btn-audit-export', '/api/multiagent-audit-export', 'Audit Export');
  setupActionButton('cockpit-btn-doctor-diagnose', '/api/run-doctor', 'Doctor Diagnostics');
  setupActionButton('cockpit-btn-autopilot', '/api/run-autopilot', 'Autopilot Loop');
  setupActionButton('cockpit-btn-supervisor', '/api/run-supervisor', 'Supervisor Routing');
  setupActionButton('cockpit-btn-worker', '/api/run-worker', 'Worker Handoff');
  setupActionButton('cockpit-btn-quality-review', '/api/run-quality-review', 'Quality Gate Review');
  setupActionButton('cockpit-btn-token-attribution', '/api/run-token-attribution', 'Token Attribution');
  setupActionButton('cockpit-btn-watch', '/api/run-watch', 'Scheduled Watch');

  async function executeVerification() {
    appendTerminalLine('Executing task verification gate...', 'loading');
    try {
      const res = await fetch(apiUrl('/api/run-verification'));
      const resData = await res.json();
      if (resData.ok) {
        appendTerminalLine(`Verification Passed: ${resData.taskId}`, 'success');
        appendTerminalLine(`Report: outputs/verification/${resData.taskId}.json`, 'muted');
        if (typeof load === 'function') {
          load(true);
        }
      } else {
        appendTerminalLine(`Verification Failed: ${resData.taskId}`, 'error');
        if (resData.output) {
          appendTerminalLine(resData.output.slice(0, 500), 'error');
        }
      }
    } catch (err) {
      appendTerminalLine(`Verification error: ${err.message}`, 'error');
    }
  }

  if (termInput && termLog) {
    termInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const cmdText = termInput.value.trim();
        termInput.value = '';
        if (!cmdText) return;

        appendTerminalLine(`> ${cmdText}`, 'command');

        const args = cmdText.split(/\s+/);
        const cmd = args[0].toLowerCase();

        if (cmd === 'help') {
          appendTerminalLine('Available commands:', 'info');
          appendTerminalLine('  status   - Probe system health & live stats', 'muted');
          appendTerminalLine('  verify   - Execute deterministic verification gate', 'muted');
          appendTerminalLine('  agents   - List configured OpenClaw agents', 'muted');
          appendTerminalLine('  tasks    - Print running & queued background tasks', 'muted');
          appendTerminalLine('  sessions - List active agent conversation threads', 'muted');
          appendTerminalLine('  goals    - Print orchestrator goal queue', 'muted');
          appendTerminalLine('  dag      - Print deterministic DAG lifecycle counts', 'muted');
          appendTerminalLine('  vibe     - Print Vibe Graph Draft template', 'muted');
          appendTerminalLine('  pipeline - Print lifecycle counts', 'muted');
          appendTerminalLine('  token    - Run token/context attribution', 'muted');
          appendTerminalLine('  quality  - Run final quality gate review', 'muted');
          appendTerminalLine('  design   - Run UI design quality gate', 'muted');
          appendTerminalLine('  watch    - Run scheduled local watch', 'muted');
          appendTerminalLine('  logs     - Show recent watchdog log entries', 'muted');
          appendTerminalLine('  clear    - Clear console logs', 'muted');
        } else if (cmd === 'clear') {
          termLog.innerHTML = '';
        } else if (cmd === 'status') {
          appendTerminalLine('Probing gateway telemetry...', 'loading');
          try {
            const res = await fetch(apiUrl('/api/status'));
            const statusData = await res.json();
            appendTerminalLine(`Status: [${statusData.overall.toUpperCase()}]`, statusData.overall === 'healthy' ? 'success' : 'warn');
            (statusData.services || []).forEach(s => {
              appendTerminalLine(`  ${s.name}: ${s.status.toUpperCase()}`, s.status === 'healthy' ? 'muted' : 'warn');
            });
          } catch (err) {
            appendTerminalLine(`Error fetching status: ${err.message}`, 'error');
          }
        } else if (cmd === 'verify') {
          await executeVerification();
        } else if (cmd === 'agents') {
          appendTerminalLine('Registered Agents in roster:', 'info');
          roster.forEach(a => {
            appendTerminalLine(`  ${a.emoji} ${a.name} [ID: ${a.id}] (Model: ${a.model})`, 'muted');
          });
        } else if (cmd === 'tasks') {
          if (runningTasks.length === 0) {
            appendTerminalLine('No active background tasks running.', 'info');
          } else {
            appendTerminalLine('Running/Queued Background Tasks:', 'info');
            runningTasks.forEach(t => {
              appendTerminalLine(`  ${t.taskId}: ${t.label || t.task} [${t.status}]`, 'warn');
            });
          }
        } else if (cmd === 'goals') {
          if (queue.length === 0) {
            appendTerminalLine('No orchestrator goals captured.', 'info');
          } else {
            appendTerminalLine('Goal Orchestrator Queue:', 'info');
            queue.slice(0, 8).forEach(t => {
              appendTerminalLine(`  ${t.taskId}: ${t.status} -> ${t.assignedRole || 'unassigned'} | ${t.title || 'goal'}`, t.status === 'done' ? 'muted' : 'warn');
            });
          }
        } else if (cmd === 'pipeline') {
          appendTerminalLine('Agent Pipeline Lifecycle:', 'info');
          lifecycleSteps.forEach(([key, name]) => {
            appendTerminalLine(`  ${name}: ${runtimeSummary[key] || 0}`, 'muted');
          });
        } else if (cmd === 'dag') {
          appendTerminalLine('Deterministic DAG View:', 'info');
          dagSteps.forEach((step, index) => {
            const arrow = index < dagSteps.length - 1 ? ' ->' : '';
            appendTerminalLine(`  ${String(index + 1).padStart(2, '0')} ${step.name}: ${step.count}${arrow}`, step.status === 'idle' ? 'muted' : 'info');
          });
          appendTerminalLine(`  Human gates pending: ${runtimeSummary.needsApproval || 0}`, runtimeSummary.needsApproval ? 'warn' : 'muted');
        } else if (cmd === 'vibe') {
          appendTerminalLine('Vibe Graph Draft:', 'info');
          vibeDraftNodes.forEach((node, index) => {
            const arrow = index < vibeDraftNodes.length - 1 ? ' ->' : '';
            appendTerminalLine(`  ${String(index + 1).padStart(2, '0')} ${node.type}: ${node.label}${arrow}`, node.type === 'Human' ? 'warn' : 'muted');
          });
          appendTerminalLine('Draft mode only: explicit approval required before runtime execution.', 'success');
        } else if (cmd === 'token') {
          appendTerminalLine('Triggering token/context attribution...', 'loading');
          try {
            const res = await fetch(apiUrl('/api/run-token-attribution'));
            const resData = await res.json();
            appendTerminalLine(resData.ok ? 'Token attribution complete.' : `Token attribution failed: ${resData.error || 'unknown'}`, resData.ok ? 'success' : 'error');
            if (typeof load === 'function') load(true);
          } catch (err) {
            appendTerminalLine(`Token attribution error: ${err.message}`, 'error');
          }
        } else if (cmd === 'quality') {
          appendTerminalLine('Triggering final quality gate...', 'loading');
          try {
            const res = await fetch(apiUrl('/api/run-quality-review'));
            const resData = await res.json();
            appendTerminalLine(resData.ok ? 'Quality gate complete.' : `Quality gate failed: ${resData.error || 'unknown'}`, resData.ok ? 'success' : 'error');
            if (typeof load === 'function') load(true);
          } catch (err) {
            appendTerminalLine(`Quality gate error: ${err.message}`, 'error');
          }
        } else if (cmd === 'design') {
          appendTerminalLine('Triggering UI design quality gate...', 'loading');
          try {
            const res = await fetch(apiUrl('/api/run-ui-design-audit'));
            const resData = await res.json();
            appendTerminalLine(resData.ok ? `Design gate complete: ${resData.report?.readiness || 'captured'} score=${resData.report?.score ?? 'n/a'}` : `Design gate failed: ${resData.error || 'unknown'}`, resData.ok ? 'success' : 'error');
            if (typeof load === 'function') load(true);
          } catch (err) {
            appendTerminalLine(`Design gate error: ${err.message}`, 'error');
          }
        } else if (cmd === 'watch') {
          appendTerminalLine('Triggering local scheduled watch...', 'loading');
          try {
            const res = await fetch(apiUrl('/api/run-watch'));
            const resData = await res.json();
            appendTerminalLine(resData.ok ? 'Watch complete.' : `Watch failed: ${resData.error || 'unknown'}`, resData.ok ? 'success' : 'error');
            if (typeof load === 'function') load(true);
          } catch (err) {
            appendTerminalLine(`Watch error: ${err.message}`, 'error');
          }
        } else if (cmd === 'sessions') {
          if (sessions.length === 0) {
            appendTerminalLine('No active sessions in the database.', 'info');
          } else {
            appendTerminalLine('Active Threads:', 'info');
            sessions.forEach(s => {
              appendTerminalLine(`  ${s.sessionId}: ${s.model} - age: ${Math.round(s.age/1000)}s`, 'muted');
            });
          }
        } else if (cmd === 'logs') {
          appendTerminalLine('Fetching guard watchdog logs...', 'loading');
          try {
            const res = await fetch(apiUrl('/api/status'));
            const resData = await res.json();
            const logs = resData.guard?.recent || [];
            if (logs.length === 0) {
              appendTerminalLine('No recent watchdog events.', 'warn');
            } else {
              logs.slice(0, 10).forEach(l => {
                appendTerminalLine(`  [${l.ts || ''}] ${l.event || 'check'}: ${l.output || ''}`, 'muted');
              });
            }
          } catch (err) {
            appendTerminalLine(`Error loading logs: ${err.message}`, 'error');
          }
        } else {
          appendTerminalLine(`Unknown command: '${cmd}'. Type 'help' for options.`, 'error');
        }
      }
    });
  }

  const btnLogs = document.getElementById('cockpit-btn-logs');
  const btnDeploy = document.getElementById('cockpit-btn-deploy');

  if (btnLogs) {
    btnLogs.addEventListener('click', () => {
      termInput?.focus();
      appendTerminalLine('> logs', 'command');
      if (termInput) {
        termInput.value = 'logs';
        termInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      }
    });
  }

  if (btnDeploy) {
    btnDeploy.addEventListener('click', () => {
      termInput?.focus();
      appendTerminalLine('> deploy', 'command');
      appendTerminalLine('Tactical Deployment Wizard:', 'info');
      appendTerminalLine('  To deploy a specialist agent to route a task, use the main chat interface.', 'muted');
      appendTerminalLine('  Active Routing Rules:', 'info');
      (data.routerRules || []).forEach(r => {
        appendTerminalLine(`  - ${r}`, 'muted');
      });
    });
  }


}

let teamNetworkScene = null;
let teamNetworkRenderer = null;
let teamNetworkCamera = null;
let teamNetworkFrame = null;
let teamNetworkResizeHandler = null;
let serverBlinkingLights = [];

let miniScene = null;
let miniRenderer = null;
let miniCamera = null;
let miniFrame = null;
let miniResizeHandler = null;

function initTeamAgentNetwork({ roles = [], roster = [], runningTasks = [], failedTasks = [], reports = [], health = 'healthy' } = {}) {
  const container = document.getElementById('team-agent-network');
  if (!container || !window.THREE) return;

  if (teamNetworkFrame) cancelAnimationFrame(teamNetworkFrame);
  if (teamNetworkResizeHandler) window.removeEventListener('resize', teamNetworkResizeHandler);
  if (window.teamNetworkPointerUpHandler) {
    window.removeEventListener('mouseup', window.teamNetworkPointerUpHandler);
    window.removeEventListener('mouseup', window.teamNetworkTouchEndHandler);
  }
  if (teamNetworkRenderer) {
    teamNetworkRenderer.dispose();
    teamNetworkRenderer.domElement?.remove();
  }

  container.innerHTML = '';
  const THREE = window.THREE;
  const width = Math.max(container.clientWidth, 320);
  const height = Math.max(container.clientHeight, 260);
  const statusColors = {
    healthy: 0x00f0ff,
    active: 0x38bdf8,
    warning: 0xffa133,
    critical: 0xff3b5c,
  };
  const rolesForNodes = roles.length ? roles : roster.map(agent => ({
    id: agent.id,
    name: agent.name,
    status: agent.isDefault ? 'active' : 'healthy',
  }));

  teamNetworkScene = new THREE.Scene();

  // Sci-Fi Key & Fill Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.48);
  teamNetworkScene.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
  dirLight1.position.set(50, 150, 30);
  teamNetworkScene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0x00f0ff, 0.45);
  dirLight2.position.set(-50, -30, -30);
  teamNetworkScene.add(dirLight2);

  teamNetworkCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  teamNetworkCamera.position.set(0, 95, 135);
  teamNetworkCamera.lookAt(0, -10, 0);

  teamNetworkRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  teamNetworkRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  teamNetworkRenderer.setSize(width, height);
  container.appendChild(teamNetworkRenderer.domElement);

  const root = new THREE.Group();
  teamNetworkScene.add(root);

  // Initialize server blinking lights array
  serverBlinkingLights = [];

  // 1. Draw solid steel floor plate grid system
  const plateGeo = new THREE.BoxGeometry(23, 0.4, 23);
  const plateMat = new THREE.MeshPhongMaterial({
    color: 0x111827, // dark metallic charcoal
    shininess: 90,
    specular: 0x374151
  });
  // Draw 16 floor plates arranged in 4x4 layout
  for (let z = -2; z <= 1; z++) {
    for (let x = -2; x <= 1; x++) {
      const plate = new THREE.Mesh(plateGeo, plateMat);
      plate.position.set(x * 25 + 12.5, -12.2, z * 25 + 12.5);
      root.add(plate);
    }
  }

  // Neon glowing conduit lines running in the gaps of the plates
  const conduitGeo = new THREE.BoxGeometry(110, 0.2, 0.2);
  const conduitMat = new THREE.MeshBasicMaterial({ color: 0x00d8ff, transparent: true, opacity: 0.15 });
  for (let z = -1; z <= 1; z++) {
    const line = new THREE.Mesh(conduitGeo, conduitMat);
    line.position.set(0, -12, z * 25);
    root.add(line);
  }
  const conduitGeoV = new THREE.BoxGeometry(0.2, 0.2, 110);
  for (let x = -1; x <= 1; x++) {
    const line = new THREE.Mesh(conduitGeoV, conduitMat);
    line.position.set(x * 25, -12, 0);
    root.add(line);
  }

  // 2. Draw Server Racks in corners
  const serverGeo = new THREE.BoxGeometry(6, 20, 6);
  const serverMat = new THREE.MeshPhongMaterial({ color: 0x070b12, shininess: 40 });
  const cornerPositions = [
    { x: -50, z: -50 },
    { x: 50, z: -50 },
    { x: -50, z: 50 },
    { x: 50, z: 50 }
  ];
  
  cornerPositions.forEach(pos => {
    const server = new THREE.Mesh(serverGeo, serverMat);
    server.position.set(pos.x, -2, pos.z);
    root.add(server);

    // Blinking lights on front face of server
    const lightCount = 8;
    for (let l = 0; l < lightCount; l++) {
      const lightGeo = new THREE.SphereGeometry(0.18, 6, 6);
      const isRed = Math.random() > 0.5;
      const lightMat = new THREE.MeshBasicMaterial({
        color: isRed ? 0xff3b5c : 0x22c55e,
        transparent: true,
        opacity: 0.85
      });
      const lightMesh = new THREE.Mesh(lightGeo, lightMat);
      // Offset lights on front of rack
      lightMesh.position.set(pos.x + 2.9, -10 + l * 2.2, pos.z + (Math.random() - 0.5) * 4);
      root.add(lightMesh);
      serverBlinkingLights.push(lightMesh);
    }
  });

  // 3. Draw vertical cyan glowing tubes in corners
  const tubeGeo = new THREE.CylinderGeometry(0.3, 0.3, 26, 8);
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.6 });
  const tubePositions = [
    { x: -53, z: -53 },
    { x: 53, z: -53 },
    { x: -53, z: 53 },
    { x: 53, z: 53 }
  ];
  tubePositions.forEach(pos => {
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.position.set(pos.x, 1, pos.z);
    root.add(tube);
  });

  const nodeGroup = new THREE.Group();
  root.add(nodeGroup);
  const nodePositions = [];
  
  // Custom desk configuration mapping for each role/agent type
  const getOfficeConfig = (roleId, index) => {
    const cleanId = String(roleId || '').toLowerCase();
    if (cleanId.includes('orchestrator')) {
      return { name: 'Orchestrator Command Hub', x: 0, z: -10, color: 0x00f0ff };
    }
    if (cleanId.includes('reader') || cleanId.includes('repo')) {
      return { name: 'Repo Reader Archives', x: -35, z: 25, color: 0x38bdf8 };
    }
    if (cleanId.includes('qa') || cleanId.includes('verify') || cleanId.includes('quality')) {
      return { name: 'QA Verification Lab', x: 35, z: 25, color: 0x34d399 };
    }
    if (cleanId.includes('developer') || cleanId.includes('stack') || cleanId.includes('engineer')) {
      return { name: 'Developer Suite', x: -35, z: -25, color: 0xa78bfa };
    }
    if (cleanId.includes('support') || cleanId.includes('rca') || cleanId.includes('sre')) {
      return { name: 'SRE Command Tower', x: 35, z: -25, color: 0xffa133 };
    }
    if (cleanId.includes('automation') || cleanId.includes('cron') || cleanId.includes('workflow')) {
      return { name: 'Automation Gateway', x: 0, z: 40, color: 0xff4766 };
    }
    if (cleanId.includes('dashboard') || cleanId.includes('control')) {
      return { name: 'Dashboard Interface Room', x: 0, z: -40, color: 0x22d3ee };
    }
    // Fallback circular layout
    const theta = (index / Math.max(rolesForNodes.length, 1)) * Math.PI * 2;
    return {
      name: `Desk Zone ${index + 1}`,
      x: Math.sin(theta) * 35,
      z: Math.cos(theta) * 35,
      color: 0x00f0ff
    };
  };

  const roomsList = [];
  const coreList = [];

  for (let i = 0; i < rolesForNodes.length; i += 1) {
    const role = rolesForNodes[i] || {};
    const config = getOfficeConfig(role.id || role.name, i);
    const status = failedTasks.length && i === 0 ? 'warning' : runningTasks.length && i === 1 ? 'active' : role.status || 'healthy';
    const colorHex = statusColors[status] || config.color || 0x00f0ff;

    let podMesh;

    if (i === 0) {
      // CENTER Orchestrator: Render a large circular Command Table
      const baseGeo = new THREE.CylinderGeometry(8, 9, 3.5, 8);
      const baseMat = new THREE.MeshPhongMaterial({
        color: 0x1e293b,
        shininess: 80,
        specular: 0x334155
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.set(config.x, -10.5, config.z);
      root.add(baseMesh);

      // Glowing table boundary rim
      const rimGeo = new THREE.CylinderGeometry(9.1, 9.1, 0.4, 8, 1, true);
      const rimMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.65 });
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.position.set(config.x, -8.7, config.z);
      root.add(rimMesh);

      // Huge Holographic projection on top
      const holoGeo = new THREE.SphereGeometry(6, 12, 12);
      const holoMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending
      });
      podMesh = new THREE.Mesh(holoGeo, holoMat);
      podMesh.position.set(config.x, -3, config.z);

      // Revolving projection rings
      const holoRing1 = new THREE.Mesh(
        new THREE.RingGeometry(7.5, 10, 16),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      );
      holoRing1.rotation.x = Math.PI * 0.5;
      holoRing1.position.y = 2.5;
      podMesh.add(holoRing1);

      const holoRing2 = new THREE.Mesh(
        new THREE.RingGeometry(8, 12, 16),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
      );
      holoRing2.rotation.x = Math.PI * 0.35;
      holoRing2.position.y = -2.5;
      podMesh.add(holoRing2);

      // Add a small energy core inside
      const coreGeo = new THREE.CylinderGeometry(1.2, 1.2, 8, 8);
      const coreMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.8 });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      podMesh.add(coreMesh);

      podMesh.userData = {
        label: role.name || role.id || `Agent ${i + 1}`,
        status: status,
        roomName: config.name,
        roomMesh: rimMesh,
        coreMesh: coreMesh,
        holoRingMesh: holoRing1,
        baseColor: colorHex
      };

      nodeGroup.add(podMesh);
      nodePositions.push(podMesh.position);
    } else {
      // REGULAR WORKSTATIONS (Technicians at Desks)
      // 1. Solid floor platform
      const platformGeo = new THREE.CylinderGeometry(11, 12, 1.5, 16);
      const platformMat = new THREE.MeshPhongMaterial({
        color: 0x1e293b,
        shininess: 70,
        specular: 0x334155
      });
      const platformMesh = new THREE.Mesh(platformGeo, platformMat);
      platformMesh.position.set(config.x, -11.25, config.z);
      root.add(platformMesh);

      // Glowing rim around the platform
      const rimGeo = new THREE.CylinderGeometry(12.1, 12.1, 0.25, 16, 1, true);
      const rimMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
      });
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.position.set(config.x, -11.25, config.z);
      root.add(rimMesh);

      // 2. Draw solid semi-circular partition wall (Sci-Fi cubicle wall)
      const partitionGeo = new THREE.CylinderGeometry(9, 9, 5, 16, 1, true, 0, Math.PI * 1.35);
      const partitionMat = new THREE.MeshPhongMaterial({
        color: 0x334155,
        shininess: 40,
        specular: 0x475569,
        side: THREE.DoubleSide
      });
      const partitionMesh = new THREE.Mesh(partitionGeo, partitionMat);
      partitionMesh.position.set(config.x, -8.75, config.z);
      partitionMesh.rotation.y = Math.PI * 0.25 + i * 0.5; // Rotate partition slightly uniquely
      root.add(partitionMesh);

      // Glowing neon cap trim running along the top of the partition wall
      const trimGeo = new THREE.CylinderGeometry(9.1, 9.1, 0.35, 16, 1, true, 0, Math.PI * 1.35);
      const trimMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide
      });
      const trimMesh = new THREE.Mesh(trimGeo, trimMat);
      trimMesh.position.set(config.x, -6.1, config.z);
      trimMesh.rotation.y = Math.PI * 0.25 + i * 0.5;
      root.add(trimMesh);
      roomsList.push(trimMesh); // Set to roomMesh for hover highlight

      // 3. Central Hexagonal Control Desk
      const deskGeo = new THREE.CylinderGeometry(4.5, 4.8, 2.2, 6);
      const deskMat = new THREE.MeshPhongMaterial({
        color: 0x0f172a,
        shininess: 50
      });
      const deskMesh = new THREE.Mesh(deskGeo, deskMat);
      deskMesh.position.set(config.x, -10.15, config.z);
      root.add(deskMesh);

      // Keyboard details
      const keyboardGeo = new THREE.BoxGeometry(2.4, 0.08, 0.9);
      const keyboardMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.65 });
      const keyboard = new THREE.Mesh(keyboardGeo, keyboardMat);
      keyboard.position.set(config.x + Math.sin(Math.PI * 0.25 + i * 0.5 + Math.PI) * 1.8, -8.95, config.z + Math.cos(Math.PI * 0.25 + i * 0.5 + Math.PI) * 1.8);
      keyboard.rotation.y = Math.PI * 0.25 + i * 0.5 + Math.PI;
      root.add(keyboard);

      // 4. Draw a capsule pod (the main interactive element)
      const podGeo = new THREE.CylinderGeometry(2, 2, 9, 12, 1);
      const podMat = new THREE.MeshPhongMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.22,
        shininess: 100,
        specular: 0xffffff,
        depthWrite: false
      });
      podMesh = new THREE.Mesh(podGeo, podMat);
      podMesh.position.set(config.x, -5.5, config.z);

      // Top metal cap for capsule
      const capTopGeo = new THREE.CylinderGeometry(2.1, 2.1, 0.6, 12);
      const capMat = new THREE.MeshPhongMaterial({
        color: 0x475569,
        shininess: 80,
        specular: 0x64748b
      });
      const capTopMesh = new THREE.Mesh(capTopGeo, capMat);
      capTopMesh.position.y = 4.8;
      podMesh.add(capTopMesh);

      // Bottom metal cap for capsule
      const capBotMesh = new THREE.Mesh(capTopGeo, capMat);
      capBotMesh.position.y = -4.8;
      podMesh.add(capBotMesh);

      // 5. Draw the inner glowing status core cylinder
      const coreGeo = new THREE.CylinderGeometry(0.8, 0.8, 8, 8);
      const coreMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.72
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.y = 0;
      podMesh.add(coreMesh);
      coreList.push(coreMesh);

      // 6. Draw two floating monitors angled towards the center
      const monitorGroup = new THREE.Group();
      
      const monitorGeo = new THREE.BoxGeometry(2.4, 1.6, 0.1);
      const monitorMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.65
      });
      
      const screen1 = new THREE.Mesh(monitorGeo, monitorMat);
      screen1.position.set(-3.2, 0, 1.8);
      screen1.rotation.y = Math.PI * 0.15;
      monitorGroup.add(screen1);
      
      const screen2 = new THREE.Mesh(monitorGeo, monitorMat);
      screen2.position.set(3.2, 0, 1.8);
      screen2.rotation.y = -Math.PI * 0.15;
      monitorGroup.add(screen2);
      
      monitorGroup.position.y = -1; // Lower floating position relative to podMesh center
      podMesh.add(monitorGroup);

      // Glowing revolving holographic radar ring
      const holoRingGeo = new THREE.RingGeometry(2.5, 4.5, 16);
      const holoRingMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide
      });
      const holoRingMesh = new THREE.Mesh(holoRingGeo, holoRingMat);
      holoRingMesh.position.y = 5.2;
      holoRingMesh.rotation.x = Math.PI * 0.5; // Lay it flat horizontally
      podMesh.add(holoRingMesh);

      // 7. Render a Sci-Fi Technician Chair
      const chairGroup = new THREE.Group();
      const chairStandGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.8, 8);
      const chairStandMat = new THREE.MeshPhongMaterial({ color: 0x475569, shininess: 80 });
      const chairStand = new THREE.Mesh(chairStandGeo, chairStandMat);
      chairStand.position.y = -10.9;
      chairGroup.add(chairStand);

      const seatGeo = new THREE.BoxGeometry(2, 0.3, 2);
      const seatMat = new THREE.MeshPhongMaterial({ color: 0x0f172a, shininess: 30 });
      const seat = new THREE.Mesh(seatGeo, seatMat);
      seat.position.y = -9.9;
      chairGroup.add(seat);

      const backGeo = new THREE.BoxGeometry(2, 2.2, 0.3);
      const back = new THREE.Mesh(backGeo, seatMat);
      back.position.set(0, -8.7, 0.95);
      chairGroup.add(back);

      const chairAngle = Math.PI * 0.25 + i * 0.5 + Math.PI * 0.67;
      const chairDist = 6.2;
      const chairX = config.x + Math.sin(chairAngle) * chairDist;
      const chairZ = config.z + Math.cos(chairAngle) * chairDist;
      chairGroup.position.set(chairX, 0, chairZ);
      chairGroup.rotation.y = chairAngle + Math.PI;
      root.add(chairGroup);

      // 8. Render the Technician
      const techGroup = new THREE.Group();
      const torsoGeo = new THREE.CylinderGeometry(0.55, 0.65, 1.6, 8);
      const torsoMat = new THREE.MeshPhongMaterial({ color: 0x334155, shininess: 20 });
      const torso = new THREE.Mesh(torsoGeo, torsoMat);
      torso.position.y = -9.0;
      techGroup.add(torso);

      const headGeo = new THREE.SphereGeometry(0.48, 10, 10);
      const headMat = new THREE.MeshPhongMaterial({ color: 0xe2e8f0, shininess: 60 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = -8.0;
      techGroup.add(head);

      const visorGeo = new THREE.BoxGeometry(0.6, 0.25, 0.2);
      const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.position.set(0, -7.95, -0.4);
      techGroup.add(visor);

      const armGeo = new THREE.CylinderGeometry(0.18, 0.15, 1.1, 6);
      const armMat = new THREE.MeshPhongMaterial({ color: 0x475569 });
      const leftArm = new THREE.Mesh(armGeo, armMat);
      leftArm.position.set(-0.7, -8.8, -0.4);
      leftArm.rotation.x = -Math.PI * 0.35;
      leftArm.rotation.z = Math.PI * 0.1;
      techGroup.add(leftArm);

      const rightArm = new THREE.Mesh(armGeo, armMat);
      rightArm.position.set(0.7, -8.8, -0.4);
      rightArm.rotation.x = -Math.PI * 0.35;
      rightArm.rotation.z = -Math.PI * 0.1;
      techGroup.add(rightArm);

      techGroup.position.set(chairX, 0, chairZ);
      techGroup.rotation.y = chairAngle + Math.PI;
      root.add(techGroup);

      podMesh.userData = {
        label: role.name || role.id || `Agent ${i + 1}`,
        status: status,
        roomName: config.name,
        roomMesh: trimMesh, // Wall trim glows white on hover
        coreMesh: coreMesh, // Inner core glows white on hover
        holoRingMesh: holoRingMesh, // Rotating holo ring glows white on hover
        baseColor: colorHex
      };

      nodeGroup.add(podMesh);
      nodePositions.push(podMesh.position);
    }
  }

  // Draw link lines connecting Orchestrator Command Hub (node 0) to all other rooms
  const linePositions = [];
  const orchestratorPos = nodePositions[0] || new THREE.Vector3(0, -5.5, -10);
  for (let i = 1; i < nodePositions.length; i += 1) {
    const pos = nodePositions[i];
    linePositions.push(orchestratorPos.x, orchestratorPos.y, orchestratorPos.z, pos.x, pos.y, pos.z);
  }

  let links = null;
  if (linePositions.length > 0) {
    links = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3)),
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.25 + Math.min(reports.length, 6) * 0.02,
        blending: THREE.AdditiveBlending,
      })
    );
    nodeGroup.add(links);
  }

  // Floating matrix space dust particles
  const particleGeometry = new THREE.BufferGeometry();
  const particlePointsCount = 180;
  const posArray = new Float32Array(particlePointsCount * 3);
  for (let i = 0; i < particlePointsCount * 3; i += 3) {
    posArray[i] = (Math.random() - 0.5) * 110;
    posArray[i+1] = -12 + Math.random() * 40; // float above floor
    posArray[i+2] = (Math.random() - 0.5) * 110;
  }
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const particleMaterial = new THREE.PointsMaterial({
    size: 1.4,
    color: statusColors[health] || 0x00f0ff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending
  });
  const particlesMesh = new THREE.Points(particleGeometry, particleMaterial);
  root.add(particlesMesh);

  // Moving data transmission pulses along links (from center Orchestrator to target pods)
  const pulses = [];
  const pulseGeometry = new THREE.SphereGeometry(0.8, 8, 8);
  const pulseMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending
  });
  if (nodePositions.length > 1) {
    for (let i = 1; i < nodePositions.length; i++) {
      const mesh = new THREE.Mesh(pulseGeometry, pulseMaterial);
      root.add(mesh);
      pulses.push({
        mesh,
        sourceIdx: 0, // Orchestrator Hub
        targetIdx: i,
        progress: Math.random()
      });
    }
  }

  // Label configuration
  const label = document.createElement('div');
  label.className = 'team-agent-network-label';
  label.textContent = `${nodePositions.length} DESK ROOMS ACTIVE / STAR OFFICE PROTOCOL`;
  container.appendChild(label);

  // Tooltip configuration
  let tooltip = container.querySelector('.cockpit-network-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'cockpit-network-tooltip';
    container.appendChild(tooltip);
  }

  // Pointer drag interaction variables
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let targetRotationX = 0;
  let targetRotationY = 0;
  let currentRotationX = 0;
  let currentRotationY = 0;

  const dom = teamNetworkRenderer.domElement;
  dom.style.cursor = 'grab';

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(-2, -2);
  let hoveredNode = null;

  const onPointerDown = (e) => {
    isDragging = true;
    dom.style.cursor = 'grabbing';
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    previousMousePosition = { x: clientX, y: clientY };
  };

  const onPointerMove = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (isDragging) {
      const deltaMove = {
        x: clientX - previousMousePosition.x,
        y: clientY - previousMousePosition.y
      };
      targetRotationY += deltaMove.x * 0.005;
      targetRotationX += deltaMove.y * 0.005;
      previousMousePosition = { x: clientX, y: clientY };
    }

    const rect = dom.getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((y - rect.top) / rect.height) * 2 + 1;
  };

  const onPointerUp = () => {
    isDragging = false;
    dom.style.cursor = 'grab';
  };

  dom.addEventListener('mousedown', onPointerDown);
  dom.addEventListener('mousemove', onPointerMove);
  window.teamNetworkPointerUpHandler = onPointerUp;
  window.addEventListener('mouseup', window.teamNetworkPointerUpHandler);

  dom.addEventListener('touchstart', onPointerDown);
  dom.addEventListener('touchmove', onPointerMove);
  window.teamNetworkTouchEndHandler = onPointerUp;
  window.addEventListener('touchend', window.teamNetworkTouchEndHandler);

  const clock = new THREE.Clock();
  const animate = () => {
    const t = clock.getElapsedTime();

    if (!isDragging) {
      targetRotationY += 0.002;
      targetRotationX = 0.4 + Math.sin(t * 0.25) * 0.03; // tilt constant
    }

    currentRotationY += (targetRotationY - currentRotationY) * 0.05;
    currentRotationX += (targetRotationX - currentRotationX) * 0.05;

    root.rotation.y = currentRotationY;
    root.rotation.x = currentRotationX;

    particlesMesh.rotation.y = t * 0.02;

    // Blinking server lights animation
    if (serverBlinkingLights && serverBlinkingLights.length) {
      serverBlinkingLights.forEach((light, idx) => {
        if (Math.sin(t * 7 + idx) > 0.55) {
          light.material.opacity = 0.95;
        } else {
          light.material.opacity = 0.15;
        }
      });
    }

    // Animate data pulses from Orchestrator (center) to targets
    if (nodePositions.length > 1) {
      pulses.forEach(p => {
        p.progress += 0.006;
        if (p.progress >= 1) {
          p.progress = 0;
        }
        const pSource = nodePositions[p.sourceIdx];
        const pTarget = nodePositions[p.targetIdx];
        p.mesh.position.lerpVectors(pSource, pTarget, p.progress);
      });
    }

    // Scale nodes dynamically and rotate cylinders for a high-tech scanning effect
    nodeGroup.children.forEach((node, index) => {
      if (node.isMesh) {
        node.rotation.y = t * 0.8 + index; // Spin the cylinders
        let baseScale = 1;
        if (node === hoveredNode) {
          baseScale = 1.4;
        }
        const scale = baseScale + Math.sin(t * 2.4 + index) * 0.08;
        node.scale.setScalar(scale);
      }
    });

    // Raycast intersections for highlighting and tooltips
    raycaster.setFromCamera(mouse, teamNetworkCamera);
    const intersects = raycaster.intersectObjects(nodeGroup.children.filter(c => c.isMesh));

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      if (hoveredNode !== hitMesh) {
        if (hoveredNode) {
          hoveredNode.material.color.setHex(hoveredNode.userData.baseColor);
          if (hoveredNode.userData.roomMesh) hoveredNode.userData.roomMesh.material.color.setHex(hoveredNode.userData.baseColor);
          if (hoveredNode.userData.coreMesh) hoveredNode.userData.coreMesh.material.color.setHex(hoveredNode.userData.baseColor);
          if (hoveredNode.userData.holoRingMesh) hoveredNode.userData.holoRingMesh.material.color.setHex(hoveredNode.userData.baseColor);
        }
        hoveredNode = hitMesh;
        hoveredNode.material.color.setHex(0xffffff); // Glow white on hover
        if (hoveredNode.userData.roomMesh) hoveredNode.userData.roomMesh.material.color.setHex(0xffffff);
        if (hoveredNode.userData.coreMesh) hoveredNode.userData.coreMesh.material.color.setHex(0xffffff);
        if (hoveredNode.userData.holoRingMesh) hoveredNode.userData.holoRingMesh.material.color.setHex(0xffffff);
        if (typeof playCommandSound === 'function') {
          playCommandSound('confirm');
        }
      }

      const tempV = new THREE.Vector3();
      hoveredNode.getWorldPosition(tempV);
      tempV.project(teamNetworkCamera);
      
      const rect = dom.getBoundingClientRect();
      const x = (tempV.x * 0.5 + 0.5) * rect.width;
      const y = (tempV.y * -0.5 + 0.5) * rect.height;

      tooltip.innerHTML = `<strong>${esc(hoveredNode.userData.label)}</strong><div style="font-size: 10px; color: var(--cyan); margin-top: 2px;">Office: ${esc(hoveredNode.userData.roomName)}</div><span>Status: ${esc(hoveredNode.userData.status.toUpperCase())}</span>`;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
      tooltip.style.display = 'block';
    } else {
      if (hoveredNode) {
        hoveredNode.material.color.setHex(hoveredNode.userData.baseColor);
        if (hoveredNode.userData.roomMesh) hoveredNode.userData.roomMesh.material.color.setHex(hoveredNode.userData.baseColor);
        if (hoveredNode.userData.coreMesh) hoveredNode.userData.coreMesh.material.color.setHex(hoveredNode.userData.baseColor);
        if (hoveredNode.userData.holoRingMesh) hoveredNode.userData.holoRingMesh.material.color.setHex(hoveredNode.userData.baseColor);
        hoveredNode = null;
        tooltip.style.display = 'none';
      }
    }

    teamNetworkRenderer.render(teamNetworkScene, teamNetworkCamera);
    teamNetworkFrame = requestAnimationFrame(animate);
  };
  animate();

  teamNetworkResizeHandler = () => {
    if (!teamNetworkRenderer || !teamNetworkCamera || !container) return;
    const nextWidth = Math.max(container.clientWidth, 320);
    const nextHeight = Math.max(container.clientHeight, 260);
    teamNetworkCamera.aspect = nextWidth / nextHeight;
    teamNetworkCamera.updateProjectionMatrix();
    teamNetworkCamera.lookAt(0, -10, 0);
    teamNetworkRenderer.setSize(nextWidth, nextHeight);
  };
  window.addEventListener('resize', teamNetworkResizeHandler);
}

function initCockpitMinimap({ roles = [], health = 'healthy' } = {}) {
  const container = document.getElementById('cockpit-mini-map-container');
  const canvas = document.getElementById('cockpit-minimap-canvas');
  if (!container || !canvas || !window.THREE) return;

  if (miniFrame) cancelAnimationFrame(miniFrame);
  if (miniResizeHandler) window.removeEventListener('resize', miniResizeHandler);
  if (miniRenderer) {
    miniRenderer.dispose();
  }

  const THREE = window.THREE;
  const width = container.clientWidth || 154;
  const height = container.clientHeight || 154;

  const statusColors = {
    healthy: 0x00f0ff,
    active: 0x38bdf8,
    warning: 0xffa133,
    critical: 0xff3b5c,
  };

  miniScene = new THREE.Scene();
  miniCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500);
  miniCamera.position.z = 90;

  miniRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  miniRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  miniRenderer.setSize(width, height);

  const root = new THREE.Group();
  miniScene.add(root);

  root.rotation.x = 0.45;

  // Grid globe
  const globeGeometry = new THREE.SphereGeometry(28, 18, 10);
  const globeMaterial = new THREE.MeshBasicMaterial({
    color: statusColors[health] || 0x00f0ff,
    wireframe: true,
    transparent: true,
    opacity: 0.18,
  });
  const globe = new THREE.Mesh(globeGeometry, globeMaterial);
  root.add(globe);

  // Equator ring
  const ringMaterial = new THREE.LineBasicMaterial({
    color: statusColors[health] || 0x00f0ff,
    transparent: true,
    opacity: 0.3,
  });
  const ring = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, 34, 34, 0, Math.PI * 2).getPoints(60)),
    ringMaterial
  );
  ring.rotation.x = Math.PI / 2;
  root.add(ring);

  // Radar sweep plane
  const sweepGeom = new THREE.RingGeometry(0.1, 34, 24, 1, 0, Math.PI * 0.25);
  const sweepMat = new THREE.MeshBasicMaterial({
    color: statusColors[health] || 0x00f0ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending
  });
  const sweep = new THREE.Mesh(sweepGeom, sweepMat);
  sweep.rotation.x = Math.PI / 2;
  root.add(sweep);

  // Position dots
  const agentCount = Math.max(roles.length, 5);
  const dotMeshes = [];
  for (let i = 0; i < agentCount; i++) {
    const role = roles[i] || {};
    const theta = (i / agentCount) * Math.PI * 2;
    const phi = Math.acos(-0.6 + 1.2 * (i + 0.5) / agentCount);
    const r = 28;

    const pos = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );

    const status = role.status || 'healthy';
    const dotMat = new THREE.MeshBasicMaterial({
      color: statusColors[status] || 0x00f0ff,
      transparent: true,
      opacity: 0.9,
    });
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), dotMat);
    dot.position.copy(pos);
    root.add(dot);
    dotMeshes.push({ mesh: dot, index: i });
  }

  const clock = new THREE.Clock();
  const animate = () => {
    miniFrame = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    globe.rotation.y = elapsed * 0.06;
    sweep.rotation.z = -elapsed * 1.1;

    dotMeshes.forEach(d => {
      const scale = 1.0 + Math.sin(elapsed * 4.5 + d.index) * 0.2;
      d.mesh.scale.setScalar(scale);
    });

    miniRenderer.render(miniScene, miniCamera);
  };
  animate();

  miniResizeHandler = () => {
    if (!miniRenderer || !miniCamera || !container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    miniCamera.aspect = w / h;
    miniCamera.updateProjectionMatrix();
    miniRenderer.setSize(w, h);
  };
  window.addEventListener('resize', miniResizeHandler);
}

function renderActiveSessions(data) {
  const summary = `<div class="token-session-summary" style="margin-bottom: 15px;">
    <div><span>Active Sessions</span><strong>${esc(data.count || 0)}</strong></div>
    <div><span>Showing</span><strong>${esc(data.recent?.length || 0)} recent</strong></div>
  </div>`;

  const items = (data.recent || []).map(session => {
    const ageStr = ageLabel(session.age);
    const pct = Math.max(0, Math.min(100, Number(session.percentUsed || 0)));
    const cachePct = session.totalTokens ? Math.round((session.cacheRead / session.totalTokens) * 100) : 0;
    const isCritical = pct > 85;

    return `<article class="active-session-card">
      <div class="session-card-header">
        <div class="session-card-title">
          <strong>${esc(session.key ? session.key.replace(/^agent:/, '') : session.sessionId.slice(0, 12))}</strong>
          <span>Model: ${esc(session.model)}</span>
        </div>
        <span class="pill healthy">${esc(ageStr)}</span>
      </div>
      <div class="session-token-bar ${isCritical ? 'danger' : ''}"><i style="width:${pct}%"></i></div>
      <div class="session-card-grid">
        <div><span>Tokens</span><strong>${compactNumber(session.totalTokens)}</strong></div>
        <div><span>Cache Read</span><strong>${cachePct}%</strong></div>
        <div><span>Remaining</span><strong>${compactNumber(session.remainingTokens || 0)}</strong></div>
        <div><span>Runtime</span><strong>${esc(session.runtime || 'unknown')}</strong></div>
      </div>
      <div class="quota-meta" style="margin-top: 8px; font-size: 9px; color: var(--text-muted); display: flex; justify-content: space-between;">
        <span>ID: ${esc(session.sessionId)}</span>
        <span>Updated: ${new Date(session.updatedAt).toLocaleTimeString()}</span>
      </div>
    </article>`;
  }).join('');

  setHtml('active-sessions', summary + (items || '<p class="muted">No active sessions found.</p>'));

  const hasRecentActiveSession = data.recent && data.recent.some(s => s.age < 120000);
  if (window.dashboardState) {
    window.dashboardState.sessionsActive = hasRecentActiveSession;
  }
  updateProcessingVisuals();
}

function renderActiveTasks(data) {
  const tasks = data.tasks || [];
  const running = tasks.filter(t => t.status === 'running' || t.status === 'queued');
  const finished = tasks.filter(t => t.status !== 'running' && t.status !== 'queued').slice(0, 15);

  const summary = `<div class="jobrun-summary" style="margin-bottom: 15px;">
    <div><span>Background Tasks</span><strong>${esc(data.count || 0)}</strong></div>
    <div><span>Running/Queued</span><strong class="${running.length ? 'text-cyan' : ''}">${esc(running.length)}</strong></div>
  </div>`;

  let html = summary;

  if (running.length > 0) {
    html += `<h3 style="margin: 15px 0 10px; font-family: 'Orbitron', sans-serif; font-size: 11px; text-transform: uppercase; color: var(--cyan);">Running / Queued Tasks</h3>`;
    html += running.map(t => {
      const taskStatusClass = t.status === 'running' ? 'healthy' : 'warning';
      return `<article class="active-task-card" style="border-left: 3px solid var(--cyan); background: rgba(0, 240, 255, 0.02);">
        <div class="task-card-header">
          <div class="task-card-title">
            <strong>${esc(t.label || t.task)}</strong>
            <span>ID: ${esc(t.taskId)} · Kind: ${esc(t.runtime)}</span>
          </div>
          <span class="pill ${taskStatusClass}">${esc(t.status.toUpperCase())}</span>
        </div>
        <div class="task-card-grid">
          <div><span>Started</span><strong>${new Date(t.startedAt || t.createdAt).toLocaleTimeString()}</strong></div>
          <div><span>Progress</span><strong title="${esc(t.progressSummary || 'none')}">${esc(t.progressSummary || 'none')}</strong></div>
        </div>
      </article>`;
    }).join('');
  }

  html += `<h3 style="margin: 20px 0 10px; font-family: 'Orbitron', sans-serif; font-size: 11px; text-transform: uppercase; color: var(--cyan);">Recent Background Tasks</h3>`;
  html += finished.map(t => {
    const isSuccess = t.status === 'succeeded' || t.status === 'completed';
    const taskStatusClass = isSuccess ? 'healthy' : t.status === 'failed' ? 'critical' : 'warning';
    const duration = t.endedAt && t.startedAt ? Math.round((t.endedAt - t.startedAt) / 1000) + 's' : '';

    return `<article class="active-task-card">
      <div class="task-card-header">
        <div class="task-card-title">
          <strong>${esc(t.label || t.task)}</strong>
          <span>ID: ${esc(t.taskId)} · Kind: ${esc(t.runtime)}</span>
        </div>
        <span class="pill ${taskStatusClass}">${esc(t.status)}</span>
      </div>
      <div class="task-card-grid">
        <div><span>Time</span><strong>${new Date(t.endedAt || t.startedAt || t.createdAt).toLocaleString()}</strong></div>
        <div><span>Duration</span><strong>${esc(duration || 'unknown')}</strong></div>
      </div>
      ${t.terminalSummary ? `<div class="task-terminal-summary">${esc(t.terminalSummary)}</div>` : ''}
    </article>`;
  }).join('') || '<p class="muted">No recent tasks found.</p>';

  setHtml('active-tasks', html);

  const isRunning = running.length > 0;
  if (window.dashboardState) {
    window.dashboardState.tasksRunning = isRunning;
  }
  updateProcessingVisuals();
}

function renderCommands(data) {
  const sections = data.sections || [];
  const total = sections.reduce((sum, section) => sum + (section.commands || []).length, 0);
  const summary = '<div class="command-summary">'
    + '<div><span>Sections</span><strong>' + esc(sections.length) + '</strong></div>'
    + '<div><span>Commands</span><strong>' + esc(total) + '</strong></div>'
    + '<div><span>Source</span><strong>Local JSON</strong></div>'
    + '</div>';
  const body = sections.map(section => {
    const color = section.color || '#00f0ff';
    const cards = (section.commands || []).map(command => {
      const danger = command.danger ? ' danger' : '';
      const tags = (command.tags || []).map(tag => '<span>' + esc(tag) + '</span>').join('');
      return '<article class="command-card' + danger + '" style="--cmd-color:' + esc(color) + '">'
        + '<div class="command-card-head"><div><strong>' + esc(command.title) + '</strong><span>' + esc(command.description || '') + '</span></div>' + (command.danger ? '<b class="danger-badge">Danger</b>' : '') + '</div>'
        + '<div class="command-copy-row"><code>' + esc(command.command) + '</code><button type="button" class="command-copy-btn" data-command="' + esc(command.command) + '" title="Copy command">Copy</button></div>'
        + '<div class="command-tags">' + tags + '</div>'
        + '</article>';
    }).join('');
    return '<section class="command-section"><div class="command-section-head"><span style="background:' + esc(color) + '"></span><h3>' + esc(section.title) + '</h3><small>' + esc((section.commands || []).length) + ' commands</small></div><div class="command-grid">' + cards + '</div></section>';
  }).join('');
  setHtml('command-cheatsheet', summary + (body || '<p class="muted">No commands configured.</p>'));
}

function bindCommandCopyButtons() {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('.command-copy-btn');
    if (!button) return;
    const command = button.dataset.command || '';
    try {
      await navigator.clipboard.writeText(command);
      button.textContent = 'Copied';
      button.classList.add('copied');
      playCommandSound('confirm');
      if (typeof window.appendConsoleLog === 'function') {
        window.appendConsoleLog('Command copied from cheatsheet.');
      }
      setTimeout(() => {
        button.textContent = 'Copy';
        button.classList.remove('copied');
      }, 1200);
    } catch (e) {
      playCommandSound('error');
      button.textContent = 'Copy failed';
      setTimeout(() => { button.textContent = 'Copy'; }, 1200);
    }
  });
}

function renderPlatform(platform) {
  setHtml('platform-docs', (platform.docs || []).map(doc => `<article class="platform-doc"><h3>${esc(doc.title)}</h3><p>${esc((doc.text || '').split('\n').filter(Boolean).slice(0, 4).join(' '))}</p><details><summary>Read full document</summary><pre>${esc(doc.text || '')}</pre></details></article>`).join(''));
}

let archScene = null;
let archRenderer = null;
let archCamera = null;
let archFrame = null;
let archResizeHandler = null;

function renderArchitecture(data) {
  const container = $('architecture-network');
  if (!container || !window.THREE) return;

  if (archFrame) cancelAnimationFrame(archFrame);
  if (archResizeHandler) window.removeEventListener('resize', archResizeHandler);
  if (window.archPointerUpHandler) {
    window.removeEventListener('mouseup', window.archPointerUpHandler);
    window.removeEventListener('touchend', window.archTouchEndHandler);
  }
  if (archRenderer) {
    archRenderer.dispose();
    archRenderer.domElement?.remove();
  }

  container.innerHTML = '';
  const THREE = window.THREE;
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 550;

  const style = getComputedStyle(document.body);
  const cyan = style.getPropertyValue('--cyan').trim() || '#00f0ff';
  const purple = style.getPropertyValue('--purple-ai').trim() || '#a78bfa';
  const emerald = style.getPropertyValue('--emerald').trim() || '#34d399';
  const orange = '#fb923c';

  const typeColors = {
    file: 0x00f0ff,
    function: 0xa78bfa,
    class: 0x34d399,
    import: 0xfb923c
  };

  archScene = new THREE.Scene();
  archCamera = new THREE.PerspectiveCamera(52, width / height, 0.1, 2000);
  archCamera.position.set(0, 0, 320);

  archRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  archRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  archRenderer.setSize(width, height);
  container.appendChild(archRenderer.domElement);

  const root = new THREE.Group();
  archScene.add(root);

  const nodes = data.nodes || [];
  const edges = data.edges || [];

  const fileNodes = nodes.filter(n => n.type === 'file');
  const nonFileNodes = nodes.filter(n => n.type !== 'file');

  const nodePosMap = {};
  const nodeMeshes = [];

  const fileCount = fileNodes.length;
  fileNodes.forEach((node, index) => {
    const phi = Math.acos(-1 + (2 * (index + 0.5)) / (fileCount || 1));
    const theta = Math.sqrt((fileCount || 1) * Math.PI) * phi;
    const r = 90;
    const pos = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
    nodePosMap[node.id] = pos;
  });

  nonFileNodes.forEach(node => {
    const parentFile = fileNodes.find(fn => fn.id === node.source_file || (node.source_file && node.source_file.endsWith(fn.id)));
    let parentPos = null;
    if (parentFile) parentPos = nodePosMap[parentFile.id];

    if (parentPos) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 25 + Math.random() * 12;
      nodePosMap[node.id] = new THREE.Vector3(
        parentPos.x + r * Math.sin(phi) * Math.cos(theta),
        parentPos.y + r * Math.sin(phi) * Math.sin(theta),
        parentPos.z + r * Math.cos(phi)
      );
    } else {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 50 + Math.random() * 60;
      nodePosMap[node.id] = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
  });

  nodes.forEach(node => {
    const pos = nodePosMap[node.id];
    if (!pos) return;

    const color = typeColors[node.type] || 0x94a3b8;
    const size = node.type === 'file' ? 4.5 : 2.5;

    const nodeMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 16), nodeMat);
    mesh.position.copy(pos);
    mesh.userData = {
      id: node.id,
      label: node.label || node.id,
      type: node.type,
      file: node.source_file || '',
      location: node.source_location || '',
      baseColor: color
    };
    root.add(mesh);
    nodeMeshes.push(mesh);
  });

  const linePositions = [];
  edges.forEach(edge => {
    const a = nodePosMap[edge.source];
    const b = nodePosMap[edge.target];
    if (a && b) {
      linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  });

  const links = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3)),
    new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
    })
  );
  root.add(links);

  const pulses = [];
  const pulseGeometry = new THREE.SphereGeometry(0.8, 8, 8);
  const pulseMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
  });

  const validEdges = edges.filter(edge => nodePosMap[edge.source] && nodePosMap[edge.target]);
  if (validEdges.length > 0) {
    const pulseCount = Math.min(validEdges.length, 25);
    for (let i = 0; i < pulseCount; i++) {
      const mesh = new THREE.Mesh(pulseGeometry, pulseMaterial);
      root.add(mesh);
      const edge = validEdges[Math.floor(Math.random() * validEdges.length)];
      pulses.push({
        mesh,
        source: nodePosMap[edge.source],
        target: nodePosMap[edge.target],
        progress: Math.random(),
        validEdges
      });
    }
  }

  let tooltip = container.querySelector('.cockpit-network-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'cockpit-network-tooltip';
    container.appendChild(tooltip);
  }

  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let targetRotationX = 0;
  let targetRotationY = 0;
  let currentRotationX = 0;
  let currentRotationY = 0;

  const dom = archRenderer.domElement;
  dom.style.cursor = 'grab';

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(-2, -2);
  let hoveredNode = null;

  const onPointerDown = (e) => {
    isDragging = true;
    dom.style.cursor = 'grabbing';
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    previousMousePosition = { x: clientX, y: clientY };
  };

  const onPointerMove = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (isDragging) {
      const deltaMove = {
        x: clientX - previousMousePosition.x,
        y: clientY - previousMousePosition.y
      };
      targetRotationY += deltaMove.x * 0.003;
      targetRotationX += deltaMove.y * 0.003;
      previousMousePosition = { x: clientX, y: clientY };
    }

    const rect = dom.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  };

  const onPointerUp = () => {
    isDragging = false;
    dom.style.cursor = 'grab';
  };

  const onWheel = (e) => {
    e.preventDefault();
    archCamera.position.z += e.deltaY * 0.25;
    archCamera.position.z = Math.max(100, Math.min(archCamera.position.z, 600));
  };

  dom.addEventListener('mousedown', onPointerDown);
  dom.addEventListener('mousemove', onPointerMove);
  window.archPointerUpHandler = onPointerUp;
  window.addEventListener('mouseup', window.archPointerUpHandler);

  dom.addEventListener('touchstart', onPointerDown, { passive: true });
  dom.addEventListener('touchmove', onPointerMove, { passive: true });
  window.archTouchEndHandler = onPointerUp;
  window.addEventListener('touchend', window.archTouchEndHandler);
  dom.addEventListener('wheel', onWheel, { passive: false });

  const clock = new THREE.Clock();
  const animate = () => {
    archFrame = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (!isDragging) {
      targetRotationY += 0.0015;
      targetRotationX = Math.sin(t * 0.2) * 0.05;
    }

    currentRotationY += (targetRotationY - currentRotationY) * 0.05;
    currentRotationX += (targetRotationX - currentRotationX) * 0.05;

    root.rotation.y = currentRotationY;
    root.rotation.x = currentRotationX;

    pulses.forEach(p => {
      p.progress += 0.004;
      if (p.progress >= 1) {
        p.progress = 0;
        const edge = p.validEdges[Math.floor(Math.random() * p.validEdges.length)];
        p.source = nodePosMap[edge.source];
        p.target = nodePosMap[edge.target];
      }
      if (p.source && p.target) {
        p.mesh.position.lerpVectors(p.source, p.target, p.progress);
      }
    });

    nodeMeshes.forEach((node, index) => {
      let baseScale = 1;
      if (node === hoveredNode) {
        baseScale = 1.5;
      }
      const scale = baseScale + Math.sin(t * 2 + index) * 0.1;
      node.scale.setScalar(scale);
    });

    raycaster.setFromCamera(mouse, archCamera);
    const intersects = raycaster.intersectObjects(nodeMeshes);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      if (hoveredNode !== hitMesh) {
        if (hoveredNode) {
          hoveredNode.material.color.setHex(hoveredNode.userData.baseColor);
        }
        hoveredNode = hitMesh;
        hoveredNode.material.color.setHex(0xffffff);
        if (typeof playCommandSound === 'function') {
          playCommandSound('confirm');
        }
      }

      const tempV = new THREE.Vector3();
      hoveredNode.getWorldPosition(tempV);
      tempV.project(archCamera);

      const rect = dom.getBoundingClientRect();
      const left = ((tempV.x + 1) * rect.width) / 2;
      const top = ((-tempV.y + 1) * rect.height) / 2;

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.display = 'block';
      tooltip.innerHTML = `
        <strong>${esc(hoveredNode.userData.label)}</strong>
        <span>Type: ${esc(hoveredNode.userData.type)}</span>
        <span>Location: ${esc(hoveredNode.userData.file.split('/').pop())}${hoveredNode.userData.location ? ':' + hoveredNode.userData.location : ''}</span>
      `;
    } else {
      if (hoveredNode) {
        hoveredNode.material.color.setHex(hoveredNode.userData.baseColor);
        hoveredNode = null;
      }
      tooltip.style.display = 'none';
    }

    archRenderer.render(archScene, archCamera);
  };
  animate();

  archResizeHandler = () => {
    if (!archRenderer || !archCamera || !container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    archCamera.aspect = w / h;
    archCamera.updateProjectionMatrix();
    archRenderer.setSize(w, h);
  };
  window.addEventListener('resize', archResizeHandler);
}

window.redrawArchitecture = function() {
  if (archResizeHandler) {
    archResizeHandler();
  }
};

async function loadDetails(force = false) {
  const suffix = force ? '?refresh=1' : '';
  const jobs = [
    ['/api/codex-quota' + suffix, renderCodexQuota, 'codex-quota'],
    ['/api/gemma-quota' + suffix, renderGemmaQuota, 'gemma-quota'],
    ['/api/groq-quota' + suffix, renderGroqQuota, 'groq-quota'],
    ['/api/minimax-quota' + suffix, renderMinimaxQuota, 'minimax-quota'],
    ['/api/token-sessions' + suffix, renderTokenSessions, 'token-sessions'],
    ['/api/context-budget' + suffix, renderContextBudget, 'context-budget'],
    ['/api/telegram-health' + suffix, renderTelegramHealth, 'telegram-health'],
    ['/api/grafana-mcp' + suffix, renderGrafana, 'grafana-mcp'],
    ['/api/web-inventory' + suffix, renderWeb, 'web-inventory'],
    ['/api/alert-routes' + suffix, renderAlerts, 'alert-routes'],
    ['/api/incidents' + suffix, renderIncidents, 'incident-radar'],
    ['/api/workflows' + suffix, renderWorkflows, 'workflow-health'],
    ['/api/ops-ledger' + suffix, renderOpsLedger, 'ops-ledger'],
    ['/api/alert-quality' + suffix, renderAlertQuality, 'alert-quality'],
    ['/api/life-command' + suffix, renderLifeCommand, 'life-command'],
    ['/api/job-runs' + suffix, renderJobRuns, 'job-runs'],
    ['/data/commands.json', renderCommands, 'command-cheatsheet'],
    ['/api/platform-docs' + suffix, renderPlatform, 'platform-docs'],
    ['/api/architecture' + suffix, renderArchitecture, 'architecture-network'],
    ['/api/team-control' + suffix, renderTeamControl, 'team-control-room'],
    ['/api/active-work' + suffix, renderActiveWork, 'active-work'],
    ['/api/skill-registry' + suffix, renderSkillRegistry, 'skill-registry'],
    ['/api/agents' + suffix, renderAgents, 'configured-agents'],
    ['/api/active-sessions' + suffix, renderActiveSessions, 'active-sessions'],
    ['/api/active-tasks' + suffix, renderActiveTasks, 'active-tasks'],
  ];
  await Promise.all(jobs.map(async ([url, render, id]) => {
    try { render(await getJson(url)); }
    catch (e) { setHtml(id, `<p class="detail">Load failed: ${esc(e.message)}</p>`); }
  }));
}

async function loadHarness(force = false) {
  try { renderHarness(await getJson('/api/harness' + (force ? '?refresh=1' : ''))); }
  catch (e) { renderHarness({ overall: 'unknown', error: 'Harness load failed: ' + e.message, checks: [] }); }
}

// WebGL Three.js 3D Neural Sphere setup
let scene, camera, renderer, particles, particleCount = 1600;
let mouseX = 0, mouseY = 0;
let targetRotationX = 0, targetRotationY = 0;
let isDragging = false, previousMousePosition = { x: 0, y: 0 };
let speedMultiplier = 1;
let colorTheme = '#00f0ff';
let isSimulating = false;

function initNova3D() {
  const container = document.getElementById('nova-3d-canvas-container');
  if (!container || !window.THREE) return;

  container.innerHTML = '';

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.z = 160;

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  update3DColor();

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const originalPositions = new Float32Array(particleCount * 3);

  const r = 72; // sphere radius
  for (let i = 0; i < particleCount; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    originalPositions[i * 3] = x;
    originalPositions[i * 3 + 1] = y;
    originalPositions[i * 3 + 2] = z;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('originalPosition', new THREE.BufferAttribute(originalPositions, 3));

  const material = new THREE.PointsMaterial({
    color: new THREE.Color(colorTheme),
    size: 2.2,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // Add wireframe lines connecting points
  const lineCount = 240;
  const lineGeometry = new THREE.BufferGeometry();
  const linePositions = new Float32Array(lineCount * 2 * 3);

  const posArr = geometry.attributes.position.array;
  let idx = 0;
  for (let i = 0; i < lineCount; i++) {
    const p1Idx = Math.floor(Math.random() * particleCount);
    const p2Idx = Math.floor(Math.random() * particleCount);

    linePositions[idx++] = posArr[p1Idx * 3];
    linePositions[idx++] = posArr[p1Idx * 3 + 1];
    linePositions[idx++] = posArr[p1Idx * 3 + 2];

    linePositions[idx++] = posArr[p2Idx * 3];
    linePositions[idx++] = posArr[p2Idx * 3 + 1];
    linePositions[idx++] = posArr[p2Idx * 3 + 2];
  }

  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(colorTheme),
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  particles.add(lines);

  // Interaction events
  const dom = renderer.domElement;
  dom.addEventListener('mousedown', onPointerDown);
  dom.addEventListener('touchstart', onPointerDown, { passive: true });
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('touchmove', onPointerMove, { passive: true });
  window.addEventListener('mouseup', onPointerUp);
  window.addEventListener('touchend', onPointerUp);

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();
    const isFocusMode = document.body.classList.contains('focus-mode');

    if (!isDragging) {
      const speedCoeff = isFocusMode ? 0.05 : 1.0;
      particles.rotation.y += 0.004 * speedMultiplier * speedCoeff;
      particles.rotation.x += 0.001 * speedMultiplier * speedCoeff;
    } else {
      particles.rotation.x += (targetRotationX - particles.rotation.x) * 0.1;
      particles.rotation.y += (targetRotationY - particles.rotation.y) * 0.1;
    }

    const isProcessing = window.dashboardState && window.dashboardState.isAgentRunning;
    const baseAmp = soundState.speaking ? 11.0 : (isProcessing ? 7.5 : (isFocusMode ? 0.25 : 3.0));
    const baseFreq = soundState.speaking ? 4.5 : (isProcessing ? 3.2 : (isFocusMode ? 0.4 : 1.8));
    speedMultiplier = soundState.speaking ? 3.5 : (isProcessing ? 2.5 : 1.0);

    if (isProcessing) {
      const tGlow = (Math.sin(elapsedTime * 3) + 1) / 2;
      const purpleColor = new THREE.Color('#d946ef');
      const pulseColor = new THREE.Color(colorTheme).clone().lerp(purpleColor, 0.7 + 0.3 * tGlow);
      if (particles && particles.material) {
        particles.material.color.copy(pulseColor);
      }
      if (particles && particles.children[0] && particles.children[0].material) {
        particles.children[0].material.color.copy(pulseColor);
      }
    } else {
      const defaultColor = new THREE.Color(colorTheme);
      if (particles && particles.material && !particles.material.color.equals(defaultColor)) {
        particles.material.color.copy(defaultColor);
      }
      if (particles && particles.children[0] && particles.children[0].material && !particles.children[0].material.color.equals(defaultColor)) {
        particles.children[0].material.color.copy(defaultColor);
      }
    }

    const pos = geometry.attributes.position.array;
    const orig = geometry.attributes.originalPosition.array;

    for (let i = 0; i < particleCount; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      const ox = orig[ix];
      const oy = orig[iy];
      const oz = orig[iz];

      const dist = Math.sqrt(ox*ox + oy*oy + oz*oz);
      const angle = (ox + oy + oz) * baseFreq * 0.015 + elapsedTime * 2.2;
      const offset = Math.sin(angle) * baseAmp;

      const scale = 1 + offset / dist;
      pos[ix] = ox * scale;
      pos[iy] = oy * scale;
      pos[iz] = oz * scale;
    }

    geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', () => {
    if (!renderer || !camera || !container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

function onPointerDown(e) {
  isDragging = true;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  previousMousePosition = { x: clientX, y: clientY };
  targetRotationX = particles.rotation.x;
  targetRotationY = particles.rotation.y;
}

function onPointerMove(e) {
  if (!isDragging || !particles) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const deltaX = clientX - previousMousePosition.x;
  const deltaY = clientY - previousMousePosition.y;

  targetRotationY += deltaX * 0.005;
  targetRotationX += deltaY * 0.005;

  previousMousePosition = { x: clientX, y: clientY };
}

function onPointerUp() {
  isDragging = false;
}

function update3DColor() {
  const style = getComputedStyle(document.body);
  colorTheme = style.getPropertyValue('--cyan').trim() || '#00f0ff';

  if (particles && particles.material) {
    particles.material.color.set(colorTheme);
  }
  if (particles && particles.children[0] && particles.children[0].material) {
    particles.children[0].material.color.set(colorTheme);
  }
}
window.update3DColor = update3DColor; // Expose globally for index.html click events

function updateHoloDiagnostics(overallStatus = 'healthy') {
  const statusValEl = document.querySelector('.hud-right .hud-data-row:nth-child(1) .hud-val');
  if (statusValEl) {
    if (overallStatus === 'healthy') {
      statusValEl.textContent = 'ONLINE';
      statusValEl.className = 'hud-val text-green';
    } else if (overallStatus === 'warning') {
      statusValEl.textContent = 'WARN';
      statusValEl.className = 'hud-val text-amber';
    } else {
      statusValEl.textContent = 'ALERT';
      statusValEl.className = 'hud-val text-rose';
    }
  }
}

async function load(force = false) {
  $('refresh').disabled = true;
  if (force && typeof window.appendConsoleLog === 'function') {
    window.appendConsoleLog('Manual telemetry synchronization dispatched...');
  }
  try {
    const d = await getJson('/api/status' + (force ? '?refresh=1' : ''));
    renderFastStatus(d);

    // Play confirmation chirp on successful telemetry load
    playCommandSound('confirm');

    // Update HUD status indicator
    updateHoloDiagnostics(d.overall);

    // Keep 3D color synced
    update3DColor();

    // Log success to console
    if (typeof window.appendConsoleLog === 'function') {
      const okServices = d.services.filter(s => s.status === 'healthy').length;
      window.appendConsoleLog(`Telemetry synchronized. Services: ${okServices}/${d.services.length} online. Overall: [${d.overall.toUpperCase()}]`);
      if (d.overall !== 'healthy') {
        window.appendConsoleLog(`[WARNING] Posture alert: System report is ${d.overall.toUpperCase()}`);
      }
    }

    requestAnimationFrame(() => {
      loadDetails(force);
      loadHarness(force);
    });
  } catch (e) {
    playCommandSound('error');
    $('overall').textContent = 'Dashboard telemetry failed';
    $('overall-dot').className = 'dot critical';
    setHtml('services', `<p class="detail">Status load failed: ${esc(e.message)}</p>`);
    if (typeof window.appendConsoleLog === 'function') {
      window.appendConsoleLog(`[CRITICAL] Telemetry sync failed: ${e.message}`);
    }
  } finally {
    $('refresh').disabled = false;
  }
}

async function loadMemory() {
  try {
    const data = await getJson('/api/memory');
    const select = $('memory-date-select');
    if (!select) return;

    const currentSelected = select.value;
    select.innerHTML = (data.files || []).map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');

    if (currentSelected && (data.files || []).includes(currentSelected)) {
      select.value = currentSelected;
      await loadMemoryFile(currentSelected);
    } else if (data.latest) {
      select.value = data.latest;
      setHtml('memory-content-area', formatMarkdown(data.latestContent || ''));
    } else {
      setHtml('memory-content-area', '<p class="muted">No daily note memory archives found.</p>');
    }
  } catch (e) {
    setHtml('memory-content-area', `<p class="detail">Failed to load daily memory: ${esc(e.message)}</p>`);
  }
}

async function loadMemoryFile(date) {
  try {
    const data = await getJson(`/api/memory?date=${encodeURIComponent(date)}`);
    setHtml('memory-content-area', formatMarkdown(data.content || ''));
  } catch (e) {
    setHtml('memory-content-area', `<p class="detail">Failed to load daily note: ${esc(e.message)}</p>`);
  }
}

function formatMarkdown(text) {
  if (!text) return '';
  let html = esc(text);

  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');

  return html;
}

async function triggerSummary() {
  const btn = $('trigger-summary-btn');
  const status = $('trigger-summary-status');
  if (!btn || !status) return;

  btn.disabled = true;
  status.textContent = 'Running summarizer script...';
  status.className = 'status-msg warning';
  playCommandSound('tap');

  try {
    const res = await fetch(apiUrl('/api/trigger-summary'));
    const data = await res.json();
    if (data.ok) {
      status.textContent = 'Turn summarized successfully! Telegram and daily note updated.';
      status.className = 'status-msg healthy';
      playCommandSound('confirm');
      if (typeof window.appendConsoleLog === 'function') {
        window.appendConsoleLog('Manual turn summarization triggered successfully.');
      }
      await loadMemory();
    } else {
      status.textContent = 'Failed: ' + (data.output || 'Unknown error');
      status.className = 'status-msg critical';
      playCommandSound('error');
    }
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
    status.className = 'status-msg critical';
    playCommandSound('error');
  } finally {
    btn.disabled = false;
  }
}

function init() {
  ['codex-quota', 'gemma-quota', 'groq-quota', 'minimax-quota', 'token-sessions', 'context-budget', 'telegram-health', 'grafana-mcp', 'web-inventory', 'alert-routes', 'incident-radar', 'workflow-health', 'ops-ledger', 'alert-quality', 'life-command', 'job-runs', 'command-cheatsheet', 'platform-docs', 'architecture-network', 'team-control-room', 'active-work', 'configured-agents', 'active-sessions', 'active-tasks'].forEach(id => setHtml(id, skeleton(2)));
  renderHarness({ overall: 'loading', deferred: true, checks: [] });
  if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = getPreferredVoice;
  $('sound-toggle')?.addEventListener('click', playIntroVoice);
  $('sim-toggle')?.addEventListener('click', () => {
    isSimulating = !isSimulating;
    const btn = $('sim-toggle');
    if (btn) {
      btn.classList.toggle('active', isSimulating);
      btn.querySelector('span').textContent = isSimulating ? 'Simulating' : 'Simulate Run';
    }
    playCommandSound('confirm');
    if (typeof window.appendConsoleLog === 'function') {
      window.appendConsoleLog(`Simulate Run mode: ${isSimulating ? 'ACTIVE' : 'INACTIVE'}`);
    }

    updateProcessingVisuals();
  });
  bindCommandCopyButtons();
  $('refresh').addEventListener('click', () => {
    playCommandSound('tap');
    load(true);
  });

  // Bind memory tab interactive elements
  $('memory-date-select')?.addEventListener('change', (e) => {
    playCommandSound('tap');
    loadMemoryFile(e.target.value);
  });
  $('trigger-summary-btn')?.addEventListener('click', triggerSummary);

  load();
  loadMemory();
  setInterval(() => {
    load(false);
    loadMemory();
  }, 30000);

  // Initialize WebGL 3D Particle Sphere
  setTimeout(initNova3D, 800);

}

init();
