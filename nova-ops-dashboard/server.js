const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { readHarnessSnapshot, toPublicHarnessSnapshot } = require('./lib/harness-snapshot');
const { readTailLines } = require('./lib/bounded-tail');
const {
  atomicWritePrivateJson,
  durationSetting,
  sanitizeJobRunsSnapshot,
  sanitizeStatusSnapshot,
  snapshotFreshness,
} = require('./lib/public-status');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const CLAUDE_CONTEXT_DIR = path.join(PUBLIC, 'claude-context');
const CLAUDE_CONTEXT_ENV = path.join(ROOT, 'data', '.env-claude-context');

// Load Nova → Claude Code auth token from .env-claude-context (chmod 600).
// Used to gate /claude-context/* so Cloudflare's AI-bot WAF (which blocks
// `Anthropic/Claude` User-Agent) doesn't fire — Claude Code uses Bash + curl
// with this token instead of WebFetch, since curl's UA bypasses the WAF.
function loadClaudeContextToken() {
  try {
    const text = fs.readFileSync(CLAUDE_CONTEXT_ENV, 'utf8');
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^NOVA_CLAUDE_CONTEXT_TOKEN=(.+)$/);
      if (m) return m[1].trim();
    }
  } catch {}
  return process.env.NOVA_CLAUDE_CONTEXT_TOKEN || null;
}
const CLAUDE_CONTEXT_TOKEN = loadClaudeContextToken();

function checkClaudeAuth(req, urlObj) {
  if (!CLAUDE_CONTEXT_TOKEN) return false;
  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m && m[1].trim() === CLAUDE_CONTEXT_TOKEN) return true;
  if ((req.headers['x-nova-token'] || '') === CLAUDE_CONTEXT_TOKEN) return true;
  const qToken = urlObj.searchParams.get('token');
  if (qToken && qToken === CLAUDE_CONTEXT_TOKEN) return true;
  return false;
}
const WORKSPACE = '/Users/nova/.openclaw/workspace';
const PORT = Number(process.env.NOVA_OPS_PORT || 18888);
const BASE_PATH = '/novaops';
const OPENCLAW = '/opt/homebrew/bin/openclaw';
const HARNESS = path.join(WORKSPACE, 'nova-harness', 'nova-harness');
const SUPPORT_DIGEST_EXPORT = path.join(WORKSPACE, 'grafana-dashboards', 'export_support_digest_data.py');
const SUPPORT_DIGEST_JSON = path.join(PUBLIC, 'data', 'support_digest.json');
const STATUS_SNAPSHOT_JSON = process.env.NOVA_OPS_STATUS_SNAPSHOT_JSON || '/Users/nova/.openclaw/state/nova-ops-dashboard/status_snapshot.json';
const JOB_RUNS_SNAPSHOT_JSON = process.env.NOVA_OPS_JOB_RUNS_SNAPSHOT_JSON || '/Users/nova/.openclaw/state/nova-ops-dashboard/job_runs_snapshot.json';
const TELEMETRY_REFRESH_INTERVAL_MS = durationSetting(process.env.NOVA_OPS_TELEMETRY_REFRESH_INTERVAL_MS, 60_000, 15_000);
const STATUS_SNAPSHOT_STALE_MS = durationSetting(process.env.NOVA_OPS_STATUS_SNAPSHOT_STALE_MS, 120_000, 30_000);
const JOB_RUNS_SNAPSHOT_STALE_MS = durationSetting(process.env.NOVA_OPS_JOB_RUNS_SNAPSHOT_STALE_MS, 300_000, 60_000);
const TELEMETRY_PRODUCER_DISABLED = process.env.NOVA_OPS_DISABLE_TELEMETRY_PRODUCER === '1';
const ACTIVE_WORK_MD = path.join(WORKSPACE, 'ACTIVE_WORK.md');
const STARTUP_BACKLOG_JSON = path.join(WORKSPACE, '.gnap', 'startup-backlog.json');
const STARTUP_TASKS_DIR = path.join(WORKSPACE, '.gnap', 'tasks');
const AUTO_BACKLOG_JSON = path.join(WORKSPACE, 'nova-skill-os', 'backlog.json');
const AUTO_STATE_JSON = '/Users/nova/.openclaw/state/auto-executor/state.json';
const AUTO_RESULTS_DIR = '/Users/nova/.openclaw/state/auto-executor/results';
const AUTO_SPAWN_QUEUE_DIR = '/Users/nova/.openclaw/state/auto-executor/spawn-queue';
const AUTO_LOG = path.join(WORKSPACE, 'logs', 'auto-executor.log');
const BROWSER_RUNS_DIR = '/Users/nova/.openclaw/state/browser-runs';
const BROWSER_RUNS_INDEX_JSON = path.join(BROWSER_RUNS_DIR, 'index.json');
const NOVA_EVENTS_JSONL = path.join(WORKSPACE, 'events', 'nova-events.jsonl');
const NOVA_PROPOSALS_JSON = path.join(WORKSPACE, 'data', 'nova-proposals.json');
const NOVA_SKILL_REGISTRY_SCRIPT = path.join(WORKSPACE, 'nova-skill-os', 'skill_registry.py');
const NOVA_SKILL_REGISTRY_JSON = path.join(WORKSPACE, 'nova-skill-os', 'out', 'skill-registry.json');
const NOVA_EVAL_FLYWHEEL_JSON = path.join(WORKSPACE, 'nova-skill-os', 'out', 'eval-flywheel.json');
const NOVA_LATEST_EVAL_RESULT_JSON = path.join(WORKSPACE, 'nova-skill-os', 'out', 'latest-eval-result.json');
const CLASSIFIER_DECISIONS_DIR = path.join(WORKSPACE, 'data', 'classifier-decisions');
const TELEGRAM_BRIDGE_LOG = path.join(WORKSPACE, 'logs', 'telegram-bridge.out.log');
const N8N_DIR = path.join(WORKSPACE, 'n8n');
const OPENCLAW_CONFIG_JSON = '/Users/nova/.openclaw/openclaw.json';
const OPENCLAW_AUTH_PROFILES_JSON = '/Users/nova/.openclaw/agents/main/agent/auth-profiles.json';
const OPENCLAW_AGENT_SQLITE = '/Users/nova/.openclaw/agents/main/agent/openclaw-agent.sqlite';
const OPENCLAW_SESSIONS_DIR = '/Users/nova/.openclaw/agents/main/sessions';
const NOVA_CONTEXT_SLIMMER = path.join(WORKSPACE, 'bin', 'nova-context-slimmer');
const NOVA_HOT_MEMORY = path.join(WORKSPACE, 'bin', 'nova-hot-memory');
const PY_GOOGLE = path.join(WORKSPACE, '.venv-google', 'bin', 'python');
const GRAFANA_BRIDGE = path.join(WORKSPACE, 'grafana-openclaw-bridge');
const COUPON_ALERT_SCRIPT = path.join(GRAFANA_BRIDGE, 'coupon_points_issue_alert.py');
const LAUNCHER_WATCHDOG_STATE_JSON = '/Users/nova/.openclaw/state/launcher-watchdog/state.json';
const LAUNCHER_WATCHDOG_LOG = path.join(WORKSPACE, 'logs', 'launcher-watchdog.out.log');
const COUPON_ALERT_STATE_JSON = '/Users/nova/.openclaw/state/grafana-openclaw-bridge/coupon-points-issue-alert.json';
const COUPON_ALERT_OUT_LOG = path.join(WORKSPACE, 'logs', 'coupon-points-issue-alert.out.log');
const DISCORD_ORDER_SCRIPT = path.join(WORKSPACE, 'discord-alert-forwarder', 'forward_prod_order_alerts.py');
const DISCORD_ORDER_STATE_JSON = '/Users/nova/.openclaw/state/discord-alert-forwarder/prod-order-monitor-state.json';
const DISCORD_ORDER_OUT_LOG = '/tmp/openclaw-discord-prod-order-forwarder.out.log';
const DISCORD_ORDER_JSONL = path.join(WORKSPACE, 'discord-alert-forwarder', 'data', 'prod_order_alerts.jsonl');
const REPO_REVIEW_QUEUE_JSON = path.join(WORKSPACE, 'research', 'repo-review-queue', 'queue.json');
const CHEAP_REPO_REVIEWS_DIR = path.join(WORKSPACE, 'research', 'cheap-repo-reviews');
const VERIFICATION_DIR = path.join(WORKSPACE, 'outputs', 'verification');
const MULTIAGENT_RUNTIME_JSON = path.join(WORKSPACE, 'data', 'multiagent-runtime.json');
const MULTIAGENT_WORKER_PROFILES_JSON = path.join(WORKSPACE, 'data', 'multiagent-worker-profiles.json');
const MULTIAGENT_TASK_TEMPLATES_JSON = path.join(WORKSPACE, 'data', 'multiagent-task-templates.json');
const MULTIAGENT_DASHBOARD_REPO_MATRIX_JSON = path.join(WORKSPACE, 'data', 'multiagent-dashboard-repo-matrix.json');
const MULTIAGENT_WATCH_PLIST = '/Users/nova/Library/LaunchAgents/ai.openclaw.nova-agent-watch.plist';
const LIFE_COMMAND_CENTER_JSON = path.join(WORKSPACE, 'data', 'life-command-center.json');
const LIFE_INBOX_BIN = path.join(WORKSPACE, 'bin', 'nova-life-inbox');
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
const isTelemetryRefreshCmd = args[0] === 'refresh-telemetry';
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
  minimaxQuota: 30000,
  tokenSessions: 30000,
  contextBudget: 30000,
  jobRuns: 30000,
  opsLedger: 10000,
  alertQuality: 30000,
  novaEvents: 5000,
  proposals: 5000,
  classifierStats: 5000,
  lifeCommand: 10000,
  teamControl: 10000,
  agents: 30000,
  activeTasks: 5000,
  activeSessions: 5000,
  startup: 5000,
  autoCron: 5000,
  browserRuns: 5000,
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
    execFile(cmd, args, { timeout, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, ...(options.env || {}) } }, (error, stdout, stderr) => {
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

async function readJsonFile(file) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function readTextTail(file, lines = 20) {
  try {
    const text = await fsp.readFile(file, 'utf8');
    return text.trim().split('\n').slice(-lines);
  } catch {
    return [];
  }
}

async function listRecentFiles(dir, limit = 8, ext = '') {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries
      .filter(entry => entry.isFile() && (!ext || entry.name.endsWith(ext)))
      .map(async entry => {
        const file = path.join(dir, entry.name);
        const stat = await fsp.stat(file);
        return { name: entry.name, path: file, mtimeMs: stat.mtimeMs, size: stat.size };
      }));
    return files.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit);
  } catch {
    return [];
  }
}

async function collectAutoCron() {
  const [backlog, state, logLines, resultFiles, spawnFiles] = await Promise.all([
    readJsonFile(AUTO_BACKLOG_JSON),
    readJsonFile(AUTO_STATE_JSON),
    readTextTail(AUTO_LOG, 12),
    listRecentFiles(AUTO_RESULTS_DIR, 8, '.md'),
    listRecentFiles(AUTO_SPAWN_QUEUE_DIR, 8, '.json'),
  ]);
  const items = Array.isArray(backlog?.items) ? backlog.items : [];
  const counts = items.reduce((acc, item) => {
    const status = item.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const active = items
    .filter(item => ['picked', 'in_progress', 'blocked', 'partial'].includes(item.status) || item.awaiting_human_review)
    .sort((a, b) => String(b.completed_at || b.started_at || b.picked_at || b.added || '').localeCompare(String(a.completed_at || a.started_at || a.picked_at || a.added || '')))
    .slice(0, 10);
  const quality = {
    reviewed: items.filter(item => item.quality_review).length,
    downgraded: items.filter(item => item.quality_review && item.quality_review.status === 'partial').length,
    weakDone: items.filter(item => item.status === 'done' && item.quality_review && item.quality_review.passed === false).length,
  };
  const spawnedToday = spawnFiles.filter(file => new Date(file.mtimeMs).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
  return {
    generatedAt: new Date().toISOString(),
    source: {
      backlog: AUTO_BACKLOG_JSON,
      state: AUTO_STATE_JSON,
      log: AUTO_LOG,
      resultsDir: AUTO_RESULTS_DIR,
      spawnQueueDir: AUTO_SPAWN_QUEUE_DIR,
    },
    counts,
    state: state || {},
    summary: {
      total: items.length,
      pending: counts.pending || 0,
      active: (counts.picked || 0) + (counts.in_progress || 0),
      blocked: counts.blocked || 0,
      done: counts.done || 0,
      picksToday: state?.count_today || 0,
      dailyPickLimit: 3,
      spawnedToday,
      openDoorCounter: state?.consecutive_done_without_review || 0,
      openDoorThreshold: state?.open_door_threshold || 5,
    },
    quality,
    active,
    recentResults: resultFiles.map(file => ({ ...file, updatedAt: new Date(file.mtimeMs).toISOString() })),
    recentSpawns: spawnFiles.map(file => ({ ...file, updatedAt: new Date(file.mtimeMs).toISOString() })),
    logLines,
  };
}

function isSafeBrowserRunId(id) {
  return /^[A-Za-z0-9_-]{1,100}$/.test(String(id || ''));
}

async function collectBrowserRuns() {
  const index = await readJsonFile(BROWSER_RUNS_INDEX_JSON);
  const runs = Array.isArray(index?.runs) ? index.runs : [];
  const items = await Promise.all(runs.slice(0, 12).map(async run => {
    const id = String(run.id || '');
    if (!isSafeBrowserRunId(id)) return null;
    const runDir = path.join(BROWSER_RUNS_DIR, id);
    const manifest = await readJsonFile(path.join(runDir, 'manifest.json'));
    const resultTail = await readTextTail(path.join(runDir, 'result.md'), 8);
    return {
      ...run,
      manifestOk: Boolean(manifest),
      status: manifest?.status || run.status || 'unknown',
      title: manifest?.title || run.title || id,
      url: manifest?.url || run.url || '',
      updatedAt: manifest?.updatedAt || run.updatedAt,
      toolCallCount: Array.isArray(manifest?.toolCalls) ? manifest.toolCalls.length : run.toolCallCount || 0,
      screenshotCount: Array.isArray(manifest?.screenshots) ? manifest.screenshots.length : run.screenshotCount || 0,
      resultTail,
    };
  }));
  const cleanItems = items.filter(Boolean);
  const counts = cleanItems.reduce((acc, run) => {
    const status = run.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  return {
    generatedAt: new Date().toISOString(),
    source: {
      dir: BROWSER_RUNS_DIR,
      index: BROWSER_RUNS_INDEX_JSON,
      cli: path.join(WORKSPACE, 'bin', 'nova-browser-artifact'),
    },
    summary: {
      total: runs.length,
      shown: cleanItems.length,
      done: counts.done || 0,
      failed: counts.failed || 0,
      live: counts.live || 0,
      partial: counts.partial || 0,
    },
    items: cleanItems,
  };
}

// Newer OpenClaw versions (2026.5+) migrate the auth profile store into the
// agent SQLite database. When the legacy auth-profiles.json disappears we
// transparently read the same shape back from `auth_profile_store` so that
// quota cards keep showing the real OAuth profile.
let sqliteReaderPromise = null;
function readAuthProfilesFromSqliteSync() {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch {
    return null;
  }
  let db;
  try {
    db = new DatabaseSync(OPENCLAW_AGENT_SQLITE, { readOnly: true });
    const row = db.prepare("SELECT store_json FROM auth_profile_store WHERE store_key = 'primary'").get();
    if (!row || !row.store_json) return null;
    const parsed = JSON.parse(row.store_json);
    if (!parsed || typeof parsed !== 'object' || !parsed.profiles) return null;
    return { profiles: parsed.profiles };
  } catch (e) {
    console.warn('[nova-ops] readAuthProfilesFromSqlite failed:', e?.message || e);
    return null;
  } finally {
    try { db?.close(); } catch {}
  }
}

async function readAuthProfiles() {
  const json = await readJsonFile(OPENCLAW_AUTH_PROFILES_JSON);
  if (json && json.profiles && Object.keys(json.profiles).length) return json;
  try {
    if (!sqliteReaderPromise) sqliteReaderPromise = Promise.resolve();
    const fromSqlite = await sqliteReaderPromise.then(readAuthProfilesFromSqliteSync);
    if (fromSqlite) return fromSqlite;
  } catch {}
  return { profiles: {} };
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

async function collectStartupLoop() {
  const backlog = await readJsonFile(STARTUP_BACKLOG_JSON) || { items: [] };
  const items = Array.isArray(backlog.items) ? backlog.items : [];
  const counts = items.reduce((acc, item) => {
    const status = item.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const tasks = await Promise.all(items.map(async item => {
    const taskId = item.id;
    const taskDir = taskId ? path.join(STARTUP_TASKS_DIR, taskId) : '';
    const meta = taskId ? await readJsonFile(path.join(taskDir, 'task.json')) : null;
    const artifacts = taskId ? await Promise.all([
      'task.brief.md',
      'delivery.plan.md',
      'architecture.review.md',
      'implementation.report.md',
      'qa.verdict.md',
      'release.checklist.md',
      'definition-of-done.md',
    ].map(async name => {
      try {
        const stat = await fsp.stat(path.join(taskDir, name));
        return { name, exists: true, updatedAt: stat.mtime.toISOString() };
      } catch {
        return { name, exists: false };
      }
    })) : [];
    const requiredArtifacts = meta?.artifacts || [];
    const missingRequired = requiredArtifacts.filter(name => !artifacts.find(a => a.name === name && a.exists));
    return {
      ...item,
      meta,
      artifacts,
      requiredArtifacts,
      dodReady: missingRequired.length === 0 && artifacts.some(a => a.name === 'definition-of-done.md' && a.exists),
      missingRequired,
      path: taskId ? path.join('.gnap', 'tasks', taskId) : '',
    };
  }));
  const order = { now: 0, blocked: 1, next: 2, later: 3, done: 4 };
  tasks.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  return {
    generatedAt: new Date().toISOString(),
    source: STARTUP_BACKLOG_JSON.replace(WORKSPACE + '/', ''),
    updatedAt: backlog.updated_at || null,
    counts,
    total: items.length,
    tasks: tasks.slice(0, 12),
    commands: [
      'bin/nova-startup plan "<title>" --type frontend',
      'bin/nova-startup review',
      'bin/nova-startup dod <task-id>',
    ],
  };
}

async function collectNovaEvents(limit = 80) {
  let lines = [];
  try {
    const text = await fsp.readFile(NOVA_EVENTS_JSONL, 'utf8');
    lines = text.split('\n').filter(Boolean);
  } catch {}
  const events = [];
  for (const line of lines.slice(-limit * 2)) {
    try {
      const event = JSON.parse(line);
      events.push(event);
    } catch {}
  }
  events.sort((a, b) => Date.parse(b.ts || 0) - Date.parse(a.ts || 0));
  const recent = events.slice(0, limit);
  const summary = recent.reduce((acc, event) => {
    const status = event.status || 'info';
    acc[status] = (acc[status] || 0) + 1;
    acc.total += 1;
    return acc;
  }, { total: 0, healthy: 0, warning: 0, critical: 0, info: 0 });
  return {
    generatedAt: new Date().toISOString(),
    source: NOVA_EVENTS_JSONL.replace(WORKSPACE + '/', ''),
    exists: fs.existsSync(NOVA_EVENTS_JSONL),
    summary,
    events: recent,
  };
}

async function collectProposals() {
  const data = await readJsonFile(NOVA_PROPOSALS_JSON) || { version: 1, items: [] };
  const items = Array.isArray(data.items) ? data.items : [];
  const summary = items.reduce((acc, item) => {
    const status = item.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    acc.total += 1;
    return acc;
  }, { total: 0, proposed: 0, accepted: 0, rejected: 0, deferred: 0 });
  const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const statusOrder = { accepted: 0, proposed: 1, deferred: 2, rejected: 3 };
  items.sort((a, b) =>
    (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
    (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9) ||
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
  return {
    generatedAt: new Date().toISOString(),
    source: NOVA_PROPOSALS_JSON.replace(WORKSPACE + '/', ''),
    updatedAt: data.updatedAt || null,
    summary,
    items,
  };
}

async function collectClassifierStats(limit = 50) {
  // Read append-only JSONL audit log from classifier-shadow (PoC)
  let allDecisions = [];
  try {
    if (!fs.existsSync(CLASSIFIER_DECISIONS_DIR)) {
      return {
        generatedAt: new Date().toISOString(),
        source: 'data/classifier-decisions/',
        exists: false,
        summary: { total: 0, tier1: 0, tier2: 0, tier3: 0, allowStage1: 0, allowStage2: 0, allowNoClassifier: 0, blockShadow: 0, flagShadow: 0, failSoft: 0 },
        recent: [],
      };
    }
    const files = (await fsp.readdir(CLASSIFIER_DECISIONS_DIR))
      .filter(f => f.endsWith('.jsonl'))
      .sort();
    for (const file of files) {
      const text = await fsp.readFile(path.join(CLASSIFIER_DECISIONS_DIR, file), 'utf8');
      const lines = text.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          allDecisions.push(JSON.parse(line));
        } catch {}
      }
    }
    allDecisions.sort((a, b) => Date.parse(b.ts || 0) - Date.parse(a.ts || 0));
  } catch (e) {
    return {
      generatedAt: new Date().toISOString(),
      source: 'data/classifier-decisions/',
      exists: false,
      error: e.message,
      summary: { total: 0 },
      recent: [],
    };
  }

  const summary = allDecisions.reduce((acc, d) => {
    acc.total = (acc.total || 0) + 1;
    const tier = d.tier;
    if (tier === 1) acc.tier1 = (acc.tier1 || 0) + 1;
    else if (tier === 2) acc.tier2 = (acc.tier2 || 0) + 1;
    else if (tier === 3) acc.tier3 = (acc.tier3 || 0) + 1;
    const action = d.shadow_action || 'unknown';
    if (action === 'ALLOW_STAGE1') acc.allowStage1 = (acc.allowStage1 || 0) + 1;
    else if (action === 'ALLOW_STAGE2') acc.allowStage2 = (acc.allowStage2 || 0) + 1;
    else if (action === 'ALLOW_NO_CLASSIFIER') acc.allowNoClassifier = (acc.allowNoClassifier || 0) + 1;
    else if (action === 'BLOCK_SHADOW') acc.blockShadow = (acc.blockShadow || 0) + 1;
    else if (action === 'FLAG_SHADOW') acc.flagShadow = (acc.flagShadow || 0) + 1;
    else acc.failSoft = (acc.failSoft || 0) + 1;
    return acc;
  }, { total: 0, tier1: 0, tier2: 0, tier3: 0, allowStage1: 0, allowStage2: 0, allowNoClassifier: 0, blockShadow: 0, flagShadow: 0, failSoft: 0 });

  const recent = allDecisions.slice(0, limit).map(d => ({
    ts: d.ts,
    tool: d.tool,
    args_preview: d.args_preview,
    tier: d.tier,
    shadow_action: d.shadow_action,
    stage1_reason: d.stage1?.reason,
    stage2_verdict: d.stage2?.verdict,
  }));

  return {
    generatedAt: new Date().toISOString(),
    source: 'data/classifier-decisions/',
    exists: true,
    summary,
    recent,
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
    const tailLines = await readTailLines(file, lines);
    return tailLines.map(line => {
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
  return toPublicHarnessSnapshot(await readHarnessSnapshot());
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
  try {
    return parseJsonOutput(result.stdout || result.output);
  } catch (parseError) {
    if (!result.ok) throw new Error('Failed to run tasks list: ' + (parseError.message || result.output));
    throw parseError;
  }
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

function normalizeAttention(item = {}) {
  if (item.status === 'needs_approval' || item.approvalRequired) return 'approval';
  if (item.status === 'blocked' || item.status === 'failed') return 'failed';
  if (item.status === 'running') return 'active';
  if (item.status === 'done' && (!Array.isArray(item.evidence) || item.evidence.length === 0)) return 'no_evidence';
  return 'none';
}

function normalizeRisk(item = {}) {
  const raw = String(item.risk || '').toLowerCase();
  if (/production|prod/.test(raw)) return 'production';
  if (/credential|secret|token/.test(raw)) return 'credential';
  if (/destructive|delete|remove/.test(raw)) return 'destructive';
  if (/external|send|publish/.test(raw)) return 'external';
  if (/paid|billing/.test(raw)) return 'paid';
  return raw || 'local';
}

function phaseFromStatus(status = '') {
  if (status === 'queued' || status === 'assigned') return 'plan';
  if (status === 'running' || status === 'handoff') return 'implement';
  if (status === 'verification' || status === 'quality_review') return 'verify';
  if (status === 'done') return 'summarize';
  if (status === 'blocked' || status === 'needs_approval') return 'waiting';
  return 'explore';
}

async function collectCommandCenter() {
  const team = await collectTeamControl();
  const runtime = team.runtime || {};
  const runtimeSummary = runtime.summary || {};
  const queue = Array.isArray(runtime.queue) ? runtime.queue : [];
  const sessions = Array.isArray(team.live?.sessions) ? team.live.sessions : [];
  const reports = Array.isArray(team.reports) ? team.reports : [];

  const queueAgents = queue.slice(0, 12).map(task => {
    const status = task.status || 'unknown';
    const evidence = Array.isArray(task.evidence) ? task.evidence : [];
    return {
      id: task.taskId || task.id || task.title || 'runtime-task',
      role: task.assignedRole || 'Worker',
      state: status,
      phase: phaseFromStatus(status),
      taskId: task.taskId || task.id || '',
      title: task.title || task.objective || 'Untitled runtime task',
      attention: normalizeAttention(task),
      risk: normalizeRisk(task),
      ageMs: task.updatedAt ? Date.now() - Date.parse(task.updatedAt) : null,
      model: task.spawn_model || task.model || '',
      evidence: evidence.slice(0, 4),
    };
  });

  const sessionAgents = sessions.slice(0, Math.max(0, 12 - queueAgents.length)).map(session => ({
    id: session.key || session.id || session.session || 'session',
    role: session.kind === 'cron' ? 'Cron Agent' : session.kind === 'direct' ? 'Direct Agent' : 'Agent',
    state: session.age === 'just now' ? 'running' : 'idle',
    phase: session.kind === 'cron' ? 'summarize' : 'waiting',
    taskId: session.key || '',
    title: session.summary || session.key || 'OpenClaw session',
    attention: 'none',
    risk: 'local',
    ageMs: null,
    model: session.model || '',
    evidence: [],
  }));

  const agents = [...queueAgents, ...sessionAgents];
  const approvals = queue
    .filter(task => task.status === 'needs_approval' || task.approvalRequired)
    .slice(0, 8)
    .map(task => ({
      id: task.taskId || task.id || task.title,
      title: task.title || task.objective || 'Approval required',
      role: task.assignedRole || 'Worker',
      risk: normalizeRisk(task),
      reason: task.block_reason || task.objective || task.nextAction || 'Waiting for human approval.',
      evidence: Array.isArray(task.evidence) ? task.evidence.slice(0, 3) : [],
    }));

  const failedReports = reports.filter(report => !report.passed);
  const blocked = (runtimeSummary.blocked || 0) + failedReports.length;
  const posture = approvals.length ? 'needs_approval' : blocked ? 'blocked' : (runtimeSummary.running || team.summary?.runningTasks) ? 'watch' : 'healthy';
  const nextActions = [
    approvals.length ? 'Review approval inbox before starting more agent work.' : null,
    blocked ? 'Open failed or blocked items and inspect evidence before retry.' : null,
    !agents.length ? 'No active fleet telemetry yet; keep Command Center in read-only monitor mode.' : null,
    'Keep third-party orchestration tools reference-only until source, license, and telemetry are reviewed.',
  ].filter(Boolean);

  return {
    ...team,
    generatedAt: new Date().toISOString(),
    mode: 'command center read-only mvp',
    commandCenter: {
      posture,
      summary: {
        agents: agents.length,
        activeAgents: agents.filter(agent => ['running', 'handoff', 'verification', 'quality_review'].includes(agent.state)).length,
        runningTasks: runtimeSummary.running || team.summary?.runningTasks || 0,
        pendingApprovals: approvals.length,
        evidenceReports: reports.length,
        failedReports: failedReports.length,
      },
      agents,
      approvals,
      nextActions,
      latestEvidence: reports.slice(0, 6).map(report => ({
        title: report.taskId || report.file,
        path: report.path,
        passed: Boolean(report.passed),
        generatedAt: report.generatedAt,
      })),
      safety: [
        'read-only by default',
        'external/destructive/credential/paid/production actions require approval',
        'done requires evidence or explicit verification note',
        'third-party systems remain reference-only for this MVP',
      ],
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
  const snapshotAvailable = harness.snapshot?.available === true;
  const snapshotStale = snapshotAvailable && harness.snapshot?.stale === true;
  const harnessStatus = !snapshotAvailable
    ? 'unknown'
    : snapshotStale
      ? 'warning'
      : harnessStatusToHealth(harness.overall);
  const snapshotEvidence = !snapshotAvailable
    ? 'snapshot unavailable'
    : `${snapshotStale ? 'stale' : 'fresh'} snapshot · age ${harness.snapshot?.ageMs ?? 'unknown'}ms`;
  const jobs = [
    ...cronJobs,
    {
      id: 'quality-nova-harness',
      name: 'Nova Harness quality gate',
      source: 'local harness',
      category: 'quality gate',
      status: harnessStatus,
      statusLabel: !snapshotAvailable ? 'NO SNAPSHOT' : `${(harness.overall || 'unknown').toUpperCase()}${snapshotStale ? ' · STALE' : ''}`,
      schedule: 'Explicit: bin/nova-harness-eval-run',
      nextRunAt: '',
      evidence: (harness.failed || 0) + ' failed · ' + (harness.warned || 0) + ' warnings · ' + snapshotEvidence,
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
    statusLabel: !snapshotAvailable ? 'snapshot unavailable' : `${harness.overall || 'unknown'}${snapshotStale ? ' · stale' : ''}`,
    startedAt: harness.generated_at || harness.generatedAt || '',
    completedAt: harness.generated_at || harness.generatedAt || '',
    durationLabel: 'aggregate snapshot',
    evidence: harness.error || ((harness.failed || 0) + ' failed · ' + (harness.warned || 0) + ' warnings · ' + snapshotEvidence),
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

function fileInfo(file) {
  try {
    const stat = fs.statSync(file);
    return {
      exists: true,
      path: file,
      mtime: stat.mtime.toISOString(),
      ageMs: Date.now() - stat.mtime.getTime(),
      sizeBytes: stat.size,
    };
  } catch {
    return { exists: false, path: file, mtime: '', ageMs: null, sizeBytes: 0 };
  }
}

async function readJsonlTail(file, limit = 20) {
  const lines = await readTailLines(file, Math.max(limit * 2, limit));
  return lines.slice(-limit).map(line => {
    try { return JSON.parse(line); }
    catch { return null; }
  }).filter(Boolean);
}

function healthFromAge(ageMs, warningMs, criticalMs) {
  if (!Number.isFinite(Number(ageMs))) return 'unknown';
  if (ageMs > criticalMs) return 'critical';
  if (ageMs > warningMs) return 'warning';
  return 'healthy';
}

function isoFromEpochSeconds(value) {
  const n = Number(value || 0);
  return n > 0 ? new Date(n * 1000).toISOString() : '';
}

function buildBackfillCommand(jobId, mode = 'dry-run') {
  if (jobId === 'coupon-points-issue-alert') {
    const suffix = mode === 'append-sheet' ? '--sheet-only' : '--dry-run';
    return `cd ${WORKSPACE} && GRAFANA_ENV_FILE=${path.join(GRAFANA_BRIDGE, '.env.amaze')} ${PY_GOOGLE} ${COUPON_ALERT_SCRIPT} --from <UTC_START_ISO> --to <UTC_END_ISO> ${suffix}`;
  }
  if (jobId === 'discord-prod-order-forwarder') {
    const env = [
      'ORDER_ALERT_AFTER_ID=<LAST_SHEET_MESSAGE_ID>',
      'ORDER_ALERT_READ_LIMIT=100',
      'ORDER_ALERT_IGNORE_SEEN=1',
      'ORDER_ALERT_DISABLE_DEDUPE=1',
    ].join(' ');
    return `cd ${path.dirname(DISCORD_ORDER_SCRIPT)} && ${env} ${PY_GOOGLE} ${DISCORD_ORDER_SCRIPT}`;
  }
  return '';
}

async function collectOpsLedger() {
  const [watchdogState, couponState, discordState, watchdogLines, discordAlerts] = await Promise.all([
    readJsonFile(LAUNCHER_WATCHDOG_STATE_JSON),
    readJsonFile(COUPON_ALERT_STATE_JSON),
    readJsonFile(DISCORD_ORDER_STATE_JSON),
    readTailLines(LAUNCHER_WATCHDOG_LOG, 40),
    readJsonlTail(DISCORD_ORDER_JSONL, 12),
  ]);

  const jobs = [
    {
      id: 'coupon-points-issue-alert',
      name: 'Coupon Points Issue Alert',
      source: 'Grafana Quickwit -> Google Sheet / Google Chat',
      expectedIntervalMs: 3 * 60 * 60 * 1000,
      warningMs: 6 * 60 * 60 * 1000,
      criticalMs: 12 * 60 * 60 * 1000,
      outLog: fileInfo(COUPON_ALERT_OUT_LOG),
      statePath: COUPON_ALERT_STATE_JSON,
      state: couponState || {},
      watchdog: watchdogState?.['coupon-points-issue-alert'] || {},
      lastEventAt: couponState?.last_checked_at || fileInfo(COUPON_ALERT_OUT_LOG).mtime,
      lastCursor: couponState?.last_window ? `${couponState.last_window.from || '?'} -> ${couponState.last_window.to || '?'}` : '',
      lastCount: couponState?.last_new_errors,
      backfillDryRunCommand: buildBackfillCommand('coupon-points-issue-alert', 'dry-run'),
      backfillAppendCommand: buildBackfillCommand('coupon-points-issue-alert', 'append-sheet'),
    },
    {
      id: 'discord-prod-order-forwarder',
      name: 'Discord Prod Order Forwarder',
      source: 'Discord #prod-order-monitor -> local JSONL / Google Sheet',
      expectedIntervalMs: 60 * 1000,
      warningMs: 10 * 60 * 1000,
      criticalMs: 30 * 60 * 1000,
      outLog: fileInfo(DISCORD_ORDER_OUT_LOG),
      statePath: DISCORD_ORDER_STATE_JSON,
      state: discordState || {},
      watchdog: watchdogState?.['discord-prod-order-forwarder'] || {},
      lastEventAt: isoFromEpochSeconds(discordState?.last_run) || fileInfo(DISCORD_ORDER_OUT_LOG).mtime,
      lastCursor: Array.isArray(discordState?.seen_ids) && discordState.seen_ids.length ? discordState.seen_ids[discordState.seen_ids.length - 1] : '',
      lastCount: discordState?.last_sent_count,
      backfillDryRunCommand: 'No no-write dry-run in current Discord script. Use state/JSONL review first.',
      backfillAppendCommand: buildBackfillCommand('discord-prod-order-forwarder', 'append-sheet'),
    },
  ].map(job => {
    const ageMs = job.lastEventAt ? Date.now() - Date.parse(job.lastEventAt) : job.outLog.ageMs;
    const status = healthFromAge(ageMs, job.warningMs, job.criticalMs);
    const recoveryCount = Array.isArray(job.watchdog?.recoveries) ? job.watchdog.recoveries.length : 0;
    const risk = status === 'critical'
      ? 'Backfill likely required before trusting the sheet.'
      : status === 'warning'
        ? 'Check for a small collection gap.'
        : 'No gap detected from local state.';
    return { ...job, ageMs, status, recoveryCount, risk };
  });

  const watchdogEvents = watchdogLines.map(line => ({
    ts: line.match(/^\[([^\]]+)\]/)?.[1] || '',
    source: 'launcher-watchdog',
    message: line.replace(/^\[[^\]]+\]\s*/, ''),
    status: /silent|failed|missing/i.test(line) ? 'warning' : /recovered|healthy|installed/i.test(line) ? 'healthy' : 'unknown',
  })).slice(-20).reverse();

  const discordEvents = discordAlerts.map(alert => ({
    ts: alert.timestampUtc || '',
    source: 'discord-prod-order-forwarder',
    message: `${alert.title || 'Prod order alert'}${alert.tid ? ' · tid ' + alert.tid : ''}`,
    status: String(alert.http_code || '').startsWith('5') ? 'critical' : 'warning',
    id: alert.id || '',
  })).reverse();

  const summary = jobs.reduce((acc, job) => {
    acc.jobs += 1;
    acc[job.status] = (acc[job.status] || 0) + 1;
    if (job.status === 'warning' || job.status === 'critical') acc.needsReview += 1;
    return acc;
  }, { jobs: 0, healthy: 0, warning: 0, critical: 0, unknown: 0, needsReview: 0 });

  return {
    generatedAt: new Date().toISOString(),
    mode: 'read-only ledger MVP',
    summary,
    jobs,
    events: [...watchdogEvents, ...discordEvents]
      .sort((a, b) => Date.parse(b.ts || 0) - Date.parse(a.ts || 0))
      .slice(0, 30),
    guardrails: [
      'Dashboard does not append to Google Sheets automatically.',
      'Coupon backfill has a safe dry-run command and a sheet-only append command.',
      'Discord backfill should be message-id based; review local JSONL/state before append.',
    ],
  };
}

function normalizeLifeItem(raw = {}) {
  const createdAt = raw.createdAt || raw.ts || raw.timestamp || new Date().toISOString();
  const text = String(raw.text || raw.message || raw.title || '').trim();
  const type = raw.type || (
    /เตือน|remind|due|นัด/i.test(text) ? 'reminder'
      : /ไอเดีย|idea|น่าทำ|ลองทำ/i.test(text) ? 'idea'
        : /ระบบ|project|โปรเจกต์|ทำแอป/i.test(text) ? 'project'
          : 'task'
  );
  return {
    id: raw.id || `life-${Date.parse(createdAt) || Date.now()}`,
    createdAt,
    updatedAt: raw.updatedAt || createdAt,
    source: raw.source || 'manual',
    channel: raw.channel || raw.source || 'unknown',
    type,
    status: raw.status || 'open',
    priority: raw.priority || (type === 'reminder' ? 'P1' : 'P2'),
    title: raw.title || text.slice(0, 72) || 'Untitled life item',
    text,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    dueAt: raw.dueAt || null,
    snoozeUntil: raw.snoozeUntil || null,
  };
}

async function collectLifeCommand() {
  const store = await readJsonFile(LIFE_COMMAND_CENTER_JSON) || { version: 1, items: [], briefHistory: [] };
  const reminderPolicy = await readJsonFile(path.join(WORKSPACE, 'data', 'life-reminder-policy.json'));
  const items = (Array.isArray(store.items) ? store.items : [])
    .map(normalizeLifeItem)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const openItems = items.filter(item => !['done', 'archived', 'cancelled'].includes(item.status));
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(todayStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 2);

  const dueSoon = openItems.filter(item => {
    if (!item.dueAt) return false;
    const ts = Date.parse(item.dueAt);
    return Number.isFinite(ts) && ts <= tomorrowEnd.getTime();
  });
  const nextActionSeen = new Set();
  const nextActions = [
    ...dueSoon,
    ...openItems.filter(item => item.priority === 'P1'),
    ...openItems.filter(item => item.type === 'project'),
  ].filter(item => {
    if (nextActionSeen.has(item.id)) return false;
    nextActionSeen.add(item.id);
    return true;
  }).slice(0, 8);

  const byType = openItems.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  const byChannel = openItems.reduce((acc, item) => {
    acc[item.channel] = (acc[item.channel] || 0) + 1;
    return acc;
  }, {});

  const lineCommands = [
    {
      label: 'Daily Brief',
      postback: 'richmenu=daily-brief',
      example: 'Tap DAILY BRIEF',
      command: `${LIFE_INBOX_BIN} brief`,
    },
    {
      label: 'Task Inbox',
      postback: 'richmenu=task-inbox',
      example: 'Nova task ต่อ dashboard daily life',
      command: `${LIFE_INBOX_BIN} add --source line --type task --text "<ข้อความจาก LINE>"`,
    },
    {
      label: 'Expense & Bill',
      postback: 'richmenu=expense-bill',
      example: 'Nova bill ค่าไฟ 1200 จ่ายแล้ว',
      command: `${LIFE_INBOX_BIN} add --source line --type reminder --priority P1 --text "<ข้อความจาก LINE>"`,
    },
    {
      label: 'Health Tracker',
      postback: 'richmenu=health-tracker',
      example: 'Nova health นอน 7 ชม. เดิน 6000 ก้าว',
      command: `${LIFE_INBOX_BIN} add --source line --type note --priority P2 --tags health --text "<ข้อความจาก LINE>"`,
    },
    {
      label: 'Home Ops',
      postback: 'richmenu=home-ops',
      example: 'Nova home ประกันรถหมดอายุเดือนหน้า',
      command: `${LIFE_INBOX_BIN} add --source line --type idea --priority P2 --text "<ข้อความจาก LINE>"`,
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    mode: 'local-first preview',
    source: LIFE_COMMAND_CENTER_JSON,
    summary: {
      open: openItems.length,
      tasks: byType.task || 0,
      reminders: byType.reminder || 0,
      ideas: byType.idea || 0,
      projects: byType.project || 0,
      dueSoon: dueSoon.length,
      channels: Object.keys(byChannel).length,
    },
    dailyBrief: {
      posture: openItems.length === 0 ? 'clear' : dueSoon.length ? 'attention' : 'normal',
      headline: dueSoon.length
        ? `${dueSoon.length} life item(s) due soon`
        : openItems.length
          ? `${openItems.length} open life item(s) waiting`
          : 'No open life items',
      nextActions,
      guardrails: [
        'Local JSON store only; no automatic external reminders yet.',
        'LINE menu intake should add items first, then brief can summarize.',
        'Approve before enabling scheduled outbound nudges.',
      ],
    },
    reminderPolicy: reminderPolicy ? {
      enabled: Boolean(reminderPolicy.enabled),
      channel: reminderPolicy.channel || 'line',
      schedule: reminderPolicy.dailyBrief?.times || [],
      quietHours: reminderPolicy.quietHours || {},
      rateLimit: reminderPolicy.rateLimit || {},
      dueReminder: reminderPolicy.dueReminder || {},
    } : null,
    items: openItems.slice(0, 40),
    byType,
    byChannel,
    lineCommands,
  };
}

function alertSignature(alert = {}) {
  const err = alert.err_code || alert.errCode || '';
  if (err) return String(err);
  return [
    alert.title || 'untitled',
    alert.endpoint || '',
    alert.http_code || alert.httpCode || '',
    alert.err_msg || alert.errMsg || '',
  ].map(x => String(x || '').trim()).join('|');
}

function endpointName(endpoint = '') {
  const value = String(endpoint || '');
  if (!value) return 'no endpoint';
  try {
    const parsed = new URL(value);
    return parsed.pathname || value;
  } catch {
    return value.replace(/^https?:\/\/[^/]+/i, '') || value;
  }
}

function classifyAlertGroup(group) {
  const text = [
    group.signature,
    group.title,
    group.endpoint,
    group.errMsg,
    group.category,
    group.impact,
  ].join(' ').toLowerCase();
  const has5xx = group.httpCodes.some(code => String(code).startsWith('5'));
  const repeat = group.count >= 3;
  const heavyRepeat = group.count >= 8;
  const businessValidation = /validate|mismatch|return_pending|checkout_expire|pending/.test(text) && group.httpCodes.every(code => !String(code).startsWith('5'));
  const paymentOrOrderFlow = /payment|placeorder|place_order|bulk-update|inquiry|order status/.test(text);
  const highImpact = /high|critical|p0|p1/.test(text);
  if (has5xx) {
    return { action: 'escalate', status: 'critical', reason: '5xx/server-side signal' };
  }
  if (paymentOrOrderFlow && (highImpact || group.last6h >= 5)) {
    return { action: 'escalate', status: 'critical', reason: 'Repeated payment/order-flow signal' };
  }
  if (paymentOrOrderFlow && group.count >= 10) {
    return { action: 'investigate', status: 'warning', reason: 'Historically repeated order-flow pattern' };
  }
  if (heavyRepeat && businessValidation) {
    return { action: 'suppress/digest', status: 'warning', reason: 'High-repeat business validation pattern' };
  }
  if (repeat) {
    return { action: 'digest', status: 'warning', reason: 'Repeated signature; group into one digest' };
  }
  if (businessValidation) {
    return { action: 'watch', status: 'healthy', reason: 'Single business validation; useful as row evidence' };
  }
  return { action: 'watch', status: 'unknown', reason: 'Insufficient recurrence for rule change' };
}

function parseCouponRunLines(lines) {
  return lines.map(line => {
    try { return JSON.parse(line); }
    catch { return null; }
  }).filter(item => item && typeof item === 'object' && ('new_errors' in item || 'matched' in item));
}

async function collectAlertQuality() {
  const [discordAlerts, couponLines] = await Promise.all([
    readJsonlTail(DISCORD_ORDER_JSONL, 1000),
    readTailLines(COUPON_ALERT_OUT_LOG, 120),
  ]);
  const couponRuns = parseCouponRunLines(couponLines);
  const now = Date.now();
  const windows = {
    last6h: now - 6 * 60 * 60 * 1000,
    last24h: now - 24 * 60 * 60 * 1000,
  };
  const groups = new Map();
  const endpointCounts = new Map();
  const categoryCounts = new Map();

  for (const alert of discordAlerts) {
    const ts = Date.parse(alert.timestampUtc || '') || 0;
    const signature = alertSignature(alert);
    const existing = groups.get(signature) || {
      signature,
      source: 'discord-prod-order-forwarder',
      title: alert.title || 'Prod order alert',
      endpoint: endpointName(alert.endpoint),
      category: alert.category || 'Uncategorized',
      impact: alert.impact || 'Review',
      errCode: alert.err_code || '',
      errMsg: alert.err_msg || '',
      httpCodes: [],
      tids: [],
      orders: [],
      count: 0,
      last6h: 0,
      last24h: 0,
      firstSeenAt: alert.timestampUtc || '',
      lastSeenAt: alert.timestampUtc || '',
      sampleGrafana: alert.grafana || '',
      samplePodLog: alert.pod_log || '',
      recommendedAction: alert.recommended_action || '',
    };
    existing.count += 1;
    if (ts >= windows.last6h) existing.last6h += 1;
    if (ts >= windows.last24h) existing.last24h += 1;
    if (ts && (!Date.parse(existing.firstSeenAt) || ts < Date.parse(existing.firstSeenAt))) existing.firstSeenAt = alert.timestampUtc;
    if (ts && (!Date.parse(existing.lastSeenAt) || ts > Date.parse(existing.lastSeenAt))) existing.lastSeenAt = alert.timestampUtc;
    if (alert.http_code != null && !existing.httpCodes.includes(alert.http_code)) existing.httpCodes.push(alert.http_code);
    if (alert.tid && !existing.tids.includes(alert.tid)) existing.tids.push(alert.tid);
    if (alert.order && !existing.orders.includes(alert.order)) existing.orders.push(alert.order);
    groups.set(signature, existing);

    const endpoint = endpointName(alert.endpoint);
    endpointCounts.set(endpoint, (endpointCounts.get(endpoint) || 0) + 1);
    const category = alert.category || 'Uncategorized';
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  const grouped = [...groups.values()].map(group => {
    const classification = classifyAlertGroup(group);
    return {
      ...group,
      httpCodes: group.httpCodes.sort(),
      tids: group.tids.slice(-5),
      orders: group.orders.slice(-5),
      ...classification,
    };
  }).sort((a, b) => b.count - a.count || Date.parse(b.lastSeenAt || 0) - Date.parse(a.lastSeenAt || 0));

  const couponNewErrors = couponRuns.reduce((sum, run) => sum + Number(run.new_errors || 0), 0);
  const couponMatched = couponRuns.reduce((sum, run) => sum + Number(run.matched || 0), 0);
  const couponRows = couponRuns.reduce((sum, run) => sum + Number(run.sheet?.rows || 0), 0);
  const couponSignals = [{
    source: 'coupon-points-issue-alert',
    action: couponNewErrors >= 5 ? 'digest' : couponNewErrors > 0 ? 'watch' : 'watch',
    status: couponNewErrors >= 5 ? 'warning' : 'healthy',
    title: 'Coupon points issue API aggregate',
    signature: 'coupon-points-issue-alert',
    count: couponMatched,
    last24h: couponMatched,
    last6h: couponMatched,
    endpoint: '/r4m/v2/coupon/points/issue',
    reason: couponNewErrors > 0 ? `${couponNewErrors} fresh errors surfaced in recent runs` : 'No fresh coupon errors in recent run log',
    recommendedAction: couponNewErrors > 0 ? 'Review Grafana rows and keep Sheet-only backfill available.' : 'No rule change needed.',
    sheetRows: couponRows,
  }];

  const byAction = grouped.reduce((acc, group) => {
    acc[group.action] = (acc[group.action] || 0) + 1;
    return acc;
  }, {});
  const endpointHotspots = [...endpointCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([endpoint, count]) => ({ endpoint, count }));
  const categories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, count]) => ({ category, count }));

  const suggestions = [];
  const noisy = grouped.filter(group => group.action === 'suppress/digest');
  const escalate = grouped.filter(group => group.action === 'escalate');
  const investigate = grouped.filter(group => group.action === 'investigate');
  if (escalate.length) suggestions.push(`Escalate ${escalate.length} repeated high-impact/payment/order-flow group(s).`);
  if (investigate.length) suggestions.push(`Investigate ${investigate.length} historical order-flow group(s) before changing alert policy.`);
  if (noisy.length) suggestions.push(`Convert ${noisy.length} high-repeat validation group(s) into digest/suppression rules.`);
  if (!suggestions.length) suggestions.push('Keep current rules; no strong suppression/escalation candidate from local data.');

  return {
    generatedAt: new Date().toISOString(),
    source: 'discord-alert-forwarder JSONL + coupon aggregate run log',
    mode: 'read-only quality MVP',
    summary: {
      rawAlerts: discordAlerts.length,
      groups: grouped.length,
      escalate: byAction.escalate || 0,
      investigate: byAction.investigate || 0,
      digest: byAction.digest || 0,
      suppressDigest: byAction['suppress/digest'] || 0,
      watch: byAction.watch || 0,
      couponRuns: couponRuns.length,
      couponNewErrors,
      couponRows,
    },
    groups: grouped.slice(0, 30),
    endpointHotspots,
    categories,
    couponSignals,
    suggestions,
    guardrails: [
      'Read-only: this dashboard does not suppress or change alert delivery rules.',
      'Use suppress/digest recommendations as candidates for review, not automatic policy.',
      'Escalate candidates still need Grafana/TID evidence review before paging humans.',
    ],
  };
}

async function collectAndPersistStatus() {
  const value = sanitizeStatusSnapshot(await collect());
  await atomicWritePrivateJson(STATUS_SNAPSHOT_JSON, value);
  return value;
}

async function collectAndPersistJobRuns() {
  const value = sanitizeJobRunsSnapshot(await collectJobRuns());
  await atomicWritePrivateJson(JOB_RUNS_SNAPSHOT_JSON, value);
  return value;
}

function unavailableStatusSnapshot() {
  return {
    schemaVersion: 2,
    redacted: true,
    generatedAt: '',
    overall: 'warning',
    summary: {
      sessions: 'snapshot unavailable',
      tasks: 'snapshot unavailable',
      heartbeat: 'snapshot unavailable',
      guardChecks: 0,
      recentRestarts: 0,
      launcherWatchdog: { status: 'unknown', log: { exists: false, mtime: '', ageMs: null, sizeBytes: 0 } },
    },
    services: [{ name: 'Dashboard telemetry snapshot', status: 'warning', detail: 'Background snapshot is not available yet' }],
    channels: [],
    docker: [],
    guard: { recent: [], restarts: [] },
    harness: { schemaVersion: 1, generatedAt: '', overall: 'unknown', failed: 0, warned: 0, deferred: true },
    roadmap: [],
    mode: 'snapshot-only',
    stale: true,
    cached: true,
    cacheAgeMs: null,
    snapshot: snapshotFreshness(null, STATUS_SNAPSHOT_STALE_MS),
  };
}

function unavailableJobRunsSnapshot() {
  return {
    schemaVersion: 1,
    redacted: true,
    generatedAt: '',
    source: 'background telemetry snapshot',
    mode: 'snapshot-only',
    summary: { jobs: 0, runs: 0, healthy: 0, warning: 0, critical: 0, unknown: 0 },
    jobs: [],
    runs: [],
    stale: true,
    cached: true,
    cacheAgeMs: null,
    snapshot: snapshotFreshness(null, JOB_RUNS_SNAPSHOT_STALE_MS),
  };
}

async function readStatusSnapshotForApi() {
  const raw = await readJsonFile(STATUS_SNAPSHOT_JSON);
  if (!raw) return unavailableStatusSnapshot();
  const snapshot = snapshotFreshness(raw, STATUS_SNAPSHOT_STALE_MS);
  const value = sanitizeStatusSnapshot(raw);
  return { ...value, generatedAt: snapshot.generatedAt, mode: 'snapshot-only', stale: snapshot.stale, cached: true, cacheAgeMs: snapshot.ageMs, snapshot };
}

async function readJobRunsSnapshotForApi() {
  const raw = await readJsonFile(JOB_RUNS_SNAPSHOT_JSON);
  if (!raw) return unavailableJobRunsSnapshot();
  const snapshot = snapshotFreshness(raw, JOB_RUNS_SNAPSHOT_STALE_MS);
  const value = sanitizeJobRunsSnapshot(raw);
  return { ...value, generatedAt: snapshot.generatedAt, stale: snapshot.stale, cached: true, cacheAgeMs: snapshot.ageMs, snapshot };
}

let telemetryRefreshPending = null;
async function refreshTelemetrySnapshots() {
  if (telemetryRefreshPending) return telemetryRefreshPending;
  telemetryRefreshPending = Promise.allSettled([
    collectAndPersistStatus(),
    collectAndPersistJobRuns(),
  ]).then(results => {
    const names = ['status', 'jobRuns'];
    const outputs = Object.fromEntries(results.map((result, index) => [names[index], result.status === 'fulfilled'
      ? { ok: true }
      : { ok: false, error: result.reason?.message || String(result.reason || 'unknown error') }]));
    return { ok: results.every(result => result.status === 'fulfilled'), generatedAt: new Date().toISOString(), outputs };
  }).finally(() => {
    telemetryRefreshPending = null;
  });
  return telemetryRefreshPending;
}

function startTelemetryProducer() {
  if (TELEMETRY_PRODUCER_DISABLED) return;
  const refresh = () => refreshTelemetrySnapshots().then(result => {
    if (!result.ok) console.error(`telemetry snapshot refresh degraded: ${JSON.stringify(result.outputs)}`);
  }).catch(error => console.error(`telemetry snapshot refresh failed: ${error.message}`));
  refresh();
  const timer = setInterval(refresh, TELEMETRY_REFRESH_INTERVAL_MS);
  timer.unref();
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
    timeoutMs: 60000,
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
    timeoutMs: 60000,
    startOptions: codexAppServerStartOptions(codexHome),
    config,
    isolated: true,
  };
  if (accountId) request.authProfileId = accountId;
  return normalizeCodexRealtimeLimit(await requestCodexAppServerJson(request));
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
  const authProfiles = await readAuthProfiles();
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
  const authProfiles = await readAuthProfiles();
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
  const authProfiles = await readAuthProfiles();
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
  const [status, gatewayHealth, gatewayStatus, nodeStatus, docker, readyz] = await Promise.all([
    run(OPENCLAW, ['status'], 25000),
    run(OPENCLAW, ['gateway', 'health'], 15000),
    run(OPENCLAW, ['gateway', 'status'], 15000),
    run(OPENCLAW, ['node', 'status'], 15000),
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
  const launcherWatchdogLog = fileInfo(LAUNCHER_WATCHDOG_LOG);
  const launcherWatchdogState = await readJsonFile(LAUNCHER_WATCHDOG_STATE_JSON);
  const launcherWatchdogStatus = healthFromAge(launcherWatchdogLog.ageMs, 20 * 60 * 1000, 45 * 60 * 1000);
  const launcherWatchdogDetail = launcherWatchdogLog.exists
    ? `last run ${Math.round((launcherWatchdogLog.ageMs || 0) / 60000)}m ago · monitored=${Object.keys(launcherWatchdogState || {}).length}`
    : 'launcher-watchdog log missing';

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
    { name: 'Launcher Watchdog', status: launcherWatchdogStatus, detail: launcherWatchdogDetail },
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
      tasks: tasksMatch?.[1]?.split('·')?.[0]?.trim() || 'task summary unavailable',
      heartbeat: heartbeatMatch?.[1]?.trim() || 'unknown',
      guardChecks: healthChecks.length,
      recentRestarts: restarts.length,
      launcherWatchdog: {
        status: launcherWatchdogStatus,
        log: launcherWatchdogLog,
        state: launcherWatchdogState || {},
      },
    },
    services,
    channels,
    docker: dockerRows,
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
  if (req.method === 'GET' && url.pathname === '/api/healthz') {
    const harness = await collectHarness();
    send(res, 200, 'application/json', JSON.stringify({
      ok: true,
      service: 'nova-ops-dashboard',
      generatedAt: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      harness: {
        overall: harness.overall,
        available: Boolean(harness.snapshot?.available),
        stale: Boolean(harness.snapshot?.stale),
        ageMs: harness.snapshot?.ageMs ?? null,
      },
    }));
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
    try { send(res, 200, 'application/json', JSON.stringify(await readStatusSnapshotForApi())); }
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
  if (url.pathname === '/api/startup') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('startup', TTL.startup, collectStartupLoop, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/auto-cron') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('auto-cron', TTL.autoCron, collectAutoCron, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/browser-runs') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('browser-runs', TTL.browserRuns, collectBrowserRuns, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/nova-events') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('nova-events', TTL.novaEvents, collectNovaEvents, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/proposals') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('proposals', TTL.proposals, collectProposals, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  if (url.pathname === '/api/classifier-stats') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('classifier-stats', TTL.classifierStats, collectClassifierStats, url.searchParams.get('refresh') === '1'))); }
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
    try { send(res, 200, 'application/json', JSON.stringify(await collectHarness())); }
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
    try { send(res, 200, 'application/json', JSON.stringify(await readJobRunsSnapshotForApi())); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ jobs: [], runs: [], error: e.message })); }
    return;
  }
  if (url.pathname === '/api/ops-ledger') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('ops-ledger', TTL.opsLedger, collectOpsLedger, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ jobs: [], events: [], error: e.message })); }
    return;
  }
  if (url.pathname === '/api/alert-quality') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('alert-quality', TTL.alertQuality, collectAlertQuality, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ groups: [], endpointHotspots: [], error: e.message })); }
    return;
  }
  if (url.pathname === '/api/life-command') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('life-command', TTL.lifeCommand, collectLifeCommand, url.searchParams.get('refresh') === '1'))); }
    catch (e) { send(res, 500, 'application/json', JSON.stringify({ items: [], error: e.message })); }
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
  if (url.pathname === '/api/command-center') {
    try { send(res, 200, 'application/json', JSON.stringify(await cached('command-center', TTL.teamControl, collectCommandCenter, url.searchParams.get('refresh') === '1'))); }
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
  if (url.pathname === '/claude-context' || url.pathname === '/claude-context/') {
    if (!checkClaudeAuth(req, url)) {
      send(res, 401, 'text/plain', 'Unauthorized: Nova knowledge base requires token. Use ?token=, Authorization: Bearer, or X-Nova-Token header.');
      return;
    }
    // Index endpoint: list curated MD files for AI-coding assistant discovery.
    try {
      const entries = await fsp.readdir(CLAUDE_CONTEXT_DIR, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && e.name.endsWith('.md'))
        .map((e) => e.name)
        .sort();
      const body = [
        '# Nova Context for AI Coding Assistants',
        '',
        'Curated knowledge base served from Nova Ops Dashboard.',
        'Each file is intentionally a public-safe subset (no PII, no secrets, no infra paths).',
        '',
        '## Available files',
        '',
        ...files.map((f) => `- https://app.novaosai.work/claude-context/${f}`),
        '',
        '## Usage with Claude Code',
        '',
        '```',
        '@https://app.novaosai.work/claude-context/about-nick.md',
        '@https://app.novaosai.work/claude-context/tech-stack-map.md',
        '@https://app.novaosai.work/claude-context/coding-standards.md',
        '@https://app.novaosai.work/claude-context/infra-conventions.md',
        '@https://app.novaosai.work/claude-context/dont-do.md',
        '```',
        '',
      ].join('\n');
      send(res, 200, 'text/markdown; charset=utf-8', body);
    } catch (e) {
      send(res, 500, 'text/plain', `Index error: ${e.message}`);
    }
    return;
  }
  if (url.pathname.startsWith('/claude-context/')) {
    // Serve curated MD files for AI coding assistants on other machines.
    // Requires token auth (see header on CLAUDE_CONTEXT_TOKEN loader above).
    if (!checkClaudeAuth(req, url)) {
      send(res, 401, 'text/plain', 'Unauthorized: Nova knowledge base requires token. Use ?token=, Authorization: Bearer, or X-Nova-Token header.');
      return;
    }
    const name = url.pathname.slice('/claude-context/'.length);
    if (!name || name.includes('/') || name.includes('\\') || name.includes('..') || !name.endsWith('.md')) {
      send(res, 400, 'text/plain', 'Bad request: only top-level .md files allowed');
      return;
    }
    const full = path.normalize(path.join(CLAUDE_CONTEXT_DIR, name));
    if (!full.startsWith(CLAUDE_CONTEXT_DIR + path.sep)) {
      send(res, 403, 'text/plain', 'Forbidden: path escapes claude-context dir');
      return;
    }
    try {
      const body = await fsp.readFile(full, 'utf8');
      send(res, 200, 'text/markdown; charset=utf-8', body);
    } catch (e) {
      if (e.code === 'ENOENT') send(res, 404, 'text/plain', `Not found: ${name}`);
      else send(res, 500, 'text/plain', `Error: ${e.message}`);
    }
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

if (isTelemetryRefreshCmd) {
  refreshTelemetrySnapshots().then(result => {
    console.log(JSON.stringify(result));
    process.exitCode = result.ok ? 0 : 1;
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
} else if (!isServiceCmd) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Nova Ops Dashboard running at http://127.0.0.1:${PORT}`);
    startTelemetryProducer();
  });
}
