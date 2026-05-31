const http = require('http');
const https = require('https');
const net = require('net');
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
const STATUS_SNAPSHOT_JSON = path.join(PUBLIC, 'data', 'status_snapshot.json');
const N8N_DIR = path.join(WORKSPACE, 'n8n');
const OPENCLAW_CONFIG_JSON = '/Users/nova/.openclaw/openclaw.json';
const OPENCLAW_AUTH_PROFILES_JSON = '/Users/nova/.openclaw/agents/main/agent/auth-profiles.json';
const OPENCLAW_SESSIONS_DIR = '/Users/nova/.openclaw/agents/main/sessions';
const PY_GOOGLE = path.join(WORKSPACE, '.venv-google', 'bin', 'python');
const GRAFANA_BRIDGE = path.join(WORKSPACE, 'grafana-openclaw-bridge');
const GROQ_KEY_FILE = '/Users/nova/.openclaw/secrets/cheap-repo-reader/groq-api-key.txt';
const REPO_REVIEW_QUEUE_JSON = path.join(WORKSPACE, 'research', 'repo-review-queue', 'queue.json');
const CHEAP_REPO_REVIEWS_DIR = path.join(WORKSPACE, 'research', 'cheap-repo-reviews');
const CODEX_ACCOUNTS = [
  'openai-codex:watit2004@gmail.com',
  'openai-codex:natty.jk@gmail.com',
];
const CODEX_APP_SERVER_DIST = '/Users/nova/.openclaw/npm/node_modules/@openclaw/codex/dist';
const CODEX_APP_SERVER_BIN = '/Applications/Codex.app/Contents/Resources/codex';
const GEMMA_AUTH_PROFILE = 'google:aistudio-gemma';
const GEMMA_MODEL_ID = 'google/gemma-4-31b-it';
const GEMMA_API_MODEL = 'gemma-4-31b-it';
const GRAFANA_PROJECTS = [
  {
    id: 'grafana_amaze',
    project: 'Amaze',
    url: 'https://grafana.amaze-x.com',
    envFile: path.join(GRAFANA_BRIDGE, '.env.amaze'),
    runner: path.join(GRAFANA_BRIDGE, 'run-mcp-grafana-amaze.sh'),
    usage: 'Prod HPC log digest cron',
    cronName: 'Prod HPC log digest 18:00 weekdays'
  },
  {
    id: 'grafana_phoenix',
    project: 'Phoenix',
    url: 'https://grafana.lotussphoenix.com',
    envFile: path.join(GRAFANA_BRIDGE, '.env.phoenix'),
    runner: path.join(GRAFANA_BRIDGE, 'run-mcp-grafana-phoenix.sh'),
    usage: 'Phoenix dashboard / MCP queries',
    dashboardUid: 'ae2iusdg7aepsd'
  }
];

const { execSync } = require('child_process');

function getReadyz() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:18789/readyz', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(3000, () => req.destroy());
  });
}

async function handleServiceCLI() {
  const args = process.argv.slice(2);
  let cmd = args[0];
  let action = args[1];
  if (cmd !== 'service') {
    if (['install', 'uninstall', 'status', 'start', 'stop', 'restart'].includes(cmd)) {
      action = cmd;
      cmd = 'service';
    } else {
      return false;
    }
  }

  const plistPath = path.join(process.env.HOME, 'Library/LaunchAgents/ai.openclaw.nova-ops-dashboard.plist');
  const label = 'ai.openclaw.nova-ops-dashboard';

  if (action === 'install') {
    console.log(`Installing LaunchAgent service for ${label}...`);
    const nodeBin = process.execPath;
    const serverScript = path.resolve(__filename);
    const workingDir = path.dirname(serverScript);
    const stdoutLog = path.join(WORKSPACE, 'logs/nova-ops-dashboard.stdout.log');
    const stderrLog = path.join(WORKSPACE, 'logs/nova-ops-dashboard.stderr.log');

    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${nodeBin}</string>
    <string>${serverScript}</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>WorkingDirectory</key>
  <string>${workingDir}</string>

  <key>StandardOutPath</key>
  <string>${stdoutLog}</string>

  <key>StandardErrorPath</key>
  <string>${stderrLog}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NOVA_OPS_PORT</key>
    <string>${PORT}</string>
  </dict>
</dict>
</plist>
`;
    await fsp.mkdir(path.dirname(plistPath), { recursive: true });
    await fsp.writeFile(plistPath, plistContent, 'utf8');
    console.log(`Saved plist file to ${plistPath}`);
    try {
      execSync(`launchctl load "${plistPath}"`, { stdio: 'inherit' });
      console.log(`Service successfully loaded and started.`);
    } catch (e) {
      console.warn(`Warning: failed to run launchctl load (it might already be loaded): ${e.message}`);
    }
    process.exit(0);
  }

  if (action === 'uninstall') {
    console.log(`Uninstalling LaunchAgent service for ${label}...`);
    try {
      execSync(`launchctl unload "${plistPath}"`, { stdio: 'inherit' });
    } catch (e) {
      console.warn(`Warning: failed to run launchctl unload: ${e.message}`);
    }
    try {
      await fsp.unlink(plistPath);
      console.log(`Deleted plist file.`);
    } catch (e) {
      console.warn(`Warning: could not delete plist file: ${e.message}`);
    }
    process.exit(0);
  }

  if (action === 'start') {
    console.log(`Starting service ${label}...`);
    try {
      execSync(`launchctl start ${label}`, { stdio: 'inherit' });
      console.log(`Service started.`);
    } catch (e) {
      console.error(`Error starting service: ${e.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (action === 'stop') {
    console.log(`Stopping service ${label}...`);
    try {
      execSync(`launchctl stop ${label}`, { stdio: 'inherit' });
      console.log(`Service stopped.`);
    } catch (e) {
      console.error(`Error stopping service: ${e.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (action === 'restart') {
    console.log(`Restarting service ${label}...`);
    try {
      execSync(`launchctl stop ${label}`, { stdio: 'ignore' });
    } catch {}
    try {
      execSync(`launchctl unload "${plistPath}"`, { stdio: 'ignore' });
    } catch {}
    try {
      execSync(`launchctl load "${plistPath}"`, { stdio: 'inherit' });
      console.log(`Service restarted.`);
    } catch (e) {
      console.error(`Error restarting service: ${e.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (action === 'status') {
    console.log(`Nova Ops Dashboard status check...`);
    let isLoaded = false;
    let pid = null;
    let lastStatus = null;
    try {
      const out = execSync(`launchctl list | grep ${label}`, { encoding: 'utf8' });
      const parts = out.trim().split(/\s+/);
      pid = parts[0] === '-' ? null : parts[0];
      lastStatus = parts[1];
      isLoaded = true;
    } catch {}

    console.log(`Label:       ${label}`);
    console.log(`Status:      ${isLoaded ? (pid ? 'running' : 'loaded (idle)') : 'not loaded'}`);
    if (pid) console.log(`PID:         ${pid}`);
    if (lastStatus) console.log(`Last Status: ${lastStatus}`);
    console.log(`Port:        ${PORT}`);

    try {
      const pingUrl = `http://127.0.0.1:${PORT}/api/ping`;
      console.log(`Testing HTTP ping to ${pingUrl}...`);
      const http = require('http');
      http.get(pingUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log(`Ping response (HTTP ${res.statusCode}): ${data.trim()}`);
          process.exit(0);
        });
      }).on('error', (e) => {
        console.error(`HTTP Ping failed: ${e.message}`);
        process.exit(1);
      });
    } catch (e) {
      console.error(`Failed to verify HTTP status: ${e.message}`);
      process.exit(1);
    }
    return true;
  }

  console.log(`Unknown service action: ${action}. Use: install | uninstall | status | start | stop | restart`);
  process.exit(1);
}

const args = process.argv.slice(2);
const isServiceCmd = args[0] === 'service' || ['install', 'uninstall', 'status', 'start', 'stop', 'restart'].includes(args[0]);
if (isServiceCmd) {
  handleServiceCLI().catch(e => {
    console.error(e);
    process.exit(1);
  });
}

const cache = new Map();
const TTL = {
  fastStatus: 8000,
  harness: 10 * 60 * 1000,
  platformDocs: 5 * 60 * 1000,
  webInventory: 15000,
  alertRoutes: 15000,
  grafanaMcp: 30000,
  supportDigest: 60000,
  incidents: 60000,
  workflows: 30000,
  codexQuota: 30000,
  gemmaQuota: 30000,
  groqQuota: 30000,
  tokenSessions: 30000,
  jobRuns: 30000,
};

const WEB_INVENTORY = [
  {
    name: 'Nova Mobile Web',
    purpose: 'Mobile web client: chat, sessions, system status and PWA shell.',
    statusMode: 'port',
    port: 18910,
    publicUrls: ['https://app.novaosai.work'],
    localUrls: ['http://127.0.0.1:18910'],
    owner: 'Nova',
    exposure: 'Public via Cloudflare tunnel',
    note: 'Primary user-facing web surface. Star Office UI now owns the former Claw3D entry path.'
  },
  {
    name: 'Nova Ops Dashboard',
    purpose: 'Read-only operations dashboard for Gateway, Node, Guard, channels, cron, Docker, Harness and support digest.',
    statusMode: 'port',
    port: 18888,
    publicUrls: [],
    localUrls: ['http://127.0.0.1:18888'],
    owner: 'Nova',
    exposure: 'Local only',
    note: 'This page. Keep read-only unless an explicit safety layer is added.'
  },
  {
    name: 'Shopee Affiliate Automation',
    purpose: 'Local affiliate ops dashboard for product scoring, content drafts, and manual performance tracking.',
    statusMode: 'port',
    port: 18920,
    publicUrls: [],
    localUrls: ['http://127.0.0.1:18920'],
    owner: 'Nova',
    exposure: 'Local only',
    note: 'MVP only. No auto-posting and no logged-in affiliate scraping.'
  },
  {
    name: 'OpenClaw Gateway / LINE webhook surface',
    purpose: 'Gateway and webhook-facing surface for OpenClaw integrations.',
    statusMode: 'port',
    port: 18789,
    publicUrls: ['https://line.novaosai.work', 'https://line.novaos.ai'],
    localUrls: ['http://127.0.0.1:18789'],
    owner: 'OpenClaw',
    exposure: 'Public tunnel for webhook/runtime ingress',
    note: 'Operational endpoint, not a normal browser UI.'
  },
  {
    name: 'LINE OpenClaw Bridge',
    purpose: 'Local bridge service for LINE/OpenClaw routing.',
    statusMode: 'port',
    port: 18991,
    publicUrls: [],
    localUrls: ['http://127.0.0.1:18991'],
    owner: 'Nova',
    exposure: 'Local service',
    note: 'Token-protected bridge surface.'
  },
  {
    name: 'Nova Auto',
    purpose: 'Reserved automation endpoint.',
    statusMode: 'port',
    port: 18891,
    publicUrls: ['https://auto.novaosai.work', 'https://auto.novaos.ai'],
    localUrls: ['http://127.0.0.1:18891'],
    owner: 'Nova',
    exposure: 'Public route configured',
    note: 'Route is configured in Cloudflare, but service is expected to be inactive unless a listener exists.'
  },
  {
    name: 'Trade Service',
    purpose: 'Reserved trading service endpoint.',
    statusMode: 'port',
    port: 8000,
    publicUrls: ['https://trade.novaosai.work', 'https://trade.novaos.ai'],
    localUrls: ['http://127.0.0.1:8000'],
    owner: 'Nova',
    exposure: 'Public route configured',
    note: 'Route is configured in Cloudflare, but service is expected to be inactive unless a listener exists.'
  },
  {
    name: 'Star Office UI',
    purpose: 'Pixel-art OpenClaw office dashboard replacing the Claw3D sandbox.',
    statusMode: 'port',
    port: 19000,
    publicUrls: ['https://app.novaosai.work/claw3d-enter'],
    localUrls: ['http://127.0.0.1:19000', 'http://127.0.0.1:18910/star-office'],
    owner: 'Nova sandbox',
    exposure: 'Local service; former Claw3D entry redirects here through Nova Mobile Web when routed.',
    note: 'Code is MIT; bundled art assets are non-commercial only. Replace art before commercial use.'
  }
];

const ALERT_ROUTES = [
  {
    name: 'Telegram direct chat',
    source: 'OpenClaw message plugin / main session',
    destination: 'Telegram DM with Nick',
    trigger: 'Assistant replies, cron delivery, manual sends',
    health: 'openclaw-channel',
    channelName: 'Telegram',
    note: 'Primary visible notification path for Nova.'
  },
  {
    name: 'Discord channel plugin',
    source: 'OpenClaw message plugin',
    destination: 'Discord configured channels',
    trigger: 'Manual sends, channel workflows, command surfaces',
    health: 'openclaw-channel',
    channelName: 'Discord',
    note: 'Available when OpenClaw status reports Discord ON/OK.'
  },
  {
    name: 'LINE webhook ingress',
    source: 'line.novaosai.work / OpenClaw Gateway',
    destination: 'OpenClaw Gateway webhook surface',
    trigger: 'LINE webhook events',
    health: 'port',
    port: 18789,
    note: 'Public webhook route points to the gateway on local port 18789.'
  },
  {
    name: 'LINE OpenClaw Bridge',
    source: 'line-openclaw-bridge',
    destination: 'LINE replies/push through Messaging API',
    trigger: 'LINE messages matching Nova trigger regex',
    health: 'port',
    port: 18991,
    note: 'Local bridge is token protected; dashboard only shows whether the listener is up.'
  },
  {
    name: 'Discord prod-order alerts -> Google Chat',
    source: 'discord-alert-forwarder',
    destination: 'Google Chat order alert webhook',
    trigger: 'Polls Discord #prod-order-monitor and forwards deduped alerts',
    health: 'launchagent',
    label: 'ai.openclaw.discord-prod-order-forwarder',
    note: 'Disabled or stopped means production order alert forwarding is not active.'
  },
  {
    name: 'n8n SLA risk alert -> Google Chat',
    source: 'n8n workflow',
    destination: 'Google Chat digest/alert space',
    trigger: 'Scheduled SLA risk/no-response checks',
    health: 'file',
    file: path.join(WORKSPACE, 'n8n', 'Amaze SLA Risk & No Response Alert -_ Google Chat (Every 30m ICT).json'),
    note: 'Dashboard verifies the workflow artifact exists; n8n runtime status is shown separately in Docker/local workflow surface.'
  },
  {
    name: 'Nova Mobile Web browser notifications',
    source: 'Nova Mobile Web PWA',
    destination: 'Browser notification permission on the device',
    trigger: 'Mobile web alerts surface',
    health: 'port',
    port: 18910,
    note: 'Device permission is client-side; dashboard verifies the web app is active.'
  }
];

function run(cmd, args = [], timeout = 15000, options = {}) {
  return new Promise(resolve => {
    execFile(cmd, args, { timeout, maxBuffer: 1024 * 1024, env: { ...process.env, ...(options.env || {}) } }, (error, stdout, stderr) => {
      resolve({ ok: !error, code: error?.code ?? 0, output: `${stdout || ''}${stderr ? '\n' + stderr : ''}`.trim() });
    });
  });
}

async function cached(key, ttl, producer, force = false) {
  const now = Date.now();
  const hit = cache.get(key);
  if (!force && hit?.value && now - hit.ts < ttl) return { ...hit.value, cached: true, cacheAgeMs: now - hit.ts };
  if (!force && hit?.pending) return hit.pending;
  const pending = Promise.resolve()
    .then(producer)
    .then(value => {
      const wrapped = { ...value, cached: false, cacheAgeMs: 0 };
      cache.set(key, { ts: Date.now(), value: wrapped });
      return wrapped;
    })
    .catch(error => {
      cache.delete(key);
      throw error || new Error('unknown cache producer failure');
    });
  cache.set(key, { ts: hit?.ts || now, value: hit?.value, pending });
  return pending;
}

function refreshInBackground(key, ttl, producer) {
  cached(key, ttl, producer, true).catch(error => {
    console.error(`background refresh failed for ${key}: ${error.message}`);
  });
}

async function readJsonFile(file) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return null;
  }
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

function harnessStatusToHealth(status) {
  if (status === 'pass') return 'healthy';
  if (status === 'fail') return 'critical';
  if (status === 'warn') return 'warning';
  if (status === 'loading') return 'loading';
  return 'unknown';
}

function checkPort(port, host = '127.0.0.1', timeout = 800) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    let done = false;
    const finish = ok => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function collectWebInventory() {
  const items = await Promise.all(WEB_INVENTORY.map(async item => {
    const ports = [item.port, ...(item.extraPorts || [])].filter(Boolean);
    const portChecks = await Promise.all(ports.map(async port => ({ port, active: await checkPort(port) })));
    const mainPortActive = portChecks.find(p => p.port === item.port)?.active || false;
    const anyPortActive = portChecks.some(p => p.active);
    let status = 'warning';
    let statusLabel = 'Reserved';
    if (item.statusMode === 'paused') {
      status = anyPortActive ? 'warning' : 'unknown';
      statusLabel = anyPortActive ? 'Unexpected listener' : 'Paused';
    } else if (mainPortActive) {
      status = 'healthy';
      statusLabel = 'Active';
    } else {
      status = 'warning';
      statusLabel = 'Inactive';
    }
    return { ...item, status, statusLabel, ports: portChecks };
  }));
  return { generatedAt: new Date().toISOString(), items };
}

function readOpenClawChannel(output, name) {
  const text = String(output || '');
  const target = String(name || '').toLowerCase();
  for (const line of text.split('\n')) {
    if (!line.includes('│') || !line.toLowerCase().includes(target)) continue;
    const cells = line.split('│').map(cell => cell.trim()).filter(Boolean);
    const channelIndex = cells.findIndex(cell => cell.toLowerCase() === target);
    if (channelIndex === -1) continue;
    const enabled = cells[channelIndex + 1] || '';
    const state = cells[channelIndex + 2] || '';
    const enabledOn = /^ON$/i.test(enabled);
    const stateOk = /^(OK|SETUP|READY|RUNNING|ACTIVE)$/i.test(state);
    return {
      name,
      enabled,
      state,
      status: enabledOn && stateOk ? 'healthy' : enabledOn ? 'warning' : 'unknown',
      detail: [enabled, state].filter(Boolean).join('/'),
    };
  }

  const legacy = new RegExp(`${name}\\s+│\\s+ON\\s+│\\s+(OK|SETUP|READY|RUNNING|ACTIVE)`, 'i');
  if (legacy.test(text)) return { name, enabled: 'ON', state: 'OK', status: 'healthy', detail: 'ON/OK' };
  return { name, enabled: '', state: '', status: text.toLowerCase().includes(target) ? 'warning' : 'unknown', detail: 'not reported' };
}

function channelStatusFromOpenClaw(output, name) {
  return readOpenClawChannel(output, name).status;
}

async function collectAlertRoutes() {
  const [openclawStatus, launchAgents] = await Promise.all([
    run(OPENCLAW, ['status'], 25000),
    run('/bin/launchctl', ['list'], 8000),
  ]);
  const items = await Promise.all(ALERT_ROUTES.map(async route => {
    let status = 'unknown';
    let statusLabel = 'Unknown';
    let evidence = '';
    if (route.health === 'openclaw-channel') {
      const channel = readOpenClawChannel(openclawStatus.output, route.channelName);
      status = channel.status;
      statusLabel = status === 'healthy' ? channel.detail : status === 'warning' ? 'Configured with warning' : 'Not reported';
      evidence = `${route.channelName} from openclaw status`;
    } else if (route.health === 'port') {
      const active = await checkPort(route.port);
      status = active ? 'healthy' : 'warning';
      statusLabel = active ? 'Listener active' : 'No local listener';
      evidence = `127.0.0.1:${route.port} ${active ? 'open' : 'closed'}`;
    } else if (route.health === 'launchagent') {
      const line = (launchAgents.output || '').split('\n').find(row => row.includes(route.label));
      const active = Boolean(line && !line.trim().startsWith('-'));
      status = active ? 'healthy' : 'warning';
      statusLabel = active ? 'LaunchAgent running' : 'LaunchAgent stopped/disabled';
      evidence = line || 'not listed by launchctl';
    } else if (route.health === 'file') {
      const exists = fs.existsSync(route.file);
      status = exists ? 'healthy' : 'warning';
      statusLabel = exists ? 'Workflow artifact present' : 'Workflow artifact missing';
      evidence = route.file;
    }
    return { ...route, status, statusLabel, evidence };
  }));
  return { generatedAt: new Date().toISOString(), items };
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

function freshness(generatedAt, staleAfterMs) {
  const ageMs = generatedAt ? Date.now() - Date.parse(generatedAt) : null;
  return {
    generatedAt: generatedAt || '',
    ageMs: Number.isFinite(ageMs) ? Math.max(0, ageMs) : null,
    staleAfterMs,
    stale: !Number.isFinite(ageMs) || ageMs > staleAfterMs,
  };
}

async function collectIncidentRadar() {
  const digest = await collectSupportDigest(false);
  const rows = Array.isArray(digest.rows) ? digest.rows : [];
  const severityRank = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };
  const items = rows.map(row => ({
    severity: row.severity || 'unknown',
    title: row.incident_candidate || 'Unnamed candidate',
    service: row.service || 'unknown',
    endpoint: row.endpoint || '',
    count: Number(row.count_sampled || 0),
    maxRptMs: Number(row.max_rpt_ms || 0),
    signature: row.error_signature || '',
    dependency: row.likely_dependency || '',
    environment: row.env || '',
    notes: row.notes || '',
  })).sort((a, b) => (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99) || b.count - a.count);
  const synthetic = items.length > 0 && items.every(item => /synthetic|poc/i.test(item.notes) || item.environment === 'test');
  return {
    ok: digest.ok !== false,
    source: digest.source || 'support-digest',
    classification: synthetic ? 'Synthetic POC evidence' : 'Operational evidence',
    environment: synthetic ? 'test' : [...new Set(items.map(item => item.environment).filter(Boolean))].join(', '),
    freshness: freshness(digest.generated_at, 24 * 60 * 60 * 1000),
    totals: {
      candidates: items.length,
      samples: Number(digest.summary?.sample_count || items.reduce((n, item) => n + item.count, 0)),
      urgent: items.filter(item => item.severity === 'P0' || item.severity === 'P1').length,
    },
    items,
    error: digest.error || '',
  };
}

async function collectWorkflowHealth() {
  const runtimeActive = await checkPort(5678);
  let files = [];
  try {
    files = (await fsp.readdir(N8N_DIR)).filter(file => file.endsWith('.json'));
  } catch {}
  const items = [];
  for (const file of files) {
    const full = path.join(N8N_DIR, file);
    const value = await readJsonFile(full);
    if (!value) continue;
    const st = await fsp.stat(full).catch(() => null);
    items.push({
      name: value.name || file.replace(/\.json$/, ''),
      active: Boolean(value.active),
      nodeCount: Array.isArray(value.nodes) ? value.nodes.length : 0,
      file,
      updatedAt: st?.mtime?.toISOString() || '',
      status: runtimeActive ? (value.active ? 'healthy' : 'unknown') : (value.active ? 'warning' : 'unknown'),
      statusLabel: value.active ? (runtimeActive ? 'Active config' : 'Active config; runtime offline') : 'Disabled config',
      evidence: 'Workflow JSON flag only; execution history not connected',
    });
  }
  items.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  return {
    generatedAt: new Date().toISOString(),
    source: 'local n8n artifacts + port probe',
    runtime: { active: runtimeActive, port: 5678, status: runtimeActive ? 'healthy' : 'warning' },
    executionHistoryConnected: false,
    summary: { configured: items.length, activeConfigs: items.filter(item => item.active).length },
    items,
  };
}

async function collectPlatformDocs() {
  const files = [
    ['Architecture', path.join(WORKSPACE, 'docs', 'nova-platform-architecture.md')],
    ['Memory Model', path.join(WORKSPACE, 'docs', 'nova-memory-model.md')],
    ['Capability Registry', path.join(WORKSPACE, 'docs', 'nova-capability-registry.md')],
  ];
  const docs = await Promise.all(files.map(async ([title, file]) => {
    try { return { title, text: await fsp.readFile(file, 'utf8') }; }
    catch { return { title, text: '' }; }
  }));
  return { generatedAt: new Date().toISOString(), docs };
}

function readEnvMeta(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const meta = {};
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...rest] = line.split('=');
      const value = rest.join('=').trim();
      if (key === 'GRAFANA_URL') meta.url = value;
      if (key === 'GRAFANA_TOKEN' || key === 'GRAFANA_SERVICE_ACCOUNT_TOKEN') meta.tokenPresent = Boolean(value);
      if (key === 'GRAFANA_ORG_ID') meta.orgId = value;
    }
    const st = fs.statSync(file);
    return { exists: true, mode: (st.mode & 0o777).toString(8), ...meta };
  } catch {
    return { exists: false, tokenPresent: false };
  }
}

function parseCronDigest(rawCron) {
  const text = rawCron || '';
  const active = /Prod HPC log digest|d9a67c9d-c479-4954-bc5c-d01f321f15fb|dece7497-632a-4167-ad2e-0a6ea3b291a1/.test(text);
  const amazeEnv = /\.env\.amaze/.test(text);
  const next = text.match(/nextRunAtMs[\s\S]{0,80}(\d{13})/)?.[1];
  return {
    active,
    amazeEnv,
    nextRunAt: next ? new Date(Number(next)).toISOString() : '',
    evidence: active ? (amazeEnv ? 'cron payload pins .env.amaze' : 'Prod HPC cron listed; payload pins .env.amaze in scheduler config') : 'Prod HPC cron configured; list output unavailable here'
  };
}

function summarizeCronJobs(rawCron) {
  const text = rawCron || '';
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const interesting = lines.filter(line => !/^[-=]+$/.test(line) && !/^id\s+/i.test(line));
  const jobs = [];
  const known = [
    ['Prod HPC log digest', 'Grafana/Amaze support digest', 'scheduled report'],
    ['commute', 'Commute assistant', 'personal ops'],
    ['morning', 'Morning briefing', 'briefing'],
    ['investment', 'Investment brief', 'briefing'],
    ['heartbeat', 'Heartbeat monitor', 'system monitor'],
  ];

  for (const [needle, name, category] of known) {
    const line = interesting.find(row => row.toLowerCase().includes(needle.toLowerCase()));
    if (!line) continue;
    const nextMs = line.match(/nextRunAtMs[^0-9]*(\d{13})/)?.[1] || line.match(/\b(1\d{12})\b/)?.[1] || '';
    jobs.push({
      id: 'cron-' + needle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name,
      source: 'OpenClaw cron',
      category,
      status: 'healthy',
      statusLabel: 'Scheduled',
      schedule: line.slice(0, 180),
      nextRunAt: nextMs ? new Date(Number(nextMs)).toISOString() : '',
      evidence: line,
    });
  }

  if (!jobs.length && text) {
    jobs.push({
      id: 'cron-openclaw',
      name: 'OpenClaw cron jobs',
      source: 'OpenClaw cron',
      category: 'scheduler',
      status: 'unknown',
      statusLabel: 'Listed',
      schedule: 'Raw cron output available in Status tab',
      nextRunAt: '',
      evidence: interesting.slice(0, 3).join(' | ') || 'cron list returned output',
    });
  }

  return jobs;
}

function repoJobStatus(status) {
  if (status === 'completed') return 'healthy';
  if (status === 'blocked' || status === 'failed') return 'critical';
  if (status === 'running' || status === 'queued') return 'warning';
  return 'unknown';
}

async function collectRepoReviewRuns() {
  const queue = await readJsonFile(REPO_REVIEW_QUEUE_JSON);
  const entries = Array.isArray(queue?.jobs) ? queue.jobs : [];
  return entries.map(entry => {
    const status = repoJobStatus(entry.status);
    return {
      id: entry.id,
      jobId: 'repo-review',
      jobName: 'Cheap public repo review',
      source: 'repo-review-queue',
      title: entry.repo ? entry.owner + '/' + entry.repo : entry.url,
      status,
      statusLabel: entry.status || 'unknown',
      startedAt: entry.createdAt || '',
      completedAt: entry.updatedAt || '',
      durationLabel: entry.attempts ? entry.attempts + ' attempt' + (entry.attempts === 1 ? '' : 's') : 'not attempted',
      evidence: entry.reviewPath || entry.runLog || entry.notes || entry.url,
    };
  }).sort((a, b) => Date.parse(b.completedAt || b.startedAt || 0) - Date.parse(a.completedAt || a.startedAt || 0));
}

async function collectJobRuns() {
  const [cronRaw, harness, repoRuns] = await Promise.all([
    run(OPENCLAW, ['cron', 'list'], 15000),
    cached('harness', TTL.harness, collectHarness).catch(error => ({ overall: 'unknown', checks: [], error: error.message })),
    collectRepoReviewRuns(),
  ]);

  const cronJobs = summarizeCronJobs(cronRaw.output);
  const harnessStatus = harnessStatusToHealth(harness.overall);
  const jobs = [
    ...cronJobs,
    {
      id: 'quality-nova-harness',
      name: 'Nova Harness quality gate',
      source: 'local harness',
      category: 'quality gate',
      status: harnessStatus,
      statusLabel: (harness.overall || 'unknown').toUpperCase(),
      schedule: 'Manual / LaunchAgent / dashboard refresh',
      nextRunAt: '',
      evidence: (harness.checks || []).length + ' checks · ' + (harness.failed || 0) + ' failed · ' + (harness.warned || 0) + ' warnings',
    },
    {
      id: 'repo-review',
      name: 'Cheap public repo review',
      source: 'repo-review-queue',
      category: 'research automation',
      status: repoRuns.some(run => run.status === 'critical') ? 'warning' : repoRuns.some(run => run.status === 'warning') ? 'warning' : 'healthy',
      statusLabel: repoRuns.length + ' queued/history records',
      schedule: 'Manual intake via queue',
      nextRunAt: '',
      evidence: REPO_REVIEW_QUEUE_JSON.replace(WORKSPACE + '/', ''),
    },
  ];

  const harnessRun = {
    id: 'harness-latest',
    jobId: 'quality-nova-harness',
    jobName: 'Nova Harness quality gate',
    source: 'local harness',
    title: 'Latest dashboard quality snapshot',
    status: harnessStatus,
    statusLabel: harness.overall || 'unknown',
    startedAt: harness.generated_at || harness.generatedAt || '',
    completedAt: harness.generated_at || harness.generatedAt || '',
    durationLabel: (harness.checks || []).length + ' checks',
    evidence: harness.error || ((harness.failed || 0) + ' failed · ' + (harness.warned || 0) + ' warnings'),
  };

  const runs = [harnessRun, ...repoRuns].slice(0, 30);
  const counts = runs.reduce((acc, run) => {
    acc[run.status] = (acc[run.status] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    source: 'OpenClaw cron + Nova Harness + repo-review queue',
    mode: 'read-only prototype',
    summary: {
      jobs: jobs.length,
      runs: runs.length,
      healthy: counts.healthy || 0,
      warning: counts.warning || 0,
      critical: counts.critical || 0,
      unknown: counts.unknown || 0,
    },
    jobs,
    runs,
  };
}

async function collectAndPersistStatus() {
  const value = await collect();
  await fsp.mkdir(path.dirname(STATUS_SNAPSHOT_JSON), { recursive: true }).catch(() => {});
  await fsp.writeFile(STATUS_SNAPSHOT_JSON, JSON.stringify(value), 'utf8').catch(() => {});
  return value;
}

async function collectGrafanaMcp() {
  const [openclawConfigRaw, cronRaw] = await Promise.all([
    fsp.readFile('/Users/nova/.openclaw/openclaw.json', 'utf8').catch(() => '{}'),
    run(OPENCLAW, ['cron', 'list'], 15000)
  ]);
  let servers = {};
  try {
    servers = JSON.parse(openclawConfigRaw).mcp?.servers || {};
  } catch {}
  const cronDigest = parseCronDigest(cronRaw.output);
  const items = GRAFANA_PROJECTS.map(project => {
    const env = readEnvMeta(project.envFile);
    const server = servers[project.id];
    const runnerExists = fs.existsSync(project.runner);
    const urlMatches = !env.url || env.url === project.url;
    const tokenOk = Boolean(env.tokenPresent);
    const modeOk = env.mode === '600';
    const configured = Boolean(server?.command && runnerExists && env.exists && tokenOk && urlMatches);
    let status = configured ? 'healthy' : tokenOk ? 'warning' : 'critical';
    let statusLabel = configured ? 'Configured' : tokenOk ? 'Check config' : 'Missing token';
    if (project.id === 'grafana_amaze' && configured) {
      statusLabel = cronDigest.amazeEnv ? 'Configured for digest' : 'Configured';
      if (!cronDigest.amazeEnv) status = 'warning';
    }
    return {
      ...project,
      status,
      statusLabel,
      mcpServer: project.id,
      command: server?.command || '',
      envFile: project.envFile.replace(WORKSPACE + '/', ''),
      runner: project.runner.replace(WORKSPACE + '/', ''),
      tokenPresent: tokenOk,
      envExists: env.exists,
      envMode: env.mode || '',
      url: env.url || project.url,
      urlMatches,
      modeOk,
      runnerExists,
      cron: project.id === 'grafana_amaze' ? cronDigest : null
    };
  });
  return { generatedAt: new Date().toISOString(), items };
}

function emptyCodexUsage(accountId, configured = false) {
  return {
    accountId,
    email: accountId.replace(/^openai-codex:/, ''),
    configured,
    status: configured ? 'healthy' : 'warning',
    statusLabel: configured ? 'Configured' : 'Missing profile',
    limitKnown: false,
    limitLabel: 'Realtime limit unavailable',
    realtimeLimit: null,
    usage24h: { turns: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0 },
    usage7d: { turns: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0 },
    sessions7d: 0,
    latestTurnAt: '',
    evidence: 'OpenClaw session logs + auth profile config',
  };
}

function addCodexUsage(bucket, usage = {}) {
  bucket.turns += 1;
  bucket.input += Number(usage.input || 0);
  bucket.output += Number(usage.output || 0);
  bucket.cacheRead += Number(usage.cacheRead || 0);
  bucket.cacheWrite += Number(usage.cacheWrite || 0);
  bucket.totalTokens += Number(usage.totalTokens || 0);
  bucket.cost += Number(usage.cost?.total || 0);
}

function emptyTokenSession(sessionId, sessionKey = '') {
  const key = sessionKey || sessionId;
  return {
    sessionId,
    sessionKey: key,
    kind: inferSessionKind(key),
    model: 'unknown',
    account: 'unknown',
    turns: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    latestTurnAt: '',
    firstTurnAt: '',
  };
}

function inferSessionKind(sessionKey = '') {
  if (sessionKey.includes(':cron:')) return 'cron';
  if (sessionKey.includes(':telegram:') || sessionKey.includes(':discord:') || sessionKey.includes(':line:')) return 'channel';
  if (sessionKey.endsWith(':main') || sessionKey.includes(':main:main')) return 'main';
  if (sessionKey.includes(':isolated')) return 'isolated';
  return 'session';
}

function collectSessionKeys(value, out = new Map()) {
  if (Array.isArray(value)) {
    for (const item of value) collectSessionKeys(item, out);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  const sessionId = value.sessionId || value.id;
  if (sessionId && value.sessionKey) out.set(String(sessionId), String(value.sessionKey));
  for (const child of Object.values(value)) collectSessionKeys(child, out);
  return out;
}

async function readSessionAccount(jsonlPath) {
  const sidecar = `${jsonlPath}.codex-app-server.json`;
  const meta = await readJsonFile(sidecar);
  return meta?.authProfileId || meta?.accountId || 'unknown';
}

async function collectTokenSessions() {
  const now = Date.now();
  const hours = 5;
  const warnTokens = 250000;
  const cutoff = now - hours * 60 * 60 * 1000;
  const files = await fsp.readdir(OPENCLAW_SESSIONS_DIR);
  const sessionsIndex = await readJsonFile(path.join(OPENCLAW_SESSIONS_DIR, 'sessions.json'));
  const sessionKeys = collectSessionKeys(sessionsIndex);
  const itemsBySession = new Map();

  for (const file of files) {
    if (!file.endsWith('.jsonl') || file.includes('.trajectory')) continue;
    const sessionId = file.replace(/\.jsonl$/, '').replace(/\.deleted\..*$/, '');
    const sessionKey = sessionKeys.get(sessionId) || sessionId;
    const item = itemsBySession.get(sessionId) || emptyTokenSession(sessionId, sessionKey);
    if (!itemsBySession.has(sessionId)) {
      item.account = await readSessionAccount(path.join(OPENCLAW_SESSIONS_DIR, file));
      itemsBySession.set(sessionId, item);
    }

    let text = '';
    try { text = await fsp.readFile(path.join(OPENCLAW_SESSIONS_DIR, file), 'utf8'); }
    catch { continue; }
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      const message = event.message || {};
      if (event.type !== 'message' || message.role !== 'assistant' || !message.usage) continue;
      const ts = parseEventTimestamp(message.timestamp || event.timestamp);
      if (!Number.isFinite(ts) || ts < cutoff) continue;

      const usage = message.usage;
      item.turns += 1;
      item.input += Number(usage.input || 0);
      item.output += Number(usage.output || 0);
      item.cacheRead += Number(usage.cacheRead || 0);
      item.cacheWrite += Number(usage.cacheWrite || 0);
      item.totalTokens += Number(usage.totalTokens || 0);
      const candidateModel = message.model || event.model;
      if (candidateModel && (item.model === 'unknown' || candidateModel !== 'delivery-mirror')) item.model = candidateModel;
      if (!item.firstTurnAt || ts < Date.parse(item.firstTurnAt)) item.firstTurnAt = new Date(ts).toISOString();
      if (!item.latestTurnAt || ts > Date.parse(item.latestTurnAt)) item.latestTurnAt = new Date(ts).toISOString();
    }
  }

  const items = [...itemsBySession.values()]
    .filter(item => item.turns > 0)
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 12)
    .map(item => ({
      ...item,
      warning: item.totalTokens >= warnTokens,
      tokenShare: 0,
    }));
  const totalTokens = items.reduce((sum, item) => sum + item.totalTokens, 0);
  for (const item of items) item.tokenShare = totalTokens ? Math.round((item.totalTokens / totalTokens) * 1000) / 10 : 0;

  return {
    generatedAt: new Date().toISOString(),
    source: 'openclaw-local-session-logs',
    hours,
    warnTokens,
    totalTokens,
    items,
    note: 'Shows local session token usage for the last 5 hours. Use this to catch main/channel/cron sessions that are consuming premium model quota.',
  };
}

function parseEventTimestamp(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d{13}$/.test(value)) return Number(value);
  return Date.parse(value || '');
}

function normalizeCodexWindow(window, fallbackLabel) {
  if (!window || typeof window !== 'object') return null;
  const duration = Number((window.windowDurationMins ?? window.window_duration_mins) || 0);
  const usedPercent = Number(window.usedPercent ?? window.used_percent);
  const resetsAt = Number((window.resetsAt ?? window.resets_at) || 0);
  return {
    label: duration === 300 ? '5 hour' : duration === 10080 ? 'weekly' : fallbackLabel,
    windowDurationMins: duration || null,
    usedPercent: Number.isFinite(usedPercent) ? Math.max(0, Math.min(100, usedPercent)) : null,
    remainingPercent: Number.isFinite(usedPercent) ? Math.max(0, 100 - Math.max(0, Math.min(100, usedPercent))) : null,
    resetsAt: resetsAt > 0 ? new Date(resetsAt * 1000).toISOString() : '',
  };
}

function normalizeCodexRealtimeLimit(value) {
  const rateLimits = value?.rateLimitsByLimitId?.codex || value?.rateLimits || value;
  if (!rateLimits || typeof rateLimits !== 'object') return null;
  return {
    planType: rateLimits.planType || rateLimits.plan_type || '',
    reachedType: rateLimits.rateLimitReachedType || rateLimits.rate_limit_reached_type || '',
    primary: normalizeCodexWindow(rateLimits.primary, 'primary'),
    secondary: normalizeCodexWindow(rateLimits.secondary, 'secondary'),
    generatedAt: new Date().toISOString(),
  };
}

let codexRequestModulePromise = null;

async function loadCodexRequestModule() {
  if (!codexRequestModulePromise) {
    codexRequestModulePromise = (async () => {
      const files = await fsp.readdir(CODEX_APP_SERVER_DIST);
      const candidates = await Promise.all(files
        .filter(file => /^request-[\w-]+\.js$/.test(file))
        .map(async file => {
          const full = path.join(CODEX_APP_SERVER_DIST, file);
          const stat = await fsp.stat(full).catch(() => null);
          return stat ? { full, mtimeMs: stat.mtimeMs } : null;
        }));
      const candidate = candidates
        .filter(Boolean)
        .sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
      if (!candidate) throw new Error(`Codex request bundle not found in ${CODEX_APP_SERVER_DIST}`);

      const mod = await import('file://' + candidate.full);
      const methods = Object.values(mod).find(value => value && typeof value === 'object' && value.rateLimits === 'account/rateLimits/read');
      const requestCodexAppServerJson = Object.values(mod).find(value => typeof value === 'function' && value.name === 'requestCodexAppServerJson');
      if (!methods || !requestCodexAppServerJson) {
        throw new Error(`Codex request bundle ${path.basename(candidate.full)} does not expose expected control request API`);
      }
      return { methods, requestCodexAppServerJson, source: candidate.full };
    })().catch(error => {
      codexRequestModulePromise = null;
      throw error;
    });
  }
  return codexRequestModulePromise;
}

async function readCodexRealtimeLimit(config, accountId) {
  const { methods, requestCodexAppServerJson } = await loadCodexRequestModule();
  return normalizeCodexRealtimeLimit(await requestCodexAppServerJson({
    method: methods.rateLimits,
    requestParams: undefined,
    timeoutMs: 20000,
    startOptions: {
      transport: 'stdio',
      command: fs.existsSync(CODEX_APP_SERVER_BIN) ? CODEX_APP_SERVER_BIN : 'codex',
      commandSource: 'managed',
      args: ['app-server', '--listen', 'stdio://'],
      headers: {},
    },
    config,
    authProfileId: accountId,
    isolated: true,
  }));
}

function groqEmptyUsage(configured = false) {
  return {
    provider: 'Groq',
    accountId: 'groq:cheap-repo-reader',
    configured,
    status: configured ? 'healthy' : 'warning',
    statusLabel: configured ? 'Key configured' : 'Missing key',
    keyFile: GROQ_KEY_FILE.replace('/Users/nova/', '~/'),
    keyMode: '',
    model: 'llama-3.1-8b-instant',
    limitLabel: 'Per-model guide: 30 RPM · 14,400 RPD',
    limitKnown: false,
    realtimeLimit: {
      generatedAt: '',
      primary: null,
      secondary: null,
    },
    usage24h: { calls: 0, completed: 0, failed: 0, pending: 0 },
    usage7d: { calls: 0, completed: 0, failed: 0, pending: 0 },
    latestCallAt: '',
    reviewArtifacts7d: 0,
    models: { reachable: false, active: 0, region: '', sample: [] },
    evidence: 'Groq API probe + local cheap repo review queue/artifacts',
  };
}

function groqUsageWindow(calls, limit, label) {
  const usedPercent = limit > 0 ? Math.min(100, (calls / limit) * 100) : null;
  return {
    label,
    usedPercent,
    remainingPercent: usedPercent == null ? null : Math.max(0, 100 - usedPercent),
    used: calls,
    limit,
    resetsAt: '',
  };
}

function requestJson(url, headers = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let data = null;
        try { data = body ? JSON.parse(body) : null; } catch {}
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, headers: res.headers, data });
        } else {
          reject(new Error('HTTP ' + res.statusCode + ': ' + String(body || '').slice(0, 240)));
        }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function collectGroqQuota() {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const minuteAgo = now - 60 * 1000;
  const item = groqEmptyUsage(fs.existsSync(GROQ_KEY_FILE));
  const notes = [];
  let groqCalls1m = 0;

  if (item.configured) {
    try {
      const st = await fsp.stat(GROQ_KEY_FILE);
      item.keyMode = (st.mode & 0o777).toString(8);
      if (item.keyMode !== '600') {
        item.status = 'warning';
        item.statusLabel = 'Key present · mode check';
        notes.push('Groq key file should stay mode 600; current mode is ' + item.keyMode + '.');
      }
    } catch (e) {
      item.status = 'warning';
      item.statusLabel = 'Key stat unavailable';
      notes.push('Could not stat Groq key file: ' + (e?.message || String(e)));
    }

    try {
      const apiKey = (await fsp.readFile(GROQ_KEY_FILE, 'utf8')).trim();
      const probe = await requestJson('https://api.groq.com/openai/v1/models', {
        Authorization: 'Bearer ' + apiKey,
        'User-Agent': 'NovaOpsDashboard/1.0',
      });
      const models = Array.isArray(probe.data?.data) ? probe.data.data : [];
      item.models = {
        reachable: true,
        active: models.filter(model => model.active !== false).length,
        region: String(probe.headers['x-groq-region'] || ''),
        sample: models.slice(0, 4).map(model => model.id).filter(Boolean),
      };
      item.limitKnown = true;
      item.realtimeLimit.generatedAt = new Date().toISOString();
      if (item.status !== 'warning') item.statusLabel = 'API reachable';
    } catch (e) {
      item.status = 'critical';
      item.statusLabel = 'API probe failed';
      notes.push('Groq API probe failed: ' + (e?.message || String(e)));
    }
  }

  const queue = await readJsonFile(REPO_REVIEW_QUEUE_JSON);
  const entries = Array.isArray(queue?.jobs) ? queue.jobs : Array.isArray(queue?.items) ? queue.items : Array.isArray(queue?.queue) ? queue.queue : [];
  for (const entry of entries) {
    if (entry.provider !== 'groq') continue;
    const ts = parseEventTimestamp(entry.updatedAt || entry.completedAt || entry.createdAt || entry.enqueuedAt || '');
    if (Number.isFinite(ts)) {
      if (!item.latestCallAt || ts > Date.parse(item.latestCallAt)) item.latestCallAt = new Date(ts).toISOString();
      if (ts >= minuteAgo) groqCalls1m += 1;
      const bucket = ts >= dayAgo ? item.usage24h : null;
      const bucket7d = ts >= weekAgo ? item.usage7d : null;
      for (const target of [bucket, bucket7d].filter(Boolean)) {
        target.calls += 1;
        const status = String(entry.status || '').toLowerCase();
        if (status === 'completed' || status === 'done' || entry.reviewPath) target.completed += 1;
        else if (status === 'failed' || status === 'blocked' || status === 'error') target.failed += 1;
        else target.pending += 1;
      }
    }
  }

  try {
    const files = await fsp.readdir(CHEAP_REPO_REVIEWS_DIR);
    for (const file of files) {
      if (!file.startsWith('groq-') || !file.endsWith('.md')) continue;
      const st = await fsp.stat(path.join(CHEAP_REPO_REVIEWS_DIR, file));
      const ts = st.mtimeMs;
      if (ts >= weekAgo) item.reviewArtifacts7d += 1;
      if (ts >= minuteAgo) groqCalls1m += 1;
      if (!item.latestCallAt || ts > Date.parse(item.latestCallAt)) item.latestCallAt = new Date(ts).toISOString();
    }
  } catch {}

  item.realtimeLimit.primary = groqUsageWindow(item.usage24h.calls, 14400, 'daily request guide');
  item.realtimeLimit.secondary = groqUsageWindow(groqCalls1m, 30, 'per-minute burst guide');
  item.realtimeLimit.generatedAt = new Date().toISOString();
  item.limitLabel = item.configured
    ? item.limitLabel + (item.models.region ? ' · region ' + item.models.region : '')
    : 'Groq key unavailable';

  return {
    generatedAt: new Date().toISOString(),
    source: 'groq-models-api + repo-review-queue',
    note: notes.length
      ? notes.join(' ')
      : 'Groq does not expose account remaining quota through the OpenAI-compatible API here; this card shows key/API health plus local Nova usage against the documented free-tier request guides.',
    items: [item],
  };
}

function emptyGemmaUsage(configured = false) {
  return {
    provider: 'Google AI Studio',
    accountId: GEMMA_AUTH_PROFILE,
    model: GEMMA_MODEL_ID,
    configured,
    status: configured ? 'healthy' : 'warning',
    statusLabel: configured ? 'Profile configured' : 'Missing auth profile',
    limitLabel: 'Remaining quota not exposed by API',
    limitKnown: false,
    keyMode: 'auth-profile',
    realtimeLimit: { generatedAt: '', primary: null, secondary: null },
    usage24h: { calls: 0, completed: 0, failed: 0 },
    usage7d: { calls: 0, completed: 0, failed: 0 },
    latestCallAt: '',
    models: { reachable: false, active: 0, targetAvailable: false, sample: [] },
    fallback: {
      alias: 'gemma-4-31b',
      role: 'Fallback only',
      command: 'openclaw infer model run --local --model gemma-4-31b --prompt "..."',
    },
    evidence: 'Google Generative Language models API + OpenClaw auth profile + local session logs',
  };
}

async function collectGemmaQuota() {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const minuteAgo = now - 60 * 1000;
  const authProfiles = await readJsonFile(OPENCLAW_AUTH_PROFILES_JSON);
  const profile = authProfiles?.profiles?.[GEMMA_AUTH_PROFILE];
  const apiKey = String(profile?.key || '').trim();
  const item = emptyGemmaUsage(Boolean(apiKey));
  const notes = [];
  let calls1m = 0;

  if (profile && profile.provider !== 'google') {
    item.status = 'warning';
    item.statusLabel = 'Profile provider mismatch';
    notes.push('Auth profile exists, but provider is ' + String(profile.provider || 'unknown') + '.');
  }

  if (apiKey) {
    try {
      const probe = await requestJson('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey), {
        'User-Agent': 'NovaOpsDashboard/1.0',
      }, 12000);
      const models = Array.isArray(probe.data?.models) ? probe.data.models : [];
      const names = models.map(model => String(model.name || '').replace(/^models\//, '')).filter(Boolean);
      item.models = {
        reachable: true,
        active: names.length,
        targetAvailable: names.includes(GEMMA_API_MODEL),
        sample: names.filter(name => /gemma|gemini/i.test(name)).slice(0, 6),
      };
      item.realtimeLimit.generatedAt = new Date().toISOString();
      item.status = item.models.targetAvailable ? 'healthy' : 'warning';
      item.statusLabel = item.models.targetAvailable ? 'Fallback ready' : 'Model not listed';
      item.limitKnown = false;
    } catch (e) {
      item.status = 'critical';
      item.statusLabel = 'API probe failed';
      notes.push('Google AI Studio probe failed: ' + (e?.message || String(e)));
    }
  }

  let files = [];
  try { files = await fsp.readdir(OPENCLAW_SESSIONS_DIR); } catch {}
  for (const file of files.filter(name => name.endsWith('.jsonl'))) {
    const filePath = path.join(OPENCLAW_SESSIONS_DIR, file);
    let text = '';
    try { text = await fsp.readFile(filePath, 'utf8'); } catch { continue; }
    if (!text.includes(GEMMA_MODEL_ID) && !text.includes(GEMMA_API_MODEL) && !text.includes('gemma-4-31b')) continue;
    for (const line of text.split('\n')) {
      if (!line.includes('gemma-4-31b') && !line.includes(GEMMA_API_MODEL)) continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      const ts = parseEventTimestamp(event.timestamp || event.message?.timestamp || '');
      if (!Number.isFinite(ts)) continue;
      if (!item.latestCallAt || ts > Date.parse(item.latestCallAt)) item.latestCallAt = new Date(ts).toISOString();
      if (ts >= minuteAgo) calls1m += 1;
      for (const bucket of [ts >= dayAgo ? item.usage24h : null, ts >= weekAgo ? item.usage7d : null].filter(Boolean)) {
        bucket.calls += 1;
        if (String(event.type || '').toLowerCase().includes('error')) bucket.failed += 1;
        else bucket.completed += 1;
      }
    }
  }

  const primaryLimit = 1500;
  const secondaryLimit = 15;
  const primaryUsedPercent = primaryLimit > 0 ? Math.min(100, (item.usage24h.calls / primaryLimit) * 100) : 0;
  item.realtimeLimit.primary = {
    label: 'daily request guide',
    usedPercent: primaryUsedPercent,
    remainingPercent: Math.max(0, 100 - primaryUsedPercent),
    used: item.usage24h.calls,
    limit: primaryLimit,
    resetsAt: '',
  };
  
  const secondaryUsedPercent = secondaryLimit > 0 ? Math.min(100, (calls1m / secondaryLimit) * 100) : 0;
  item.realtimeLimit.secondary = {
    label: 'per-minute burst guide',
    usedPercent: secondaryUsedPercent,
    remainingPercent: Math.max(0, 100 - secondaryUsedPercent),
    used: calls1m,
    limit: secondaryLimit,
    resetsAt: '',
  };

  item.realtimeLimit.generatedAt = new Date().toISOString();
  item.limitKnown = item.configured;
  item.limitLabel = item.configured
    ? `daily ${Math.round(primaryUsedPercent)}% · minutely ${Math.round(secondaryUsedPercent)}%`
    : 'Gemma key unavailable';

  return {
    generatedAt: new Date().toISOString(),
    source: 'google-generativelanguage-models-api + openclaw-auth-profile + local-session-logs',
    note: notes.length
      ? notes.join(' ')
      : 'Google AI Studio does not expose exact remaining quota through this API. This card verifies Gemma 4 31B availability and shows local Nova usage so it can stay reserved for OpenAI Codex quota exhaustion.',
    items: [item],
  };
}

async function collectCodexQuota() {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const config = await readJsonFile(OPENCLAW_CONFIG_JSON);
  const profiles = config?.auth?.profiles || {};
  const itemsByAccount = new Map(CODEX_ACCOUNTS.map(account => [account, emptyCodexUsage(account, Boolean(profiles[account]))]));

  let files = [];
  try {
    files = await fsp.readdir(OPENCLAW_SESSIONS_DIR);
  } catch (e) {
    return {
      generatedAt: new Date().toISOString(),
      source: 'unavailable',
      note: 'Could not read session directory: ' + (e?.message || String(e)),
      items: [...itemsByAccount.values()],
    };
  }

  const sidecars = files.filter(file => file.endsWith('.jsonl.codex-app-server.json'));
  for (const sidecar of sidecars) {
    const sidecarPath = path.join(OPENCLAW_SESSIONS_DIR, sidecar);
    const meta = await readJsonFile(sidecarPath);
    const accountId = meta?.authProfileId;
    if (!itemsByAccount.has(accountId)) continue;

    const item = itemsByAccount.get(accountId);
    const jsonlBase = sidecarPath.replace(/\.codex-app-server\.json$/, '');
    const candidateFiles = files
      .filter(file => file === path.basename(jsonlBase) || file.startsWith(path.basename(jsonlBase) + '.deleted.'))
      .map(file => path.join(OPENCLAW_SESSIONS_DIR, file));
    if (!candidateFiles.length) continue;

    let sessionTouched7d = false;
    for (const jsonlPath of candidateFiles) {
      let text = '';
      try {
        text = await fsp.readFile(jsonlPath, 'utf8');
      } catch {
        continue;
      }
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch { continue; }
        const message = event.message || {};
        if (event.type !== 'message' || message.role !== 'assistant' || !message.usage) continue;

        const ts = parseEventTimestamp(message.timestamp || event.timestamp);
        if (!Number.isFinite(ts)) continue;
        if (!item.latestTurnAt || ts > Date.parse(item.latestTurnAt)) item.latestTurnAt = new Date(ts).toISOString();
        if (ts >= weekAgo) {
          addCodexUsage(item.usage7d, message.usage);
          sessionTouched7d = true;
        }
        if (ts >= dayAgo) addCodexUsage(item.usage24h, message.usage);
      }
    }
    if (sessionTouched7d) item.sessions7d += 1;
  }

  for (const item of itemsByAccount.values()) {
    if (item.configured && item.usage7d.turns === 0) {
      item.status = 'warning';
      item.statusLabel = 'Configured · no 7d local turns';
    }
  }

  const realtimeErrors = [];
  await Promise.all([...itemsByAccount.values()].map(async item => {
    if (!item.configured) return;
    try {
      const realtimeLimit = await readCodexRealtimeLimit(config, item.accountId);
      if (!realtimeLimit) return;
      item.realtimeLimit = realtimeLimit;
      item.limitKnown = true;
      item.limitLabel = [
        realtimeLimit.primary?.usedPercent != null ? `5h ${Math.round(realtimeLimit.primary.usedPercent)}%` : '',
        realtimeLimit.secondary?.usedPercent != null ? `weekly ${Math.round(realtimeLimit.secondary.usedPercent)}%` : '',
      ].filter(Boolean).join(' · ') || 'Realtime available';
      if (realtimeLimit.reachedType) {
        item.status = 'critical';
        item.statusLabel = 'Quota limit reached';
      } else if (item.status !== 'critical') {
        item.status = 'healthy';
        item.statusLabel = realtimeLimit.planType ? `Realtime · ${realtimeLimit.planType}` : 'Realtime';
      }
    } catch (e) {
      realtimeErrors.push(`${item.email}: ${e?.message || String(e)}`);
    }
  }));

  return {
    generatedAt: new Date().toISOString(),
    source: 'codex-app-server-rate-limits + local-session-logs',
    note: realtimeErrors.length
      ? 'Realtime Codex quota partially unavailable: ' + realtimeErrors.join(' | ')
      : 'Realtime Codex quota is read from Codex app-server rate-limit snapshots. Token/session metrics are still from saved local session logs.',
    items: [...itemsByAccount.values()],
  };
}

async function collect() {
  const [status, gatewayHealth, gatewayStatus, nodeStatus, tasks, cron, docker, readyz] = await Promise.all([
    run(OPENCLAW, ['status'], 25000),
    run(OPENCLAW, ['gateway', 'health'], 15000),
    run(OPENCLAW, ['gateway', 'status'], 15000),
    run(OPENCLAW, ['node', 'status'], 15000),
    run(OPENCLAW, ['tasks', 'list'], 15000),
    run(OPENCLAW, ['cron', 'list'], 15000),
    run('/usr/local/bin/docker', ['ps', '--format', '{{.Names}}|{{.Status}}|{{.Ports}}'], 8000),
    getReadyz(),
  ]);

  let docker2 = docker;
  if (!docker.ok) docker2 = await run('/opt/homebrew/bin/docker', ['ps', '--format', '{{.Names}}|{{.Status}}|{{.Ports}}'], 8000);

  const guardLog = await tail(path.join(WORKSPACE, 'logs/openclaw-guard.log'), 50);
  const guardRecent = guardLog.slice(-1)[0] || null;
  const restarts = guardLog.filter(x => String(x.event || '').includes('restart')).slice(-20);
  const healthChecks = guardLog.filter(x => x.event === 'health_check');

  const channels = ['Telegram', 'Discord'].map(name => readOpenClawChannel(status.output, name));

  let gatewayS = gatewayStatus.ok && gatewayHealth.ok ? 'healthy' : 'critical';
  let gatewayDetail = gatewayHealth.output || gatewayStatus.output;
  if (readyz) {
    if (readyz.ready === false || (readyz.failing && readyz.failing.length > 0)) {
      gatewayS = 'warning';
      gatewayDetail = `Failing: ${readyz.failing.join(', ')}`;
    }
  }

  const services = [
    { name: 'OpenClaw Gateway', status: gatewayS, detail: gatewayDetail },
    { name: 'OpenClaw Node', status: nodeStatus.ok && /running/i.test(nodeStatus.output) ? 'healthy' : statusFromText(nodeStatus.output), detail: nodeStatus.output },
    { name: 'Guard Agent', status: guardRecent ? 'healthy' : 'warning', detail: guardRecent ? `${guardRecent.event} @ ${guardRecent.ts}` : 'No guard log yet' },
    { name: 'Channels', status: channels.every(c => c.status === 'healthy') ? 'healthy' : 'warning', detail: channels.map(c => `${c.name}: ${c.detail || c.status}`).join(' · ') },
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
    overall: services.some(s => s.status === 'critical') ? 'critical' : services.some(s => s.status === 'warning') ? 'warning' : 'healthy',
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
    harness: { overall: 'loading', failed: 0, warned: 0, checks: [], deferred: true },
    roadmap: [
      'Read-only dashboard live MVP',
      'Harness results visible in dashboard GUI',
      'Incident Radar + workflow configuration health + freshness labels live in v1.3',
      'Connect n8n execution/error API history (currently artifact/runtime evidence only)',
      'Add incident timeline and weekly ops report export',
      'Add authenticated admin actions only with explicit confirmation + audit log'
    ]
  };
}

function send(res, code, type, body) {
  const staticAsset = type === 'text/css' || type === 'application/javascript';
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': staticAsset ? 'public, max-age=60' : 'no-store',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/ping') {
    send(res, 200, 'application/json', JSON.stringify({ ok: true, service: 'nova-ops-dashboard', generatedAt: new Date().toISOString() }));
    return;
  }
  if (url.pathname === '/api/architecture') {
    try {
      const idx = await run('/Users/nova/.openclaw/workspace/bin/nova-ast-indexer', [ROOT], 10000);
      if (idx.ok) {
        send(res, 200, 'application/json', idx.output);
      } else {
        send(res, 500, 'application/json', JSON.stringify({ error: 'Failed to run AST indexer: ' + idx.output }));
      }
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/status') {
    try {
      const force = url.searchParams.get('refresh') === '1';
      if (!force) {
        const hit = cache.get('fast-status');
        if (hit?.value) {
          send(res, 200, 'application/json', JSON.stringify(await cached('fast-status', TTL.fastStatus, collectAndPersistStatus)));
          return;
        }
        const snapshot = await readJsonFile(STATUS_SNAPSHOT_JSON);
        if (snapshot) {
          refreshInBackground('fast-status', TTL.fastStatus, collectAndPersistStatus);
          send(res, 200, 'application/json', JSON.stringify({ ...snapshot, stale: true, cached: true, cacheAgeMs: Date.now() - new Date(snapshot.generatedAt).getTime() }));
          return;
        }
      }
      send(res, 200, 'application/json', JSON.stringify(await cached('fast-status', TTL.fastStatus, collectAndPersistStatus, force)));
    }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/web-inventory') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('web-inventory', TTL.webInventory, collectWebInventory, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/alert-routes') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('alert-routes', TTL.alertRoutes, collectAlertRoutes, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/grafana-mcp') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('grafana-mcp', TTL.grafanaMcp, collectGrafanaMcp, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/codex-quota') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('codex-quota', TTL.codexQuota, collectCodexQuota, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e?.message || String(e) })); }
    return;
  }
  if (url.pathname === '/api/gemma-quota') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('gemma-quota', TTL.gemmaQuota, collectGemmaQuota, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e?.message || String(e) })); }
    return;
  }
  if (url.pathname === '/api/groq-quota') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('groq-quota', TTL.groqQuota, collectGroqQuota, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e?.message || String(e) })); }
    return;
  }
  if (url.pathname === '/api/token-sessions') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('token-sessions', TTL.tokenSessions, collectTokenSessions, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e?.message || String(e) })); }
    return;
  }
  if (url.pathname === '/api/memory') {
    try {
      const memoryDir = path.join(WORKSPACE, 'memory');
      const files = await fsp.readdir(memoryDir).catch(() => []);
      const mdFiles = files.filter(f => f.endsWith('.md') && /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().reverse();
      
      const dateParam = url.searchParams.get('date');
      if (dateParam) {
        const safeFile = path.basename(dateParam) + '.md';
        if (/^\d{4}-\d{2}-\d{2}\.md$/.test(safeFile)) {
          const content = await fsp.readFile(path.join(memoryDir, safeFile), 'utf8').catch(() => '');
          send(res, 200, 'application/json', JSON.stringify({ date: dateParam, content }));
          return;
        }
      }
      
      const list = mdFiles.map(f => f.replace(/\.md$/, ''));
      let latestContent = '';
      if (mdFiles.length > 0) {
        latestContent = await fsp.readFile(path.join(memoryDir, mdFiles[0]), 'utf8').catch(() => '');
      }
      send(res, 200, 'application/json', JSON.stringify({ files: list, latest: mdFiles[0]?.replace(/\.md$/, '') || '', latestContent }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/trigger-summary') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-summarize-turn');
      const result = await run('python3', [scriptPath], 45000);
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/harness') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('harness', TTL.harness, collectHarness, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/support-digest') {
    const refresh = url.searchParams.get('refresh') === '1';
    try { send(res, 200, 'application/json', JSON.stringify(await cached('support-digest', TTL.supportDigest, () => collectSupportDigest(refresh), refresh))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ ok: false, error: e.message })); }
    return;
  }
  if (url.pathname === '/api/incidents') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('incidents', TTL.incidents, collectIncidentRadar, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ items: [], error: e.message })); }
    return;
  }
  if (url.pathname === '/api/workflows') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('workflows', TTL.workflows, collectWorkflowHealth, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ items: [], error: e.message })); }
    return;
  }
  if (url.pathname === '/api/job-runs') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('job-runs', TTL.jobRuns, collectJobRuns, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ jobs: [], runs: [], error: e.message })); }
    return;
  }
  if (url.pathname === '/api/platform-docs') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('platform-docs', TTL.platformDocs, collectPlatformDocs, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ docs: [], error: e.message })); }
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

if (!isServiceCmd) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Nova Ops Dashboard running at http://127.0.0.1:${PORT}`);
  });
}
