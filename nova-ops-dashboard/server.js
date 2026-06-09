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
const BASE_PATH = '/novaops';
const OPENCLAW = '/opt/homebrew/bin/openclaw';
const HARNESS = path.join(WORKSPACE, 'nova-harness', 'nova-harness');
const SUPPORT_DIGEST_EXPORT = path.join(WORKSPACE, 'grafana-dashboards', 'export_support_digest_data.py');
const SUPPORT_DIGEST_JSON = path.join(PUBLIC, 'data', 'support_digest.json');
const STATUS_SNAPSHOT_JSON = path.join(PUBLIC, 'data', 'status_snapshot.json');
const ACTIVE_WORK_MD = path.join(WORKSPACE, 'ACTIVE_WORK.md');
const NOVA_SKILL_REGISTRY_SCRIPT = path.join(WORKSPACE, 'nova-skill-os', 'skill_registry.py');
const NOVA_SKILL_REGISTRY_JSON = path.join(WORKSPACE, 'nova-skill-os', 'out', 'skill-registry.json');
const NOVA_EVAL_FLYWHEEL_JSON = path.join(WORKSPACE, 'nova-skill-os', 'out', 'eval-flywheel.json');
const NOVA_LATEST_EVAL_RESULT_JSON = path.join(WORKSPACE, 'nova-skill-os', 'out', 'latest-eval-result.json');
const TELEGRAM_BRIDGE_LOG = path.join(WORKSPACE, 'logs', 'telegram-bridge.out.log');
const N8N_DIR = path.join(WORKSPACE, 'n8n');
const OPENCLAW_CONFIG_JSON = '/Users/nova/.openclaw/openclaw.json';
const OPENCLAW_AUTH_PROFILES_JSON = '/Users/nova/.openclaw/agents/main/agent/auth-profiles.json';
const OPENCLAW_SESSIONS_DIR = '/Users/nova/.openclaw/agents/main/sessions';
const NOVA_CONTEXT_SLIMMER = path.join(WORKSPACE, 'bin', 'nova-context-slimmer');
const NOVA_HOT_MEMORY = path.join(WORKSPACE, 'bin', 'nova-hot-memory');
const PY_GOOGLE = path.join(WORKSPACE, '.venv-google', 'bin', 'python');
const GRAFANA_BRIDGE = path.join(WORKSPACE, 'grafana-openclaw-bridge');
const GROQ_KEY_FILE = '/Users/nova/.openclaw/secrets/cheap-repo-reader/groq-api-key.txt';
const REPO_REVIEW_QUEUE_JSON = path.join(WORKSPACE, 'research', 'repo-review-queue', 'queue.json');
const CHEAP_REPO_REVIEWS_DIR = path.join(WORKSPACE, 'research', 'cheap-repo-reviews');
const VERIFICATION_DIR = path.join(WORKSPACE, 'outputs', 'verification');
const MULTIAGENT_RUNTIME_JSON = path.join(WORKSPACE, 'data', 'multiagent-runtime.json');
const MULTIAGENT_WORKER_PROFILES_JSON = path.join(WORKSPACE, 'data', 'multiagent-worker-profiles.json');
const MULTIAGENT_TASK_TEMPLATES_JSON = path.join(WORKSPACE, 'data', 'multiagent-task-templates.json');
const MULTIAGENT_DASHBOARD_REPO_MATRIX_JSON = path.join(WORKSPACE, 'data', 'multiagent-dashboard-repo-matrix.json');
const MULTIAGENT_WATCH_PLIST = '/Users/nova/Library/LaunchAgents/ai.openclaw.nova-agent-watch.plist';
const NEXUS_PATTERNS_DOC = path.join(WORKSPACE, 'research', 'agency-agents', 'nova-nexus-patterns-2026-06-01.md');
const AI_ENGINEERING_ADAPTATION_DOC = path.join(WORKSPACE, 'research', 'ai-engineering-from-scratch', 'nova-adaptation-plan-2026-06-01.md');
const CODEX_ACCOUNT_DEFS = [
  {
    id: 'openai:watit2004@gmail.com',
    legacyIds: ['openai-codex:watit2004@gmail.com'],
    email: 'watit2004@gmail.com',
    codexHome: '/Users/nova/.openclaw/agents/main/agent/codex-home',
  },
  {
    id: 'openai:natty.jk@gmail.com',
    legacyIds: ['openai-codex:natty.jk@gmail.com'],
    email: 'natty.jk@gmail.com',
    codexHome: '/Users/nova/.openclaw/agents/main/agent/codex-home-natty',
  },
];
const CODEX_ACCOUNTS = CODEX_ACCOUNT_DEFS.map(account => account.id);
const CODEX_APP_SERVER_DIST = '/Users/nova/.openclaw/npm/node_modules/@openclaw/codex/dist';
const CODEX_APP_SERVER_BIN = '/Applications/Codex.app/Contents/Resources/codex';
const GEMMA_AUTH_PROFILE = 'google:aistudio-gemma';
const GEMMA_MODEL_ID = 'google/gemma-4-31b-it';
const GEMMA_API_MODEL = 'gemma-4-31b-it';
const MINIMAX_AUTH_PROFILE = 'minimax-portal:default';
const MINIMAX_PROVIDER_ID = 'minimax-portal';
const MINIMAX_USAGE_PATH = '/v1/token_plan/remains';
const MINIMAX_MODELS = [
  'minimax-portal/MiniMax-M3',
  'minimax-portal/MiniMax-M2.7',
  'minimax-portal/MiniMax-M2.7-highspeed',
];
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
  telegramHealth: 5000,
  grafanaMcp: 30000,
  supportDigest: 60000,
  incidents: 60000,
  workflows: 30000,
  codexQuota: 30000,
  gemmaQuota: 30000,
  groqQuota: 30000,
  minimaxQuota: 30000,
  tokenSessions: 30000,
  contextBudget: 30000,
  jobRuns: 30000,
  teamControl: 10000,
  agents: 30000,
  activeTasks: 5000,
  activeSessions: 5000,
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
      resolve({ ok: !error, code: error?.code ?? 0, stdout: stdout || '', stderr: stderr || '', output: `${stdout || ''}${stderr ? '\n' + stderr : ''}`.trim() });
    });
  });
}

async function cached(key, ttl, producer, force = false) {
  const now = Date.now();
  const hit = cache.get(key);
  if (!force && hit?.value && now - hit.ts < ttl) {
    return Array.isArray(hit.value)
      ? Object.assign([...hit.value], { cached: true, cacheAgeMs: now - hit.ts })
      : { ...hit.value, cached: true, cacheAgeMs: now - hit.ts };
  }
  if (!force && hit?.pending) return hit.pending;
  const pending = Promise.resolve()
    .then(producer)
    .then(value => {
      const wrapped = Array.isArray(value)
        ? Object.assign([...value], { cached: false, cacheAgeMs: 0 })
        : { ...value, cached: false, cacheAgeMs: 0 };
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

function parseJsonOutput(output) {
  const text = String(output || '').trim();
  if (!text) throw new Error('empty JSON output');
  try {
    return JSON.parse(text);
  } catch {}
  const lineStartMatch = text.match(/(?:^|\n)(\s*[\[{])/);
  const candidates = [
    lineStartMatch ? lineStartMatch.index + lineStartMatch[0].search(/[\[{]/) : -1,
    text.lastIndexOf('\n[') >= 0 ? text.lastIndexOf('\n[') + 1 : -1,
    text.lastIndexOf('\n{') >= 0 ? text.lastIndexOf('\n{') + 1 : -1,
    text.indexOf('['),
    text.indexOf('{')
  ].filter(index => index >= 0).sort((a, b) => a - b);
  for (const index of candidates) {
    try {
      return JSON.parse(text.slice(index));
    } catch {}
  }
  throw new Error('Could not parse JSON output');
}

function parseActiveWorkMarkdown(content) {
  const sections = [];
  let current = null;
  for (const rawLine of String(content || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      current = { title: sectionMatch[1], items: [] };
      sections.push(current);
      continue;
    }
    if (!current || line.startsWith('#')) continue;
    current.items.push(line.replace(/^-+\s*/, ''));
  }
  return sections;
}

async function collectActiveWork() {
  const content = await fsp.readFile(ACTIVE_WORK_MD, 'utf8');
  const stat = await fsp.stat(ACTIVE_WORK_MD);
  return {
    generatedAt: new Date().toISOString(),
    source: ACTIVE_WORK_MD,
    updatedAt: stat.mtime.toISOString(),
    sections: parseActiveWorkMarkdown(content),
    raw: content
  };
}

async function switchCodexAccount(accountId, restartGateway = true) {
  if (!CODEX_ACCOUNTS.includes(accountId)) {
    throw new Error('Unsupported Codex account: ' + accountId);
  }
  const config = await readJsonFile(OPENCLAW_CONFIG_JSON);
  if (!config) throw new Error('Could not read OpenClaw config');
  if (!config.auth) config.auth = {};
  if (!config.auth.order) config.auth.order = {};
  const fallback = CODEX_ACCOUNTS.filter(account => account !== accountId);
  config.auth.order['openai-codex'] = [accountId, ...fallback];
  await fsp.writeFile(OPENCLAW_CONFIG_JSON, JSON.stringify(config, null, 2) + '\n', 'utf8');

  const validate = await run(OPENCLAW, ['config', 'validate'], 20000);
  if (!validate.ok) throw new Error('Config validation failed: ' + validate.output);

  let restart = { ok: false, skipped: !restartGateway, output: 'Gateway restart skipped' };
  if (restartGateway) {
    restart = await run(OPENCLAW, ['gateway', '--force', 'restart'], 45000);
    if (!restart.ok) {
      restart = await run(OPENCLAW, ['gateway', 'restart', '--force'], 45000);
    }
  }
  cache.delete('codex-quota');
  cache.delete('fast-status');
  return {
    ok: validate.ok && (!restartGateway || restart.ok),
    accountId,
    order: config.auth.order['openai-codex'],
    validate: validate.output,
    restart,
    generatedAt: new Date().toISOString(),
  };
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

function stripAnsi(text) {
  return String(text || '').replace(/\u001b\[[0-9;]*m/g, '');
}

function logTimeToIso(hms) {
  if (!/^\d{2}:\d{2}:\d{2}$/.test(String(hms || ''))) return null;
  const now = new Date();
  const [h, m, s] = hms.split(':').map(Number);
  const d = new Date(now);
  d.setHours(h, m, s, 0);
  if (d.getTime() - now.getTime() > 60 * 60 * 1000) d.setDate(d.getDate() - 1);
  return d.toISOString();
}

async function collectTelegramHealth() {
  const [launchAgents, gatewayHealth] = await Promise.all([
    run('/bin/launchctl', ['list'], 8000),
    run(OPENCLAW, ['gateway', 'health'], 10000),
  ]);
  const serviceLine = (launchAgents.output || '').split('\n').find(row => row.includes('ai.openclaw.telegram-bridge')) || '';
  const parts = serviceLine.trim().split(/\s+/);
  const pid = serviceLine && parts[0] !== '-' ? parts[0] : null;
  const running = Boolean(pid);

  let raw = '';
  try { raw = await fsp.readFile(TELEGRAM_BRIDGE_LOG, 'utf8'); } catch {}
  const lines = stripAnsi(raw).trim().split('\n').filter(Boolean).slice(-220);
  const interesting = lines
    .filter(line => /(Inbound message accepted|Draft placeholder sent|Gateway stream opened|Gateway first token|Gateway stream complete|Stream reply delivered|Reply delivered|timeout|error|failed|listening|webhook cleared)/i.test(line))
    .slice(-30);

  let lastInbound = null;
  let lastDelivered = null;
  let lastPlaceholder = null;
  let lastWarning = null;
  let lastFirstTokenMs = null;
  let lastConnectMs = null;
  let lastElapsedMs = null;
  let inboundCount = 0;
  let deliveryCount = 0;

  for (const line of interesting) {
    const time = line.match(/^(\d{2}:\d{2}:\d{2})/)?.[1] || '';
    const iso = logTimeToIso(time);
    if (/Inbound message accepted/i.test(line)) {
      inboundCount += 1;
      lastInbound = { ts: iso, ageMs: iso ? Date.now() - Date.parse(iso) : null, chars: Number(line.match(/chars=(\d+)/)?.[1] || 0) };
    }
    if (/Draft placeholder sent/i.test(line)) {
      lastPlaceholder = { ts: iso, ageMs: iso ? Date.now() - Date.parse(iso) : null };
    }
    if (/Gateway stream opened/i.test(line)) {
      lastConnectMs = Number(line.match(/connectMs=(\d+)/)?.[1] || 0);
    }
    if (/Gateway first token/i.test(line)) {
      lastFirstTokenMs = Number(line.match(/firstTokenMs=(\d+)/)?.[1] || 0);
    }
    if (/(Stream reply delivered|Reply delivered)/i.test(line)) {
      deliveryCount += 1;
      lastElapsedMs = Number(line.match(/elapsedMs=(\d+)/)?.[1] || 0);
      lastDelivered = { ts: iso, ageMs: iso ? Date.now() - Date.parse(iso) : null, elapsedMs: lastElapsedMs };
    }
    if (/(timeout|error|failed)/i.test(line)) {
      lastWarning = { ts: iso, line: line.replace(/^\d{2}:\d{2}:\d{2}\s+\w+\s+/, '').slice(0, 220) };
    }
  }

  let status = 'healthy';
  let statusLabel = 'Responsive';
  const reasons = [];
  if (!running) {
    status = 'critical';
    statusLabel = 'Bridge stopped';
    reasons.push('LaunchAgent is not running');
  } else if (!gatewayHealth.ok || !/OK/i.test(gatewayHealth.output || '')) {
    status = 'critical';
    statusLabel = 'Gateway unhealthy';
    reasons.push('OpenClaw gateway health check failed');
  } else if ((lastElapsedMs || 0) > 30000 || (lastFirstTokenMs || 0) > 10000) {
    status = 'warning';
    statusLabel = 'Slow reply observed';
    reasons.push('Latest Telegram reply latency exceeded threshold');
  } else if (!interesting.some(line => /listening/i.test(line))) {
    status = 'warning';
    statusLabel = 'No listener evidence';
    reasons.push('Bridge is running but recent log does not show listening line');
  }

  const events = interesting.slice(-12).map(line => ({
    ts: logTimeToIso(line.match(/^(\d{2}:\d{2}:\d{2})/)?.[1] || ''),
    text: line.replace(/^\d{2}:\d{2}:\d{2}\s+\w+\s+/, '').slice(0, 260),
    level: /error|failed|timeout/i.test(line) ? 'critical' : /Slow|warn/i.test(line) ? 'warning' : 'healthy'
  }));

  return {
    generatedAt: new Date().toISOString(),
    status,
    statusLabel,
    running,
    pid,
    serviceLine,
    gatewayOk: gatewayHealth.ok && /OK/i.test(gatewayHealth.output || ''),
    lastInbound,
    lastPlaceholder,
    lastDelivered,
    lastConnectMs,
    lastFirstTokenMs,
    lastElapsedMs,
    inboundCount,
    deliveryCount,
    lastWarning,
    reasons,
    events,
    thresholds: { slowReplyMs: 30000, slowFirstTokenMs: 10000 },
  };
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

async function collectAgents() {
  const result = await run(OPENCLAW, ['agents', 'list', '--json'], 15000);
  if (!result.ok) throw new Error('Failed to run agents list: ' + result.output);
  const parsed = parseJsonOutput(result.stdout || result.output);
  if (Array.isArray(parsed)) return parsed;
  return Object.entries(parsed || {})
    .filter(([key, value]) => /^\d+$/.test(key) && value && typeof value === 'object')
    .map(([, value]) => value);
}

async function collectActiveTasks() {
  const result = await run(OPENCLAW, ['tasks', 'list', '--json'], 15000);
  if (!result.ok) throw new Error('Failed to run tasks list: ' + result.output);
  return parseJsonOutput(result.stdout || result.output);
}

async function collectActiveSessions() {
  const result = await run(OPENCLAW, ['status', '--json'], 15000);
  if (!result.ok) throw new Error('Failed to run status --json: ' + result.output);
  const statusData = parseJsonOutput(result.stdout || result.output);
  return {
    generatedAt: new Date().toISOString(),
    count: statusData.sessions?.count || 0,
    recent: statusData.sessions?.recent || [],
  };
}

function mapAgentRole(agent = {}) {
  const haystack = [
    agent.id,
    agent.identityName,
    agent.model,
    agent.workspace,
    agent.agentDir,
  ].filter(Boolean).join(' ').toLowerCase();
  if (/repo|research|reader|review/.test(haystack)) return 'Repo Reader';
  if (/support|incident|rca|sre/.test(haystack)) return 'Support / RCA';
  if (/qa|verify|test|quality/.test(haystack)) return 'QA / Verification';
  if (/devops|docker|deploy|ops/.test(haystack)) return 'DevOps';
  if (/full.?stack|frontend|backend|engineer|developer|react|node|typescript/.test(haystack)) return 'Senior Full Stack Developer';
  if (/dashboard|frontend|ui|web/.test(haystack)) return 'Dashboard Builder';
  return agent.isDefault ? 'Orchestrator' : 'Generalist';
}

async function collectVerificationReports(limit = 8) {
  let files = [];
  try {
    files = await fsp.readdir(VERIFICATION_DIR);
  } catch {
    return [];
  }
  const jsonFiles = files.filter(file => file.endsWith('.json'));
  const reports = await Promise.all(jsonFiles.map(async file => {
    const full = path.join(VERIFICATION_DIR, file);
    try {
      const [stat, report] = await Promise.all([fsp.stat(full), readJsonFile(full)]);
      return {
        file,
        path: full.replace(WORKSPACE + '/', ''),
        taskId: report.task_id || report.taskId || path.basename(file, '.json'),
        summary: report.summary || '',
        passed: report.passed === true,
        generatedAt: report.generated_at || report.generatedAt || stat.mtime.toISOString(),
        findings: Array.isArray(report.findings) ? report.findings.length : 0,
        sizeBytes: stat.size,
      };
    } catch {
      return null;
    }
  }));
  return reports.filter(Boolean)
    .sort((a, b) => Date.parse(b.generatedAt || 0) - Date.parse(a.generatedAt || 0))
    .slice(0, limit);
}

async function readPlaybookSnapshot() {
  const [nexus, adaptation] = await Promise.all([
    fsp.readFile(NEXUS_PATTERNS_DOC, 'utf8').catch(() => ''),
    fsp.readFile(AI_ENGINEERING_ADAPTATION_DOC, 'utf8').catch(() => ''),
  ]);
  return {
    nexusPath: NEXUS_PATTERNS_DOC.replace(WORKSPACE + '/', ''),
    adaptationPath: AI_ENGINEERING_ADAPTATION_DOC.replace(WORKSPACE + '/', ''),
    nexusAvailable: Boolean(nexus),
    adaptationAvailable: Boolean(adaptation),
    handoffTemplate: /## Handoff Template/i.test(nexus),
    qaFeedbackTemplate: /## QA Failure Feedback/i.test(nexus),
    escalationTemplate: /## Escalation Template/i.test(nexus),
    incidentRunbook: /## Incident Micro-Runbook/i.test(nexus),
    adaptationPlan: /deterministic verification|state schema|prompt-injection/i.test(adaptation),
  };
}

async function collectMultiagentRuntime() {
  const [runtime, workerProfiles, taskTemplates, dashboardRepoMatrix] = await Promise.all([
    readJsonFile(MULTIAGENT_RUNTIME_JSON).catch(() => null),
    readJsonFile(MULTIAGENT_WORKER_PROFILES_JSON).catch(() => ({ profiles: [] })),
    readJsonFile(MULTIAGENT_TASK_TEMPLATES_JSON).catch(() => ({ templates: [] })),
    readJsonFile(MULTIAGENT_DASHBOARD_REPO_MATRIX_JSON).catch(() => ({ repos: [] })),
  ]);
  if (!runtime) {
    return {
      available: false,
      mode: 'not configured',
      queue: [],
      handoffs: [],
      evidenceLedger: [],
      summary: {
        queued: 0,
        running: 0,
        verification: 0,
        blocked: 0,
        needsApproval: 0,
        done: 0,
      },
      workerProfiles: workerProfiles.profiles || [],
      taskTemplates: taskTemplates.templates || [],
      dashboardRepoMatrix,
    };
  }

  const queue = Array.isArray(runtime.queue) ? runtime.queue : [];
  const count = status => queue.filter(task => task.status === status).length;
  const needsApproval = queue.filter(task => task.status === 'needs_approval' || task.approvalRequired).length;
  return {
    ...runtime,
    workerProfiles: workerProfiles.profiles || [],
    taskTemplates: taskTemplates.templates || [],
    dashboardRepoMatrix,
    available: true,
    summary: {
      total: queue.length,
      queued: count('queued'),
      assigned: count('assigned'),
      running: count('running'),
      handoff: count('handoff'),
      verification: count('verification'),
      qualityReview: count('quality_review'),
      blocked: count('blocked'),
      needsApproval,
      done: count('done'),
      handoffs: Array.isArray(runtime.handoffs) ? runtime.handoffs.length : 0,
      evidence: Array.isArray(runtime.evidenceLedger) ? runtime.evidenceLedger.length : 0,
      supervisorRuns: Array.isArray(runtime.supervisorRuns) ? runtime.supervisorRuns.length : 0,
      lastSupervisorRun: Array.isArray(runtime.supervisorRuns) ? runtime.supervisorRuns[0] || null : null,
      workerProfiles: Array.isArray(workerProfiles.profiles) ? workerProfiles.profiles.length : 0,
      taskTemplates: Array.isArray(taskTemplates.templates) ? taskTemplates.templates.length : 0,
      workerSessions: Array.isArray(runtime.workerSessions) ? runtime.workerSessions.length : 0,
      lastWorkerSession: Array.isArray(runtime.workerSessions) ? runtime.workerSessions[0] || null : null,
      workerExecutions: Array.isArray(runtime.workerExecutions) ? runtime.workerExecutions.length : 0,
      lastWorkerExecution: Array.isArray(runtime.workerExecutions) ? runtime.workerExecutions[0] || null : null,
      approvals: Array.isArray(runtime.approvals) ? runtime.approvals.length : 0,
      qaCloseouts: Array.isArray(runtime.qaCloseouts) ? runtime.qaCloseouts.length : 0,
      lastQaCloseout: Array.isArray(runtime.qaCloseouts) ? runtime.qaCloseouts[0] || null : null,
      qualityReviews: Array.isArray(runtime.qualityReviews) ? runtime.qualityReviews.length : 0,
      lastQualityReview: Array.isArray(runtime.qualityReviews) ? runtime.qualityReviews[0] || null : null,
      doctorRuns: Array.isArray(runtime.doctorRuns) ? runtime.doctorRuns.length : 0,
      lastDoctorRun: Array.isArray(runtime.doctorRuns) ? runtime.doctorRuns[0] || null : null,
      autopilotRuns: Array.isArray(runtime.autopilotRuns) ? runtime.autopilotRuns.length : 0,
      lastAutopilotRun: Array.isArray(runtime.autopilotRuns) ? runtime.autopilotRuns[0] || null : null,
      reviews: Array.isArray(runtime.reviews) ? runtime.reviews.length : 0,
      lastReview: Array.isArray(runtime.reviews) ? runtime.reviews[0] || null : null,
      scheduledWatches: Array.isArray(runtime.scheduledWatches) ? runtime.scheduledWatches.length : 0,
      lastScheduledWatch: Array.isArray(runtime.scheduledWatches) ? runtime.scheduledWatches[0] || null : null,
      auditExports: Array.isArray(runtime.auditExports) ? runtime.auditExports.length : 0,
      lastAuditExport: Array.isArray(runtime.auditExports) ? runtime.auditExports[0] || null : null,
      sessionStatusRuns: Array.isArray(runtime.sessionStatusRuns) ? runtime.sessionStatusRuns.length : 0,
      lastSessionStatusRun: Array.isArray(runtime.sessionStatusRuns) ? runtime.sessionStatusRuns[0] || null : null,
      workspaceEvidenceReports: Array.isArray(runtime.workspaceEvidenceReports) ? runtime.workspaceEvidenceReports.length : 0,
      lastWorkspaceEvidenceReport: Array.isArray(runtime.workspaceEvidenceReports) ? runtime.workspaceEvidenceReports[0] || null : null,
      autoCreatedTasks: queue.filter(task => task.autoCreated).length,
      tokenAttributionRuns: Array.isArray(runtime.tokenAttributionRuns) ? runtime.tokenAttributionRuns.length : 0,
      lastTokenAttributionRun: Array.isArray(runtime.tokenAttributionRuns) ? runtime.tokenAttributionRuns[0] || null : null,
      trustScoreRuns: Array.isArray(runtime.trustScoreRuns) ? runtime.trustScoreRuns.length : 0,
      lastTrustScoreRun: Array.isArray(runtime.trustScoreRuns) ? runtime.trustScoreRuns[0] || null : null,
      uiDesignAuditRuns: Array.isArray(runtime.uiDesignAuditRuns) ? runtime.uiDesignAuditRuns.length : 0,
      lastUiDesignAuditRun: Array.isArray(runtime.uiDesignAuditRuns) ? runtime.uiDesignAuditRuns[0] || null : null,
      watchLaunchAgent: {
        installed: fs.existsSync(MULTIAGENT_WATCH_PLIST),
        path: MULTIAGENT_WATCH_PLIST,
      },
    },
  };
}

async function collectTeamControl() {
  const [agentsRaw, sessionsRaw, tasksRaw, reports, playbooks, runtime] = await Promise.all([
    cached('agents', TTL.agents, collectAgents).catch(error => ({ error: error.message })),
    cached('active-sessions', TTL.activeSessions, collectActiveSessions).catch(error => ({ error: error.message, count: 0, recent: [] })),
    cached('active-tasks', TTL.activeTasks, collectActiveTasks).catch(error => ({ error: error.message, count: 0, tasks: [] })),
    collectVerificationReports(),
    readPlaybookSnapshot(),
    collectMultiagentRuntime(),
  ]);

  const agents = Array.isArray(agentsRaw) ? agentsRaw : [];
  const tasks = Array.isArray(tasksRaw.tasks) ? tasksRaw.tasks : [];
  const sessions = Array.isArray(sessionsRaw.recent) ? sessionsRaw.recent : [];
  const roles = [
    {
      id: 'orchestrator',
      name: 'Orchestrator',
      owner: 'Nova main session',
      purpose: 'รับคำสั่งจากพี่นิค แยกงาน เลือก specialist และปิดงานด้วย evidence',
      status: agents.some(a => a.isDefault) ? 'healthy' : 'warning',
      evidence: 'OpenClaw default agent registry',
    },
    {
      id: 'repo-reader',
      name: 'Repo Reader',
      owner: 'nova-cheap-repo-reader / local clone review',
      purpose: 'อ่าน repo สาธารณะ สรุป pattern และกัน secret ก่อนส่งต่อ',
      status: fs.existsSync(path.join(WORKSPACE, 'bin', 'nova-cheap-repo-reader')) ? 'healthy' : 'warning',
      evidence: 'bin/nova-cheap-repo-reader + nova-pack-repo',
    },
    {
      id: 'qa-verification',
      name: 'QA / Verification',
      owner: 'nova-verify-task',
      purpose: 'ตรวจงานแบบ deterministic ไม่ใช้ LLM ใน gate',
      status: fs.existsSync(path.join(WORKSPACE, 'bin', 'nova-verify-task')) ? 'healthy' : 'critical',
      evidence: `${reports.length} verification reports`,
    },
    {
      id: 'senior-full-stack-developer',
      name: 'Senior Full Stack Developer',
      owner: 'Nova implementation lane',
      purpose: 'ออกแบบและแก้ end-to-end app flow: frontend, backend/API, integration, tests, rollout และ code review',
      status: fs.existsSync(path.join(WORKSPACE, 'docs', 'nova-verification-gate.md')) ? 'healthy' : 'warning',
      evidence: 'Nova code workspace + nova-verify-task closeout',
    },
    {
      id: 'support-rca',
      name: 'Support / RCA',
      owner: 'support-engineering framing',
      purpose: 'incident triage, RCA, SLO risk, support backlog และ prevention',
      status: playbooks.incidentRunbook ? 'healthy' : 'warning',
      evidence: playbooks.nexusPath,
    },
    {
      id: 'workflow-automation',
      name: 'Workflow Automation',
      owner: 'OpenClaw cron / n8n / LaunchAgents',
      purpose: 'งาน schedule, digest, queue, notification และ handoff automation',
      status: 'healthy',
      evidence: 'OpenClaw tasks + cron + local workflows',
    },
    {
      id: 'dashboard-control',
      name: 'Dashboard Control',
      owner: 'Nova Ops Dashboard',
      purpose: 'monitor jobs, agents, sessions, tasks, verification, blocker',
      status: 'healthy',
      evidence: 'nova-ops-dashboard /api/team-control',
    },
  ];

  const roster = agents.map(agent => ({
    id: agent.id,
    name: agent.identityName || agent.id,
    emoji: agent.identityEmoji || '🤖',
    role: mapAgentRole(agent),
    model: agent.model || '',
    workspace: agent.workspace || '',
    isDefault: Boolean(agent.isDefault),
  }));

  const runningTasks = tasks.filter(t => t.status === 'running' || t.status === 'queued');
  const failedTasks = tasks.filter(t => t.status === 'failed' || t.status === 'blocked');
  const passedReports = reports.filter(r => r.passed).length;
  const failedReports = reports.length - passedReports;

  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only control room v1',
    summary: {
      roles: roles.length,
      registeredAgents: roster.length,
      activeSessions: sessionsRaw.count || sessions.length,
      runningTasks: runningTasks.length,
      recentReports: reports.length,
      passedReports,
      failedReports,
      runtimeTasks: runtime.summary?.total || 0,
      runtimeQueued: runtime.summary?.queued || 0,
      runtimeRunning: runtime.summary?.running || 0,
      runtimeNeedsApproval: runtime.summary?.needsApproval || 0,
    },
    health: failedTasks.length || failedReports || runtime.summary?.blocked || runtime.summary?.needsApproval ? 'warning' : runningTasks.length || runtime.summary?.running ? 'healthy' : 'healthy',
    roles,
    roster,
    runtime,
    live: {
      sessions: sessions.slice(0, 6),
      runningTasks: runningTasks.slice(0, 6),
      failedTasks: failedTasks.slice(0, 6),
    },
    reports,
    playbooks,
    routerRules: [
      'Repo/web intake -> Repo Reader -> QA / Verification -> memory/playbook artifact',
      'Feature/app build -> Senior Full Stack Developer -> QA / Verification -> dashboard/report closeout',
      'Incident/support issue -> Support / RCA -> evidence timeline -> prevention actions',
      'Code/dashboard change -> Dashboard Builder/DevOps -> nova-verify-task closeout',
      'Runtime task -> Orchestrator -> Specialist -> Handoff Contract -> Evidence Ledger -> Verification',
      'Repeated QA failure 3 times -> escalation report for Nick approval',
    ],
    nextActions: [
      'Add bin/nova-agent-task for task create/update/close commands',
      'Add report-only supervisor loop for stale task monitoring and approval requests',
      'Attach verification report links to every completed runtime task',
    ],
    errors: {
      agents: agentsRaw.error || null,
      sessions: sessionsRaw.error || null,
      tasks: tasksRaw.error || null,
    },
  };
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
  const definition = CODEX_ACCOUNT_DEFS.find(account => account.id === accountId || account.legacyIds.includes(accountId));
  return {
    accountId,
    aliases: definition?.legacyIds || [],
    email: definition?.email || accountId.replace(/^openai(?:-codex)?:/, ''),
    codexHome: definition?.codexHome || '',
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

async function fileStats(file, label) {
  try {
    const text = await fsp.readFile(file, 'utf8');
    return {
      label,
      file: file.replace(WORKSPACE + '/', '').replace('/Users/nova/.openclaw/', '~/.openclaw/'),
      exists: true,
      chars: text.length,
      approxTokens: Math.max(1, Math.ceil(text.length / 4)),
    };
  } catch {
    return {
      label,
      file: file.replace(WORKSPACE + '/', '').replace('/Users/nova/.openclaw/', '~/.openclaw/'),
      exists: false,
      chars: 0,
      approxTokens: 0,
    };
  }
}

async function collectContextBudget() {
  const config = await readJsonFile(OPENCLAW_CONFIG_JSON);
  const defaults = config?.agents?.defaults || {};
  const entries = config?.skills?.entries || {};
  const skillLimits = config?.skills?.limits || {};
  const enabledSkills = Object.values(entries).filter(v => v && v.enabled !== false).length;
  const configuredSkills = Object.keys(entries).length;
  const hotMemoryPath = path.join(WORKSPACE, 'MEMORY_HOT.md');

  if (!fs.existsSync(hotMemoryPath) && fs.existsSync(NOVA_HOT_MEMORY)) {
    await run(NOVA_HOT_MEMORY, [], 10000);
  }

  const files = await Promise.all([
    fileStats(path.join(WORKSPACE, 'SOUL.md'), 'SOUL'),
    fileStats(path.join(WORKSPACE, 'USER.md'), 'USER'),
    fileStats(path.join(WORKSPACE, 'IDENTITY.md'), 'IDENTITY'),
    fileStats(path.join(WORKSPACE, 'TOOLS.md'), 'TOOLS'),
    fileStats(path.join(WORKSPACE, 'HEARTBEAT.md'), 'HEARTBEAT'),
    fileStats(hotMemoryPath, 'MEMORY_HOT'),
    fileStats(path.join(WORKSPACE, 'MEMORY.md'), 'MEMORY full'),
    fileStats(path.join(WORKSPACE, 'AGENTS.md'), 'AGENTS'),
    fileStats(path.join(WORKSPACE, 'COMPRESSION.md'), 'COMPRESSION'),
  ]);

  const firstTurn = files
    .filter(item => ['SOUL', 'USER', 'MEMORY_HOT', 'COMPRESSION'].includes(item.label))
    .reduce((sum, item) => sum + item.approxTokens, 0);
  const fullMemory = files.find(item => item.label === 'MEMORY full')?.approxTokens || 0;
  const firstTurnWithFullMemory = firstTurn + fullMemory;
  const savedByHotMemory = Math.max(0, firstTurnWithFullMemory - firstTurn);
  const bootstrapMaxChars = Number(defaults.bootstrapMaxChars || 0);
  const bootstrapTotalMaxChars = Number(defaults.bootstrapTotalMaxChars || 0);
  const bootstrapFiles = files.filter(item => ['SOUL', 'USER', 'IDENTITY', 'TOOLS', 'HEARTBEAT', 'MEMORY full', 'AGENTS'].includes(item.label));
  let estimatedBootstrapInjectedChars = 0;
  for (const item of bootstrapFiles) {
    const perFile = bootstrapMaxChars ? Math.min(item.chars, bootstrapMaxChars) : item.chars;
    const remaining = bootstrapTotalMaxChars ? Math.max(0, bootstrapTotalMaxChars - estimatedBootstrapInjectedChars) : perFile;
    estimatedBootstrapInjectedChars += Math.min(perFile, remaining);
  }
  const bootstrapCapPercent = bootstrapTotalMaxChars ? Math.round((estimatedBootstrapInjectedChars / bootstrapTotalMaxChars) * 100) : 0;
  const firstTurnBudgetTokens = 12000;
  const warnTokens = 25000;
  const budgetPercent = firstTurnBudgetTokens ? Math.round((firstTurn / firstTurnBudgetTokens) * 100) : 0;

  let status = 'healthy';
  let statusLabel = 'Budget controlled';
  const risks = [];
  if (firstTurn > firstTurnBudgetTokens) {
    status = 'critical';
    statusLabel = 'First-turn budget exceeded';
    risks.push('Compact first-turn files exceed the configured local budget.');
  } else if (firstTurn > firstTurnBudgetTokens * 0.75 || bootstrapTotalMaxChars > 60000) {
    status = 'warning';
    statusLabel = 'Watch context growth';
    risks.push('First-turn context is within budget but close enough to monitor.');
  }
  if (bootstrapCapPercent >= 95) {
    risks.push('Runtime bootstrap is hitting the configured total cap; this is intentional but means late bootstrap files may be truncated.');
    if (status === 'healthy') {
      status = 'warning';
      statusLabel = 'Cap active';
    }
  }
  if (configuredSkills > 40) risks.push('Skills catalog is large; defer full SKILL.md reads until request match.');
  if (defaults.contextInjection === 'always') risks.push('OpenClaw context injection is still always-on; bootstrap caps now limit blast radius.');

  return {
    generatedAt: new Date().toISOString(),
    status,
    statusLabel,
    source: 'local-files + ~/.openclaw/openclaw.json',
    firstTurnBudgetTokens,
    warnTokens,
    approxFirstTurnTokens: firstTurn,
    approxFirstTurnWithFullMemoryTokens: firstTurnWithFullMemory,
    savedByHotMemoryTokens: savedByHotMemory,
    budgetPercent,
    bootstrap: {
      contextInjection: defaults.contextInjection || 'unknown',
      bootstrapMaxChars,
      bootstrapTotalMaxChars,
      approxBootstrapMaxTokens: bootstrapMaxChars ? Math.ceil(bootstrapMaxChars / 4) : 0,
      approxBootstrapTotalMaxTokens: bootstrapTotalMaxChars ? Math.ceil(bootstrapTotalMaxChars / 4) : 0,
      estimatedInjectedChars: estimatedBootstrapInjectedChars,
      approxEstimatedInjectedTokens: Math.ceil(estimatedBootstrapInjectedChars / 4),
      capPercent: bootstrapCapPercent,
    },
    startupContext: defaults.startupContext || {},
    contextLimits: defaults.contextLimits || {},
    skills: {
      configured: configuredSkills,
      enabled: enabledSkills,
      maxSkillsPromptChars: Number(skillLimits.maxSkillsPromptChars || 0),
      policy: 'Inject names/categories only; load SKILL.md on request match.',
    },
    files,
    risks,
    commands: [
      'bin/nova-hot-memory',
      'bin/nova-context-slimmer /path/to/context.txt --budget-tokens 12000',
      'bin/nova-token-budget-report --hours 5',
    ],
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

function codexAppServerStartOptions(codexHome = '') {
  const startOptions = {
    transport: 'stdio',
    command: fs.existsSync(CODEX_APP_SERVER_BIN) ? CODEX_APP_SERVER_BIN : 'codex',
    commandSource: 'managed',
    args: ['app-server', '--listen', 'stdio://'],
    headers: {},
  };
  if (codexHome) startOptions.env = { CODEX_HOME: codexHome };
  return startOptions;
}

async function readCodexActiveAccount(config, codexHome = '') {
  const { methods, requestCodexAppServerJson } = await loadCodexRequestModule();
  const value = await requestCodexAppServerJson({
    method: methods.account,
    requestParams: { refreshToken: false },
    timeoutMs: 20000,
    startOptions: codexAppServerStartOptions(codexHome),
    config,
    isolated: true,
  });
  return value?.account || null;
}

async function readCodexRealtimeLimit(config, accountId, codexHome = '') {
  const { methods, requestCodexAppServerJson } = await loadCodexRequestModule();
  const request = {
    method: methods.rateLimits,
    requestParams: undefined,
    timeoutMs: 20000,
    startOptions: codexAppServerStartOptions(codexHome),
    config,
    isolated: true,
  };
  if (accountId) request.authProfileId = accountId;
  return normalizeCodexRealtimeLimit(await requestCodexAppServerJson(request));
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

function parseMaybeEpoch(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value < 1000000000000 ? value * 1000 : value).toISOString();
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function pickFirst(record, keys) {
  if (!record || typeof record !== 'object') return undefined;
  for (const key of keys) {
    if (record[key] != null && record[key] !== '') return record[key];
  }
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampPercent(value) {
  const n = finiteNumber(value);
  if (n == null) return null;
  return Math.max(0, Math.min(100, n));
}

function compactCount(n) {
  const val = Number(n || 0);
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return String(Math.round(val));
}

function minimaxUsageWindowFromPayload(payload) {
  const totalKeys = ['total', 'total_amount', 'totalAmount', 'total_tokens', 'totalTokens', 'total_quota', 'totalQuota', 'current_interval_total_count', 'currentIntervalTotalCount', 'current_weekly_total_count', 'currentWeeklyTotalCount', 'limit', 'quota', 'quota_limit', 'quotaLimit', 'max'];
  const usedKeys = ['used', 'usage', 'used_amount', 'usedAmount', 'used_tokens', 'usedTokens', 'used_quota', 'usedQuota', 'current_interval_usage_count', 'currentIntervalUsageCount', 'current_weekly_usage_count', 'currentWeeklyUsageCount', 'consumed'];
  const remainingKeys = ['remain', 'remaining', 'remain_amount', 'remainingAmount', 'remaining_amount', 'remain_tokens', 'remainingTokens', 'remaining_tokens', 'remain_quota', 'remainingQuota', 'remaining_quota', 'left'];
  const usedPercentKeys = ['used_percent', 'usedPercent', 'used_rate', 'usage_rate', 'used_ratio', 'usage_ratio', 'usedRatio', 'usageRatio'];
  const remainingPercentKeys = ['usage_percent', 'usagePercent', 'current_interval_remaining_percent', 'currentIntervalRemainingPercent', 'current_weekly_remaining_percent', 'currentWeeklyRemainingPercent'];
  const resetKeys = ['reset_at', 'resetAt', 'reset_time', 'resetTime', 'next_reset_at', 'nextResetAt', 'next_reset_time', 'nextResetTime', 'expires_at', 'expiresAt', 'expire_at', 'expireAt', 'end_time', 'endTime', 'window_end', 'windowEnd'];

  const total = finiteNumber(pickFirst(payload, totalKeys));
  let used = finiteNumber(pickFirst(payload, usedKeys));
  const remaining = finiteNumber(pickFirst(payload, remainingKeys));
  if (used == null && total != null && remaining != null) used = Math.max(0, total - remaining);

  let usedPercent = total && used != null ? clampPercent((used / total) * 100) : null;
  if (usedPercent == null) {
    const raw = finiteNumber(pickFirst(payload, usedPercentKeys));
    if (raw != null) usedPercent = clampPercent(raw <= 1 ? raw * 100 : raw);
  }
  if (usedPercent == null) {
    const rawRemaining = finiteNumber(pickFirst(payload, remainingPercentKeys));
    if (rawRemaining != null) usedPercent = clampPercent(100 - clampPercent(rawRemaining <= 1 ? rawRemaining * 100 : rawRemaining));
  }

  const label = String(payload.window_hours || payload.windowHours || payload.duration_hours || payload.durationHours || '').trim()
    ? String(payload.window_hours || payload.windowHours || payload.duration_hours || payload.durationHours) + 'h'
    : '5h Token Plan';

  return {
    label,
    usedPercent,
    remainingPercent: usedPercent == null ? null : Math.max(0, 100 - usedPercent),
    used,
    limit: total,
    resetsAt: parseMaybeEpoch(pickFirst(payload, resetKeys)),
  };
}

function pickMinimaxUsageRecord(data) {
  const root = data?.data && typeof data.data === 'object' ? data.data : data;
  const remains = Array.isArray(root?.model_remains) ? root.model_remains : [];
  const chat = remains.find(item => {
    const name = String(item?.model_name || '');
    const total = finiteNumber(item?.current_interval_total_count);
    return name.toLowerCase().startsWith('minimax-m') && total && total > 0;
  });
  return chat || remains.find(item => String(item?.model_name || '').toLowerCase() === 'general') || remains[0] || root || {};
}

function minimaxWeeklyWindowFromPayload(payload) {
  const total = finiteNumber(payload?.current_weekly_total_count ?? payload?.currentWeeklyTotalCount);
  const used = finiteNumber(payload?.current_weekly_usage_count ?? payload?.currentWeeklyUsageCount);
  const remainingPercent = finiteNumber(payload?.current_weekly_remaining_percent ?? payload?.currentWeeklyRemainingPercent);
  let usedPercent = total && used != null ? clampPercent((used / total) * 100) : null;
  if (usedPercent == null && remainingPercent != null) usedPercent = clampPercent(100 - clampPercent(remainingPercent));
  return {
    label: 'Weekly Token Plan',
    usedPercent,
    remainingPercent: usedPercent == null ? null : Math.max(0, 100 - usedPercent),
    used,
    limit: total,
    resetsAt: parseMaybeEpoch(payload?.weekly_end_time ?? payload?.weeklyEndTime),
  };
}

function emptyMinimaxUsage(configured = false) {
  return {
    provider: 'MiniMax Token Plan',
    accountId: MINIMAX_AUTH_PROFILE,
    configured,
    status: configured ? 'healthy' : 'warning',
    statusLabel: configured ? 'OAuth profile configured' : 'Missing OAuth profile',
    plan: 'Unknown',
    limitLabel: configured ? 'Token Plan quota probe pending' : 'MiniMax OAuth unavailable',
    limitKnown: false,
    tokenExpiresAt: '',
    realtimeLimit: { generatedAt: '', primary: null, secondary: null },
    usage24h: { calls: 0, completed: 0, failed: 0 },
    usage7d: { calls: 0, completed: 0, failed: 0 },
    latestCallAt: '',
    models: { reachable: configured, active: MINIMAX_MODELS.length, sample: MINIMAX_MODELS },
    aliases: ['minimax-m3', 'minimax-m2.7', 'minimax-m2.7-highspeed'],
    evidence: 'MiniMax token-plan remains API + OpenClaw OAuth profile + local session logs',
  };
}

async function collectMinimaxQuota() {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const authProfiles = await readJsonFile(OPENCLAW_AUTH_PROFILES_JSON);
  const config = await readJsonFile(OPENCLAW_CONFIG_JSON);
  const profile = authProfiles?.profiles?.[MINIMAX_AUTH_PROFILE];
  const accessToken = String(profile?.access || profile?.token || profile?.key || '').trim();
  const item = emptyMinimaxUsage(Boolean(accessToken));
  const notes = [];

  item.tokenExpiresAt = parseMaybeEpoch(profile?.expires) || '';
  if (profile && profile.provider !== MINIMAX_PROVIDER_ID) {
    item.status = 'warning';
    item.statusLabel = 'Profile provider mismatch';
    notes.push('MiniMax auth profile exists, but provider is ' + String(profile.provider || 'unknown') + '.');
  }

  if (accessToken) {
    try {
      const baseUrl = String(config?.models?.providers?.[MINIMAX_PROVIDER_ID]?.baseUrl || 'https://api.minimax.io/anthropic/v1');
      const origin = new URL(baseUrl).origin;
      const probe = await requestJson(origin + MINIMAX_USAGE_PATH, {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'MM-API-Source': 'NovaOpsDashboard',
        'User-Agent': 'NovaOpsDashboard/1.0',
      }, 12000);
      const baseResp = probe.data?.base_resp;
      if (baseResp && Number(baseResp.status_code || 0) !== 0) {
        throw new Error(String(baseResp.status_msg || 'MiniMax API error'));
      }
      const record = pickMinimaxUsageRecord(probe.data);
      const window = minimaxUsageWindowFromPayload(record);
      const weeklyWindow = minimaxWeeklyWindowFromPayload(record);
      const plan = String(record.plan || record.plan_name || record.planName || record.product || record.tier || '').trim();
      const modelName = String(record.model_name || '').trim();
      item.plan = plan || (modelName && modelName !== 'general' ? 'Token Plan · ' + modelName : 'Plus');
      item.realtimeLimit.primary = window.usedPercent == null ? null : window;
      item.realtimeLimit.secondary = weeklyWindow.usedPercent == null ? null : weeklyWindow;
      item.realtimeLimit.generatedAt = new Date().toISOString();
      item.limitKnown = window.usedPercent != null;
      item.status = window.usedPercent == null ? 'warning' : window.usedPercent >= 90 ? 'critical' : window.usedPercent >= 75 ? 'warning' : 'healthy';
      item.statusLabel = window.usedPercent == null ? 'Quota shape unknown' : 'Quota reachable';
      item.limitLabel = window.usedPercent == null
        ? 'Quota response shape not recognized'
        : Math.round(window.usedPercent) + '% used · ' + Math.round(Math.max(0, 100 - window.usedPercent)) + '% left';
      if (window.used != null && window.limit != null && window.limit > 0) {
        item.limitLabel += ' · ' + compactCount(window.used) + '/' + compactCount(window.limit);
      }
    } catch (e) {
      item.status = 'critical';
      item.statusLabel = 'Quota probe failed';
      item.limitLabel = 'MiniMax quota probe failed';
      notes.push('MiniMax quota probe failed: ' + (e?.message || String(e)));
    }
  }

  let files = [];
  try { files = await fsp.readdir(OPENCLAW_SESSIONS_DIR); } catch {}
  for (const file of files.filter(name => name.endsWith('.jsonl'))) {
    const filePath = path.join(OPENCLAW_SESSIONS_DIR, file);
    let text = '';
    try { text = await fsp.readFile(filePath, 'utf8'); } catch { continue; }
    if (!/minimax-portal|MiniMax-M|minimax-m/i.test(text)) continue;
    for (const line of text.split('\n')) {
      if (!/minimax-portal|MiniMax-M|minimax-m/i.test(line)) continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      const ts = parseEventTimestamp(event.timestamp || event.ts || event.message?.timestamp || '');
      if (!Number.isFinite(ts)) continue;
      if (!item.latestCallAt || ts > Date.parse(item.latestCallAt)) item.latestCallAt = new Date(ts).toISOString();
      for (const bucket of [ts >= dayAgo ? item.usage24h : null, ts >= weekAgo ? item.usage7d : null].filter(Boolean)) {
        bucket.calls += 1;
        if (String(event.type || '').toLowerCase().includes('error')) bucket.failed += 1;
        else bucket.completed += 1;
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'minimax-token-plan-remains-api + openclaw-auth-profile + local-session-logs',
    note: notes.length
      ? notes.join(' ')
      : 'MiniMax quota is read from the Token Plan remains API through the OpenClaw OAuth profile. Access tokens are kept redacted; the card shows only plan, expiry, quota window, and local Nova usage.',
    items: [item],
  };
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
  const authProfiles = await readJsonFile(OPENCLAW_AUTH_PROFILES_JSON);
  const profiles = { ...(config?.auth?.profiles || {}), ...(authProfiles?.profiles || {}) };
  const configuredAccountIds = new Set(Object.keys(profiles));
  const accountDefs = CODEX_ACCOUNT_DEFS.map(account => ({
    ...account,
    configured: configuredAccountIds.has(account.id) || account.legacyIds.some(id => configuredAccountIds.has(id)),
  }));
  const itemsByAccount = new Map(accountDefs.map(account => [account.id, emptyCodexUsage(account.id, account.configured)]));
  const accountAliases = new Map(accountDefs.flatMap(account => [[account.id, account.id], ...account.legacyIds.map(id => [id, account.id])]));

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
    const accountId = accountAliases.get(meta?.authProfileId) || meta?.authProfileId;
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
  const activeCodexAccounts = {};
  await Promise.all([...itemsByAccount.values()].map(async item => {
    if (!item.configured) return;
    try {
      const activeCodexAccount = await readCodexActiveAccount(config, item.codexHome);
      activeCodexAccounts[item.email] = activeCodexAccount;
      if (activeCodexAccount?.email && activeCodexAccount.email !== item.email) {
        item.status = 'warning';
        item.statusLabel = 'Wrong Codex login';
        item.limitLabel = `Codex home logged in as ${activeCodexAccount.email}`;
        item.realtimeLimit = {
          generatedAt: new Date().toISOString(),
          primary: null,
          secondary: null,
          error: `This Codex home is logged in as ${activeCodexAccount.email}.`,
        };
        return;
      }
      const profileIsCodex = item.accountId.startsWith('openai-codex:');
      const realtimeLimit = await readCodexRealtimeLimit(config, profileIsCodex ? item.accountId : null, item.codexHome);
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
      const message = e?.message || String(e);
      if (/authentication required|requiresOpenaiAuth|must be OpenAI Codex auth|auth profile .* was not found/i.test(message)) {
        item.status = 'warning';
        item.statusLabel = 'Codex auth required';
        item.limitLabel = 'Codex app-server auth required';
        item.realtimeLimit = {
          generatedAt: new Date().toISOString(),
          primary: null,
          secondary: null,
          error: 'Codex app-server is not authenticated for quota reads.',
        };
      }
      realtimeErrors.push(`${item.email}: ${message}`);
    }
  }));

  return {
    generatedAt: new Date().toISOString(),
    source: 'codex-app-server-rate-limits + local-session-logs',
    activeAccount: config?.auth?.order?.openai?.[0] || config?.auth?.order?.['openai-codex']?.[0] || '',
    activeCodexAccounts,
    order: config?.auth?.order?.openai || config?.auth?.order?.['openai-codex'] || [],
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
      sessions: sessionsMatch?.[1]?.split('·')?.[0]?.trim() || 'see raw status',
      tasks: tasksMatch?.[1]?.split('·')?.[0]?.trim() || (tasks.ok ? 'task command ok' : 'task command unavailable'),
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
      'Goal Orchestrator agent cockpit live in v1.5',
      'Visual Agent Office workspace live in v1.5.1',
      'DAG Orchestration View from Synapse reference review live in v1.6',
      'Vibe Graph Draft from MASFactory reference review live in v1.7',
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
  if (url.pathname === BASE_PATH) {
    res.writeHead(302, { Location: `${BASE_PATH}/` });
    res.end();
    return;
  }
  if (url.pathname.startsWith(`${BASE_PATH}/`)) {
    url.pathname = url.pathname.slice(BASE_PATH.length) || '/';
  }
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
  if (url.pathname === '/api/telegram-health') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('telegram-health', TTL.telegramHealth, collectTelegramHealth, url.searchParams.get('refresh') === '1'))); }
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
  if (url.pathname === '/api/codex-account-switch') {
    try {
      const accountId = url.searchParams.get('account');
      const restartGateway = url.searchParams.get('restart') !== '0';
      const result = await switchCodexAccount(accountId, restartGateway);
      send(res, result.ok ? 200 : 207, 'application/json', JSON.stringify(result));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ ok: false, error: e?.message || String(e) }));
    }
    return;
  }
  if (url.pathname === '/api/gemma-quota') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('gemma-quota', TTL.gemmaQuota, collectGemmaQuota, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e?.message || String(e) })); }
    return;
  }
  if (url.pathname === '/api/minimax-quota') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('minimax-quota', TTL.minimaxQuota, collectMinimaxQuota, url.searchParams.get('refresh') === '1'))); }
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
  if (url.pathname === '/api/context-budget') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('context-budget', TTL.contextBudget, collectContextBudget, url.searchParams.get('refresh') === '1'))); }
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
  if (url.pathname === '/api/active-work') {
    try {
      send(res, 200, 'application/json', JSON.stringify(await collectActiveWork()));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/skill-registry') {
    try {
      if (url.searchParams.get('refresh') === '1') {
        await run('python3', [NOVA_SKILL_REGISTRY_SCRIPT], 30000);
      }
      const registry = await readJsonFile(NOVA_SKILL_REGISTRY_JSON);
      const evalFlywheel = await readJsonFile(NOVA_EVAL_FLYWHEEL_JSON);
      const latestEvalResult = await readJsonFile(NOVA_LATEST_EVAL_RESULT_JSON);
      send(res, 200, 'application/json', JSON.stringify({
        ok: Boolean(registry),
        generatedAt: registry?.generatedAt || null,
        registry,
        evalFlywheel,
        latestEvalResult,
      }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ ok: false, error: e.message }));
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
  if (url.pathname === '/api/run-verification') {
    try {
      const taskId = `manual-verify-${Date.now()}`;
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-verify-task');
      const result = await run('python3', [
        scriptPath,
        taskId,
        '--summary',
        'Tactical manual verification from Commander Cockpit',
      ], 45000);
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, taskId, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-supervisor') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-supervisor');
      const result = await run('python3', [scriptPath, '--apply', '--json'], 45000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-worker') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-run-worker');
      const taskId = url.searchParams.get('taskId');
      const args = [scriptPath, '--apply', '--json'];
      if (taskId) args.push('--task-id', taskId);
      const result = await run('python3', args, 45000);
      cache.delete('team-control');
      let session = null;
      try { session = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, session, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/approve-task') {
    try {
      const taskId = url.searchParams.get('taskId');
      if (!taskId) throw new Error('taskId is required');
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-approve');
      const result = await run('python3', [scriptPath, taskId, '--approved-by', 'Nick', '--reason', 'Approved from Commander / Telegram request to complete supervised multi-agent runtime.'], 45000);
      cache.delete('team-control');
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-low-risk-worker-execution') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-low-risk-execute');
      const args = [scriptPath, '--apply', '--json'];
      const taskId = url.searchParams.get('taskId');
      const role = url.searchParams.get('role');
      if (taskId) args.push('--task-id', taskId);
      if (role) args.push('--role', role);
      const result = await run('python3', args, 120000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-qa-closeout') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-qa-closeout');
      const result = await run('python3', [scriptPath, '--apply', '--json'], 45000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-quality-review') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-quality-review');
      const args = [scriptPath, '--apply', '--json'];
      const taskId = url.searchParams.get('taskId');
      if (taskId) args.push('--task-id', taskId);
      if (url.searchParams.get('backfill') === '1') args.push('--backfill-done');
      const result = await run('python3', args, 45000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-session-status') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-session-status');
      const result = await run('python3', [scriptPath, '--apply', '--json'], 45000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-doctor') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-doctor');
      const result = await run('python3', [scriptPath, '--apply', '--json'], 45000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-autopilot') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-autopilot');
      const result = await run('python3', [scriptPath, '--apply', '--json'], 120000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
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
  if (url.pathname === '/api/agents') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('agents', TTL.agents, collectAgents, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/team-control') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('team-control', TTL.teamControl, collectTeamControl, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/multiagent-runtime') {
    try { send(res, 200, 'application/json', JSON.stringify(await collectMultiagentRuntime())); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }

  if (url.pathname === '/api/multiagent-trace') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-trace');
      const taskId = url.searchParams.get('taskId');
      const args = [scriptPath, '--json', '--write'];
      if (taskId) args.push('--task-id', taskId);
      const result = await run('python3', args, 45000);
      let trace = null;
      try { trace = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, trace, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/task-templates') {
    try { send(res, 200, 'application/json', JSON.stringify(await readJsonFile(MULTIAGENT_TASK_TEMPLATES_JSON) || { templates: [] })); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/create-template-task') {
    try {
      const templateId = url.searchParams.get('templateId');
      if (!templateId) throw new Error('templateId is required');
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-template');
      const args = [scriptPath, 'create', templateId, '--json'];
      for (const [key, value] of url.searchParams.entries()) {
        if (key === 'templateId') continue;
        if (['title', 'objective', 'priority', 'risk', 'role'].includes(key)) args.push(`--${key}`, value);
        else args.push('--input', `${key}=${value}`);
      }
      const result = await run('python3', args, 45000);
      cache.delete('team-control');
      let created = null;
      try { created = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, created, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-review') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-review');
      const taskId = url.searchParams.get('taskId');
      const args = [scriptPath, '--apply', '--json'];
      if (taskId) args.push('--task-id', taskId, '--all');
      const result = await run('python3', args, 45000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-watch') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-watch');
      const args = [scriptPath, '--apply', '--json'];
      if (url.searchParams.get('autopilot') === '1') args.push('--autopilot-on-watch');
      if (url.searchParams.get('autoTasks') !== '0') args.push('--auto-create-low-risk-tasks');
      const result = await run('python3', args, 90000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-workspace-evidence') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-workspace-evidence');
      const args = [scriptPath, '--apply', '--json'];
      const taskId = url.searchParams.get('taskId');
      const workspacePath = url.searchParams.get('workspacePath');
      const previewUrl = url.searchParams.get('previewUrl');
      if (taskId) args.push('--task-id', taskId);
      if (workspacePath) args.push('--workspace-path', workspacePath);
      if (previewUrl) args.push('--preview-url', previewUrl);
      if (url.searchParams.get('all') === '1') args.push('--all');
      const result = await run('python3', args, 90000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-token-attribution') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-token-attribution');
      const result = await run('python3', [scriptPath, '--apply', '--json'], 90000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-trust-score') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-trust-score');
      const result = await run('python3', [scriptPath, '--apply', '--json'], 90000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/run-ui-design-audit') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-ui-design-audit');
      const result = await run('python3', [scriptPath, '--apply', '--json'], 90000);
      cache.delete('team-control');
      let report = null;
      try { report = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, report, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/multiagent-audit-export') {
    try {
      const scriptPath = path.join(WORKSPACE, 'bin', 'nova-agent-audit-export');
      const result = await run('python3', [scriptPath, '--apply', '--json'], 90000);
      cache.delete('team-control');
      let manifest = null;
      try { manifest = JSON.parse(result.output); } catch {}
      send(res, 200, 'application/json', JSON.stringify({ ok: result.ok, manifest, output: result.output }));
    } catch (e) {
      send(res, 500, 'application/json', JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (url.pathname === '/api/active-tasks') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('active-tasks', TTL.activeTasks, collectActiveTasks, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/active-sessions') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('active-sessions', TTL.activeSessions, collectActiveSessions, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
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
