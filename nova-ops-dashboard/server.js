const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const WORKSPACE = '/Users/nova/.openclaw/workspace';
const PORT = Number(process.env.NOVA_OPS_PORT || 18888);
const OPENCLAW = '/opt/homebrew/bin/openclaw';
const HARNESS = path.join(WORKSPACE, 'nova-harness', 'nova-harness');
const SUPPORT_DIGEST_EXPORT = path.join(WORKSPACE, 'grafana-dashboards', 'export_support_digest_data.py');
const SUPPORT_DIGEST_JSON = path.join(PUBLIC, 'data', 'support_digest.json');
const PY_GOOGLE = path.join(WORKSPACE, '.venv-google', 'bin', 'python');

function run(cmd, args = [], timeout = 15000, options = {}) {
  return new Promise(resolve => {
    execFile(cmd, args, { timeout, maxBuffer: 1024 * 1024, env: { ...process.env, ...(options.env || {}) } }, (error, stdout, stderr) => {
      resolve({ ok: !error, code: error?.code ?? 0, output: `${stdout || ''}${stderr ? '\n' + stderr : ''}`.trim() });
    });
  });
}

async function tail(file, lines = 40) {
  try {
    const txt = await fsp.readFile(file, 'utf8');
    return txt.trim().split('\n').slice(-lines).map(line => {
      try { return JSON.parse(line); } catch { return { ts: '', event: 'raw', output: line }; }
    });
  } catch { return []; }
}

function statusFromText(text, failWords = ['failed', 'unreachable', 'not running', 'error']) {
  if (!text) return 'unknown';
  const low = text.toLowerCase();
  if (failWords.some(w => low.includes(w))) return 'critical';
  if (low.includes('ok') || low.includes('running') || low.includes('reachable')) return 'healthy';
  return 'warning';
}

async function collectHarness() {
  const h = await run(HARNESS, ['check', '--json', '--no-tts'], 240000, { env: { NOVA_HARNESS_SKIP_DASHBOARD: '1' } });
  try {
    const parsed = JSON.parse(h.output);
    if (!h.ok && !parsed.error) parsed.error = 'harness reported failure';
    return parsed;
  }
  catch (e) { return { overall: h.ok ? 'warning' : 'critical', failed: h.ok ? 0 : 1, warned: h.ok ? 1 : 0, checks: [], error: `Could not parse harness JSON: ${e.message}; ${h.output || 'no output'}` }; }
}

async function collectSupportDigest(refresh = false) {
  if (refresh) {
    await run(PY_GOOGLE, [SUPPORT_DIGEST_EXPORT], 120000);
  }
  try {
    const raw = await fsp.readFile(SUPPORT_DIGEST_JSON, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `support digest unavailable: ${e.message}`, rows: [], summary: {} };
  }
}

async function collect() {
  const [status, gatewayHealth, gatewayStatus, nodeStatus, tasks, cron, docker, harness] = await Promise.all([
    run(OPENCLAW, ['status'], 25000),
    run(OPENCLAW, ['gateway', 'health'], 15000),
    run(OPENCLAW, ['gateway', 'status'], 15000),
    run(OPENCLAW, ['node', 'status'], 15000),
    run(OPENCLAW, ['tasks', 'list'], 15000),
    run(OPENCLAW, ['cron', 'list'], 15000),
    run('/usr/local/bin/docker', ['ps', '--format', '{{.Names}}|{{.Status}}|{{.Ports}}'], 8000),
    collectHarness(),
  ]);

  let docker2 = docker;
  if (!docker.ok) docker2 = await run('/opt/homebrew/bin/docker', ['ps', '--format', '{{.Names}}|{{.Status}}|{{.Ports}}'], 8000);

  const guardLog = await tail(path.join(WORKSPACE, 'logs/openclaw-guard.log'), 50);
  const guardRecent = guardLog.slice(-1)[0] || null;
  const restarts = guardLog.filter(x => String(x.event || '').includes('restart')).slice(-20);
  const healthChecks = guardLog.filter(x => x.event === 'health_check');

  const channels = [];
  for (const name of ['Telegram', 'Discord']) {
    const re = new RegExp(`${name}\\s+│\\s+ON\\s+│\\s+OK`, 'i');
    channels.push({ name, status: re.test(status.output) ? 'healthy' : (status.output.includes(name) ? 'warning' : 'unknown') });
  }

  const services = [
    { name: 'OpenClaw Gateway', status: gatewayStatus.ok && gatewayHealth.ok ? 'healthy' : 'critical', detail: gatewayHealth.output || gatewayStatus.output },
    { name: 'OpenClaw Node', status: nodeStatus.ok && /running/i.test(nodeStatus.output) ? 'healthy' : statusFromText(nodeStatus.output), detail: nodeStatus.output },
    { name: 'Guard Agent', status: guardRecent ? 'healthy' : 'warning', detail: guardRecent ? `${guardRecent.event} @ ${guardRecent.ts}` : 'No guard log yet' },
    { name: 'Channels', status: channels.every(c => c.status === 'healthy') ? 'healthy' : 'warning', detail: channels.map(c => `${c.name}: ${c.status}`).join(' · ') },
  ];

  const dockerRows = docker2.ok ? docker2.output.split('\n').filter(Boolean).map(row => {
    const [name, status, ports] = row.split('|');
    return { name, status, ports, isN8n: /n8n/i.test(name) };
  }) : [];

  const sessionsMatch = status.output.match(/Sessions\s+│\s+([^│]+)/i);
  const tasksMatch = status.output.match(/Tasks\s+│\s+([^│]+)/i);
  const heartbeatMatch = status.output.match(/Heartbeat\s+│\s+([^│]+)/i);

  return {
    generatedAt: new Date().toISOString(),
    overall: services.some(s => s.status === 'critical') || harness.overall === 'fail' ? 'critical' : services.some(s => s.status === 'warning') || harness.overall === 'warn' ? 'warning' : 'healthy',
    summary: {
      sessions: sessionsMatch?.[1]?.trim() || 'see raw status',
      tasks: tasksMatch?.[1]?.trim() || (tasks.ok ? 'task command ok' : 'task command unavailable'),
      heartbeat: heartbeatMatch?.[1]?.trim() || 'unknown',
      guardChecks: healthChecks.length,
      recentRestarts: restarts.length,
    },
    services,
    channels,
    docker: dockerRows,
    raw: {
      openclawStatus: status.output,
      tasks: tasks.output,
      cron: cron.output,
      gatewayStatus: gatewayStatus.output,
      nodeStatus: nodeStatus.output,
    },
    guard: { recent: guardLog.slice(-12).reverse(), restarts: restarts.reverse() },
    harness,
    roadmap: [
      'Read-only dashboard live MVP',
      'Harness results visible in dashboard GUI',
      'Add n8n workflow execution/error API integration',
      'Add incident timeline and weekly ops report export',
      'Add authenticated admin actions only with explicit confirmation + audit log'
    ]
  };
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/ping') {
    send(res, 200, 'application/json', JSON.stringify({ ok: true, service: 'nova-ops-dashboard', generatedAt: new Date().toISOString() }));
    return;
  }
  if (url.pathname === '/api/status') {
    try { send(res, 200, 'application/json', JSON.stringify(await collect())); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/harness') {
    try { send(res, 200, 'application/json', JSON.stringify(await collectHarness())); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/support-digest') {
    try { send(res, 200, 'application/json', JSON.stringify(await collectSupportDigest(url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ ok: false, error: e.message })); }
    return;
  }
  const file = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
  const full = path.normalize(path.join(PUBLIC, file));
  if (!full.startsWith(PUBLIC)) return send(res, 403, 'text/plain', 'Forbidden');
  try {
    const body = await fsp.readFile(full);
    const ext = path.extname(full);
    const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html';
    send(res, 200, type, body);
  } catch { send(res, 404, 'text/plain', 'Not found'); }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Nova Ops Dashboard running at http://127.0.0.1:${PORT}`);
});
