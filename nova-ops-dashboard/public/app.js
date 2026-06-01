const $ = id => document.getElementById(id);
window.dashboardState = {
  isAgentRunning: false
};
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

async function getJson(url) {
  const res = await fetch(url);
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
    const ports = (item.ports || []).map(p => p.port + ': ' + (p.active ? 'on' : 'off')).join(' · ');
    const links = [...(item.publicUrls || []), ...(item.localUrls || [])].map(u => '<code>' + esc(u) + '</code>').join('');
    const statusPill = pill(item.status).replace(label(item.status), esc(item.statusLabel || label(item.status)));
    return '<article class="web-item"><div class="web-main"><span class="dot ' + esc(item.status) + '"></span><div><div class="web-title"><strong>' + esc(item.name) + '</strong>' + statusPill + '</div><p>' + esc(item.purpose) + '</p></div></div><div class="web-meta"><span>' + esc(item.exposure) + '</span><span>' + esc(item.owner) + '</span><span>' + esc(ports) + '</span></div><div class="web-links">' + links + '</div><div class="detail">' + esc(item.note) + '</div></article>';
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

function renderQuotaWindow(title, window) {
  if (!window || window.usedPercent == null) {
    return '<div class="quota-window unknown"><div><span>' + esc(title) + '</span><strong>Unavailable</strong></div><p>Realtime usage not returned</p></div>';
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
    return '<article class="quota-item">'
      + '<div class="quota-head"><div><strong>' + esc(item.email) + '</strong><span>' + esc(item.accountId) + '</span></div>' + statusPill + '</div>'
      + '<div class="quota-limit"><span>Realtime quota usage limit</span><strong>' + esc(item.limitLabel || 'Unavailable') + '</strong><em>Updated ' + esc(realtimeAt) + '</em></div>'
      + '<div class="quota-windows">'
      + renderQuotaWindow('5 hour usage limit', realtime.primary)
      + renderQuotaWindow('Weekly usage limit', realtime.secondary)
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

function renderTeamControl(data) {
  const summary = data.summary || {};
  const healthClass = data.health === 'critical' ? 'critical' : data.health === 'warning' ? 'warning' : 'healthy';
  const runningTasks = data.live?.runningTasks || [];
  const failedTasks = data.live?.failedTasks || [];
  const sessions = data.live?.sessions || [];
  const reports = data.reports || [];
  const roles = data.roles || [];
  const roster = data.roster || [];
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

  const reportsHtml = reports.slice(0, 5).map(report => `
    <article class="jobrun-item">
      <div class="jobrun-head">
        <div><strong>${esc(report.taskId)}</strong><span>${esc(report.summary || report.path)}</span></div>
        <span class="pill ${report.passed ? 'healthy' : 'critical'}">${report.passed ? 'PASSED' : 'NEEDS WORK'}</span>
      </div>
      <div class="jobrun-meta">
        <span>${esc(new Date(report.generatedAt).toLocaleString())}</span>
        <span>Findings: ${esc(report.findings || 0)}</span>
        <span>${esc(report.path)}</span>
      </div>
    </article>
  `).join('');

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

      <div class="cockpit-hero-grid">
        <section class="cockpit-network-panel">
          <div class="cockpit-panel-header">
            <span>Holographic Network Map</span>
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

      <div class="cockpit-analytics-grid">
        <section class="cockpit-module">
          <h3>Global Network</h3>
          <div class="cockpit-mini-map" id="cockpit-mini-map-container">
            <canvas id="cockpit-minimap-canvas" style="width: 100%; height: 100%; display: block;"></canvas>
          </div>
        </section>
        <section class="cockpit-module">
          <h3>Active Instances</h3>
          <div class="cockpit-bars">${uptimeBars || '<p class="muted">No role telemetry.</p>'}</div>
        </section>
        <section class="cockpit-module">
          <h3>Performance Analytics</h3>
          <svg class="cockpit-line-chart" viewBox="0 0 100 100" role="img" aria-label="Agent performance trend">
            <defs>
              <linearGradient id="chart-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#00f0ff"/>
                <stop offset="50%" stop-color="#8b5cf6"/>
                <stop offset="100%" stop-color="#d946ef"/>
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

      <div class="team-control-grid cockpit-lower-grid">
        <section>
          <h3>Agent Status Overview</h3>
          <div class="team-roles">${rolesHtml || '<p class="muted">No roles surfaced.</p>'}</div>
        </section>
        <section>
          <h3>Routing Rules</h3>
          <ul class="team-rules">${routingHtml}</ul>
          <h3>Playbook Coverage</h3>
          <div class="team-playbooks">${playbookHtml}</div>
          <h3>Next Build Steps</h3>
          <ul class="team-rules">${nextHtml}</ul>
        </section>
      </div>
      <div class="team-control-grid cockpit-lower-grid">
        <section>
          <h3>Running Work</h3>
          ${runningHtml || '<p class="muted">No running routed work right now.</p>'}
        </section>
        <section>
          <h3>Recent Verification</h3>
          ${reportsHtml || '<p class="muted">No verification reports found.</p>'}
        </section>
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

  async function executeVerification() {
    appendTerminalLine('Executing task verification gate...', 'loading');
    try {
      const res = await fetch('/api/run-verification');
      const resData = await res.json();
      if (resData.ok) {
        appendTerminalLine(`Verification Passed: ${resData.taskId}`, 'success');
        appendTerminalLine(`Report: outputs/verification/${resData.taskId}.json`, 'muted');
        // Force reload dashboard telemetry to show new report card immediately
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
          appendTerminalLine('  logs     - Show recent watchdog log entries', 'muted');
          appendTerminalLine('  clear    - Clear console logs', 'muted');
        } else if (cmd === 'clear') {
          termLog.innerHTML = '';
        } else if (cmd === 'status') {
          appendTerminalLine('Probing gateway telemetry...', 'loading');
          try {
            const res = await fetch('/api/status');
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
            const res = await fetch('/api/status');
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

  // Bind command bar buttons
  const btnVerify = document.getElementById('cockpit-btn-verify');
  const btnLogs = document.getElementById('cockpit-btn-logs');
  const btnDeploy = document.getElementById('cockpit-btn-deploy');

  if (btnVerify) {
    btnVerify.addEventListener('click', async () => {
      termInput?.focus();
      appendTerminalLine('> verify', 'command');
      await executeVerification();
    });
  }

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
  teamNetworkCamera = new THREE.PerspectiveCamera(52, width / height, 0.1, 1000);
  teamNetworkCamera.position.set(0, 0, 150);

  teamNetworkRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  teamNetworkRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  teamNetworkRenderer.setSize(width, height);
  container.appendChild(teamNetworkRenderer.domElement);

  const root = new THREE.Group();
  teamNetworkScene.add(root);

  const globeGeometry = new THREE.SphereGeometry(48, 48, 24);
  const globeMaterial = new THREE.MeshBasicMaterial({
    color: statusColors[health] || statusColors.healthy,
    wireframe: true,
    transparent: true,
    opacity: 0.16,
  });
  root.add(new THREE.Mesh(globeGeometry, globeMaterial));

  const ringMaterial = new THREE.LineBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
  });
  [0, Math.PI / 2, Math.PI / 3].forEach((rotation, index) => {
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, 62 + index * 7, 62 + index * 7, 0, Math.PI * 2).getPoints(160)),
      ringMaterial
    );
    ring.rotation.x = rotation;
    ring.rotation.y = index * 0.35;
    root.add(ring);
  });

  const nodeGroup = new THREE.Group();
  root.add(nodeGroup);
  const nodePositions = [];
  const nodeCount = Math.max(rolesForNodes.length, 6);
  for (let i = 0; i < nodeCount; i += 1) {
    const role = rolesForNodes[i % Math.max(rolesForNodes.length, 1)] || {};
    const theta = (i / nodeCount) * Math.PI * 2;
    const phi = Math.acos(-0.72 + (1.44 * (i + 0.5)) / nodeCount);
    const radius = 58;
    const position = new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
    nodePositions.push(position);
    const status = failedTasks.length && i === 0 ? 'warning' : runningTasks.length && i === 1 ? 'active' : role.status || 'healthy';
    const nodeMaterial = new THREE.MeshBasicMaterial({
      color: statusColors[status] || statusColors.healthy,
      transparent: true,
      opacity: 0.94,
    });
    const node = new THREE.Mesh(new THREE.SphereGeometry(status === 'warning' ? 3.2 : 2.4, 18, 18), nodeMaterial);
    node.position.copy(position);
    node.userData = { label: role.name || role.id || `Agent ${i + 1}`, status };
    nodeGroup.add(node);
  }

  const linePositions = [];
  for (let i = 0; i < nodePositions.length; i += 1) {
    const a = nodePositions[i];
    const b = nodePositions[(i + 2) % nodePositions.length];
    linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const links = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3)),
    new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22 + Math.min(reports.length, 6) * 0.015,
      blending: THREE.AdditiveBlending,
    })
  );
  nodeGroup.add(links);

  // Floating space dust particles
  const particleGeometry = new THREE.BufferGeometry();
  const particlePointsCount = 200;
  const posArray = new Float32Array(particlePointsCount * 3);
  for (let i = 0; i < particlePointsCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 110;
  }
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const particleMaterial = new THREE.PointsMaterial({
    size: 1.2,
    color: statusColors[health] || 0x00f0ff,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending
  });
  const particlesMesh = new THREE.Points(particleGeometry, particleMaterial);
  root.add(particlesMesh);

  // Moving data transmission pulses along connections
  const pulses = [];
  const pulseGeometry = new THREE.SphereGeometry(0.7, 8, 8);
  const pulseMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending
  });
  if (nodePositions.length > 1) {
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(pulseGeometry, pulseMaterial);
      root.add(mesh);
      pulses.push({
        mesh,
        sourceIdx: Math.floor(Math.random() * nodePositions.length),
        targetIdx: Math.floor(Math.random() * nodePositions.length),
        progress: Math.random()
      });
    }
  }

  // Label configuration
  const label = document.createElement('div');
  label.className = 'team-agent-network-label';
  label.textContent = `${nodePositions.length} AGENT NODES / ${runningTasks.length} ACTIVE ROUTES`;
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

  // Pointer Event listeners
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
      targetRotationY += 0.0025;
      targetRotationX = Math.sin(t * 0.35) * 0.04;
    }

    currentRotationY += (targetRotationY - currentRotationY) * 0.05;
    currentRotationX += (targetRotationX - currentRotationX) * 0.05;

    root.rotation.y = currentRotationY;
    root.rotation.x = currentRotationX;

    particlesMesh.rotation.y = t * 0.04;
    particlesMesh.rotation.x = t * 0.015;

    // Animate data pulses
    if (nodePositions.length > 1) {
      pulses.forEach(p => {
        if (p.sourceIdx === p.targetIdx) {
          p.targetIdx = (p.sourceIdx + 1) % nodePositions.length;
        }
        p.progress += 0.008;
        if (p.progress >= 1) {
          p.progress = 0;
          p.sourceIdx = p.targetIdx;
          p.targetIdx = Math.floor(Math.random() * nodePositions.length);
        }
        const pSource = nodePositions[p.sourceIdx];
        const pTarget = nodePositions[p.targetIdx];
        p.mesh.position.lerpVectors(pSource, pTarget, p.progress);
      });
    }

    // Scale nodes dynamically
    nodeGroup.children.forEach((node, index) => {
      if (node.isMesh) {
        let baseScale = 1;
        if (node === hoveredNode) {
          baseScale = 1.6;
        }
        const scale = baseScale + Math.sin(t * 2.4 + index) * 0.12;
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
          hoveredNode.material.color.setHex(statusColors[hoveredNode.userData.status] || statusColors.healthy);
        }
        hoveredNode = hitMesh;
        hoveredNode.material.color.setHex(0xffffff); // Glow white on hover
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

      tooltip.innerHTML = `<strong>${esc(hoveredNode.userData.label)}</strong><span>Status: ${esc(hoveredNode.userData.status)}</span>`;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
      tooltip.style.display = 'block';
    } else {
      if (hoveredNode) {
        hoveredNode.material.color.setHex(statusColors[hoveredNode.userData.status] || statusColors.healthy);
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
    ['/api/token-sessions' + suffix, renderTokenSessions, 'token-sessions'],
    ['/api/context-budget' + suffix, renderContextBudget, 'context-budget'],
    ['/api/telegram-health' + suffix, renderTelegramHealth, 'telegram-health'],
    ['/api/grafana-mcp' + suffix, renderGrafana, 'grafana-mcp'],
    ['/api/web-inventory' + suffix, renderWeb, 'web-inventory'],
    ['/api/alert-routes' + suffix, renderAlerts, 'alert-routes'],
    ['/api/incidents' + suffix, renderIncidents, 'incident-radar'],
    ['/api/workflows' + suffix, renderWorkflows, 'workflow-health'],
    ['/api/job-runs' + suffix, renderJobRuns, 'job-runs'],
    ['/data/commands.json', renderCommands, 'command-cheatsheet'],
    ['/api/platform-docs' + suffix, renderPlatform, 'platform-docs'],
    ['/api/architecture' + suffix, renderArchitecture, 'architecture-network'],
    ['/api/team-control' + suffix, renderTeamControl, 'team-control-room'],
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
    const res = await fetch('/api/trigger-summary');
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
  ['codex-quota', 'gemma-quota', 'groq-quota', 'token-sessions', 'context-budget', 'telegram-health', 'grafana-mcp', 'web-inventory', 'alert-routes', 'incident-radar', 'workflow-health', 'job-runs', 'command-cheatsheet', 'platform-docs', 'architecture-network', 'team-control-room', 'configured-agents', 'active-sessions', 'active-tasks'].forEach(id => setHtml(id, skeleton(2)));
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
