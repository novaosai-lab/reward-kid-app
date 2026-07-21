'use strict';

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const DEFAULT_SNAPSHOT_FILE = path.join(
  os.homedir(),
  '.openclaw',
  'state',
  'nova-harness',
  'latest.json',
);
const HARNESS_BIN = process.env.NOVA_HARNESS_BIN || path.join(os.homedir(), '.openclaw', 'workspace', 'nova-harness', 'nova-harness');
const HARNESS_TIMEOUT_MS = Number(process.env.NOVA_HARNESS_TIMEOUT_MS) || 60_000;
const HARNESS_MAX_BYTES = 5 * 1024 * 1024; // 5MB cap on stdout
const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;

function unavailableSnapshot(error, staleAfterMs) {
  return {
    overall: 'unknown',
    failed: 0,
    warned: 0,
    checks: [],
    error,
    snapshot: {
      available: false,
      stale: true,
      ageMs: null,
      staleAfterMs,
      readOnly: true,
      runCommand: 'bin/nova-harness-eval-run',
    },
  };
}

async function runHarnessCheck() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(HARNESS_BIN)) {
      return reject(new Error('harness binary not found at ' + HARNESS_BIN));
    }
    execFile(HARNESS_BIN, ['check', '--json'], { timeout: HARNESS_TIMEOUT_MS, maxBuffer: HARNESS_MAX_BYTES }, (err, stdout, stderr) => {
      if (err) {
        const detail = (stderr && stderr.toString().slice(0, 500)) || err.message;
        return reject(new Error('harness exit ' + (err.code || 'unknown') + ': ' + detail));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error('harness output not valid JSON: ' + e.message + ' | preview: ' + stdout.toString().slice(0, 200)));
      }
    });
  });
}

async function writeSnapshotFile(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(data, null, 2));
}

function validateSnapshot(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('snapshot root must be an object');
  }
  if (!['pass', 'warn', 'fail'].includes(data.overall)) {
    throw new Error('snapshot overall is invalid');
  }
  if (!Number.isInteger(data.failed) || data.failed < 0) {
    throw new Error('snapshot failed count is invalid');
  }
  if (!Number.isInteger(data.warned) || data.warned < 0) {
    throw new Error('snapshot warned count is invalid');
  }
  if (!Array.isArray(data.checks)) {
    throw new Error('snapshot checks must be an array');
  }
}

function toPublicHarnessSnapshot(data) {
  const snapshot = data && typeof data.snapshot === 'object' ? data.snapshot : {};
  const result = {
    schemaVersion: Number.isInteger(data?.schemaVersion) ? data.schemaVersion : 1,
    generatedAt: data?.generatedAt || data?.generated_at || '',
    overall: ['pass', 'warn', 'fail'].includes(data?.overall) ? data.overall : 'unknown',
    failed: Number.isInteger(data?.failed) && data.failed >= 0 ? data.failed : 0,
    warned: Number.isInteger(data?.warned) && data.warned >= 0 ? data.warned : 0,
    snapshot: {
      available: snapshot.available === true,
      stale: snapshot.stale !== false,
      ageMs: Number.isFinite(snapshot.ageMs) ? snapshot.ageMs : null,
    },
  };
  if (!result.snapshot.available) {
    result.error = 'Harness snapshot unavailable; run bin/nova-harness-eval-run explicitly.';
  }
  return result;
}

async function readHarnessSnapshot(options = {}) {
  const file = options.file || process.env.NOVA_HARNESS_SNAPSHOT_FILE || DEFAULT_SNAPSHOT_FILE;
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const configuredStaleMs = Number(process.env.NOVA_HARNESS_SNAPSHOT_STALE_MS);
  const staleAfterMs = Number.isFinite(options.staleAfterMs)
    ? options.staleAfterMs
    : Number.isFinite(configuredStaleMs) && configuredStaleMs > 0
      ? configuredStaleMs
      : DEFAULT_STALE_AFTER_MS;

  let stat;
  let text;
  let regenerated = false;
  try {
    stat = await fsp.stat(file);
    if (!stat.isFile()) throw new Error('snapshot path is not a file');
    if (stat.size > MAX_SNAPSHOT_BYTES) throw new Error('snapshot exceeds size limit');
    text = await fsp.readFile(file, 'utf8');
  } catch (error) {
    // Auto-regenerate if file is missing (ENOENT) — keeps harness fresh without manual ops
    if (error && error.code === 'ENOENT') {
      try {
        const fresh = await runHarnessCheck();
        await writeSnapshotFile(file, fresh);
        regenerated = true;
        // fall through and re-read the fresh file below
      } catch (regenErr) {
        const reason = 'Harness snapshot unavailable and auto-regeneration failed: ' + regenErr.message + '. Run bin/nova-harness-eval-run explicitly to debug.';
        return unavailableSnapshot(reason, staleAfterMs);
      }
    } else {
      const reason = `Harness snapshot unavailable: ${error.message}`;
      return unavailableSnapshot(reason, staleAfterMs);
    }
  }
  if (regenerated) {
    // re-stat + re-read the just-written file so stat/text below are populated
    try {
      stat = await fsp.stat(file);
      if (!stat.isFile()) throw new Error('regenerated snapshot path is not a file');
      text = await fsp.readFile(file, 'utf8');
    } catch (error) {
      return unavailableSnapshot(`Regenerated snapshot unreadable: ${error.message}`, staleAfterMs);
    }
  }

  try {
    const data = JSON.parse(text);
    validateSnapshot(data);
    const generatedAt = data.generatedAt || data.generated_at || stat.mtime.toISOString();
    const generatedMs = Date.parse(generatedAt);
    const ageMs = Number.isFinite(generatedMs) ? Math.max(0, nowMs - generatedMs) : null;
    const stale = ageMs === null || ageMs > staleAfterMs;
    return {
      ...data,
      generatedAt,
      snapshot: {
        available: true,
        stale,
        ageMs,
        staleAfterMs,
        readOnly: true,
        runCommand: 'bin/nova-harness-eval-run',
      },
    };
  } catch (error) {
    return unavailableSnapshot(`Harness snapshot is invalid: ${error.message}`, staleAfterMs);
  }
}

module.exports = {
  DEFAULT_SNAPSHOT_FILE,
  DEFAULT_STALE_AFTER_MS,
  MAX_SNAPSHOT_BYTES,
  readHarnessSnapshot,
  toPublicHarnessSnapshot,
  validateSnapshot,
};
