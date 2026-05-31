const $ = id => document.getElementById(id);
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

let visNetworkInstance = null;

function renderArchitecture(data) {
  const container = $('architecture-network');
  if (!container || !window.vis) return;

  const style = getComputedStyle(document.body);
  const cyan = style.getPropertyValue('--cyan').trim() || '#00f0ff';
  const purple = style.getPropertyValue('--purple-ai').trim() || '#a78bfa';
  const emerald = style.getPropertyValue('--emerald').trim() || '#34d399';
  const orange = '#fb923c';

  const typeColors = {
    file: cyan,
    function: purple,
    class: emerald,
    import: orange
  };

  const nodes = (data.nodes || []).map(node => {
    const color = typeColors[node.type] || '#94a3b8';
    return {
      id: node.id,
      label: node.label,
      title: `${node.id}\nType: ${node.type}\nLocation: ${node.source_file}:${node.source_location}`,
      color: {
        background: 'rgba(15, 23, 42, 0.8)',
        border: color,
        highlight: {
          background: 'rgba(30, 41, 59, 0.9)',
          border: color
        }
      },
      font: {
        color: '#e5eefb',
        face: 'Outfit, sans-serif',
        size: 14
      },
      borderWidth: 2,
      shape: 'dot',
      size: node.type === 'file' ? 20 : 12
    };
  });

  const edges = (data.edges || []).map((edge, idx) => {
    return {
      id: `edge-${idx}`,
      from: edge.source,
      to: edge.target,
      label: edge.relation,
      font: {
        color: '#94a3b8',
        face: 'JetBrains Mono, monospace',
        size: 9,
        strokeWidth: 0
      },
      arrows: {
        to: { enabled: true, scaleFactor: 0.5 }
      },
      color: {
        color: 'rgba(148, 163, 184, 0.3)',
        highlight: cyan,
        hover: cyan
      },
      width: 1
    };
  });

  const visData = {
    nodes: new vis.DataSet(nodes),
    edges: new vis.DataSet(edges)
  };

  const options = {
    physics: {
      stabilization: true,
      barnesHut: {
        gravitationalConstant: -2000,
        centralGravity: 0.3,
        springLength: 95,
        springConstant: 0.04,
        damping: 0.09,
        avoidOverlap: 0.1
      }
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      zoomView: true
    }
  };

  if (visNetworkInstance) {
    visNetworkInstance.destroy();
  }
  visNetworkInstance = new vis.Network(container, visData, options);
}

window.redrawArchitecture = function() {
  if (visNetworkInstance) {
    visNetworkInstance.setSize('100%', '550px');
    visNetworkInstance.redraw();
    visNetworkInstance.fit();
  }
};

async function loadDetails(force = false) {
  const suffix = force ? '?refresh=1' : '';
  const jobs = [
    ['/api/codex-quota' + suffix, renderCodexQuota, 'codex-quota'],
    ['/api/gemma-quota' + suffix, renderGemmaQuota, 'gemma-quota'],
    ['/api/groq-quota' + suffix, renderGroqQuota, 'groq-quota'],
    ['/api/token-sessions' + suffix, renderTokenSessions, 'token-sessions'],
    ['/api/grafana-mcp' + suffix, renderGrafana, 'grafana-mcp'],
    ['/api/web-inventory' + suffix, renderWeb, 'web-inventory'],
    ['/api/alert-routes' + suffix, renderAlerts, 'alert-routes'],
    ['/api/incidents' + suffix, renderIncidents, 'incident-radar'],
    ['/api/workflows' + suffix, renderWorkflows, 'workflow-health'],
    ['/api/job-runs' + suffix, renderJobRuns, 'job-runs'],
    ['/data/commands.json', renderCommands, 'command-cheatsheet'],
    ['/api/platform-docs' + suffix, renderPlatform, 'platform-docs'],
    ['/api/architecture' + suffix, renderArchitecture, 'architecture-network'],
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
    
    // Wave animation (noise simulation)
    const pos = geometry.attributes.position.array;
    const orig = geometry.attributes.originalPosition.array;
    
    const baseAmp = soundState.speaking ? 11.0 : (isFocusMode ? 0.25 : 3.0);
    const baseFreq = soundState.speaking ? 4.5 : (isFocusMode ? 0.4 : 1.8);
    speedMultiplier = soundState.speaking ? 3.5 : 1.0;
    
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
  ['codex-quota', 'gemma-quota', 'groq-quota', 'token-sessions', 'grafana-mcp', 'web-inventory', 'alert-routes', 'incident-radar', 'workflow-health', 'job-runs', 'command-cheatsheet', 'platform-docs', 'architecture-network'].forEach(id => setHtml(id, skeleton(2)));
  renderHarness({ overall: 'loading', deferred: true, checks: [] });
  if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = getPreferredVoice;
  $('sound-toggle')?.addEventListener('click', playIntroVoice);
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
