/**
 * Reward Kid App — Google Apps Script backend
 *
 * SETUP (one-time):
 *   1. Create a new Google Sheet (e.g. "Reward Kid — Nile")
 *   2. Extensions → Apps Script → paste this whole file
 *   3. Set SHEET_ID below to your Sheet's ID (the long part of the URL)
 *   4. Run setup() once (accept permissions) — creates tasks/rewards/logs tabs + headers
 *   5. Deploy → New deployment → Type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone  (since this is a public app; rate-limit by obscurity)
 *   6. Copy the Web app URL → put in app's NEXT_PUBLIC_APPS_SCRIPT_URL env var
 *
 * TABS SCHEMA (created by setup()):
 *   tasks:   id, icon, title_th, title_en, points, active, created_at
 *   rewards: id, icon, title_th, title_en, cost, active, created_at
 *   logs:    id, timestamp, task_id, points, note
 */

const SHEET_ID = 'PUT_YOUR_GOOGLE_SHEET_ID_HERE';

const TASKS_TAB = 'tasks';
const REWARDS_TAB = 'rewards';
const LOGS_TAB = 'logs';

function doGet(e)  { return handleRequest_(e); }
function doPost(e) { return handleRequest_(e); }

function handleRequest_(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = (e.parameter && e.parameter.action) || body.action || 'list_all';

    let result;
    switch (action) {
      case 'list_all':      result = listAll_(ss); break;
      case 'list_tasks':    result = listItems_(ss, TASKS_TAB); break;
      case 'list_rewards':  result = listItems_(ss, REWARDS_TAB); break;
      case 'list_logs':     result = listLogs_(ss); break;
      case 'create_task':   result = createItem_(ss, TASKS_TAB, body); break;
      case 'create_reward': result = createItem_(ss, REWARDS_TAB, body); break;
      case 'update_item':   result = updateItem_(ss, body); break;
      case 'delete_item':   result = deleteItem_(ss, body); break;
      case 'log_task':      result = logTask_(ss, body); break;
      default: result = { error: 'unknown action: ' + action };
    }

    return json_(result);
  } catch (err) {
    return json_({ error: err.message, stack: err.stack });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function listAll_(ss) {
  return {
    tasks: listItems_(ss, TASKS_TAB),
    rewards: listItems_(ss, REWARDS_TAB),
    logs: listLogs_(ss),
  };
}

function listItems_(ss, tab) {
  const sheet = ss.getSheetByName(tab);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => rowToObj_(headers, row)).filter(r => r.active !== false);
}

function listLogs_(ss) {
  const sheet = ss.getSheetByName(LOGS_TAB);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1)
    .map(row => rowToObj_(headers, row))
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
}

function rowToObj_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i]; });
  return obj;
}

function createItem_(ss, tab, payload) {
  const sheet = ss.getSheetByName(tab);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const id = payload.id || Utilities.getUuid();
  const row = headers.map(h => {
    if (h === 'id') return id;
    if (h === 'created_at') return new Date().toISOString();
    if (h === 'active' && payload[h] === undefined) return true;
    return payload[h] !== undefined ? payload[h] : '';
  });
  sheet.appendRow(row);
  return { ok: true, id };
}

function updateItem_(ss, payload) {
  const tab = payload.tab;
  if (!tab) return { error: 'tab required' };
  const sheet = ss.getSheetByName(tab);
  if (!sheet) return { error: 'tab not found' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  if (idCol < 0) return { error: 'id column missing' };

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === payload.id) {
      headers.forEach((h, col) => {
        if (payload[h] !== undefined && h !== 'id') {
          sheet.getRange(i + 1, col + 1).setValue(payload[h]);
        }
      });
      return { ok: true };
    }
  }
  return { error: 'not found' };
}

function deleteItem_(ss, payload) {
  const tab = payload.tab;
  if (!tab) return { error: 'tab required' };
  const sheet = ss.getSheetByName(tab);
  if (!sheet) return { error: 'tab not found' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  if (idCol < 0) return { error: 'id column missing' };

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === payload.id) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'not found' };
}

function logTask_(ss, payload) {
  const sheet = ss.getSheetByName(LOGS_TAB);
  const id = Utilities.getUuid();
  sheet.appendRow([
    id,
    new Date().toISOString(),
    payload.task_id || '',
    Number(payload.points) || 0,
    payload.note || '',
  ]);
  return { ok: true, id };
}

/**
 * Run this ONCE after pasting the file and setting SHEET_ID.
 * Creates the 3 tabs (tasks / rewards / logs) with headers.
 * Re-running is safe — existing tabs are left alone.
 */
function setup() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  const schema = {
    [TASKS_TAB]:   ['id', 'icon', 'title_th', 'title_en', 'points', 'active', 'created_at'],
    [REWARDS_TAB]: ['id', 'icon', 'title_th', 'title_en', 'cost',   'active', 'created_at'],
    [LOGS_TAB]:    ['id', 'timestamp', 'task_id', 'points', 'note'],
  };

  Object.keys(schema).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, schema[name].length).setValues([schema[name]]);
      sheet.getRange(1, 1, 1, schema[name].length).setFontWeight('bold').setBackground('#FFE082');
      sheet.setFrozenRows(1);
    }
  });

  // Seed default tasks if tasks tab is empty
  const tasksSheet = ss.getSheetByName(TASKS_TAB);
  if (tasksSheet.getLastRow() < 2) {
    const now = new Date().toISOString();
    const defaults = [
      ['t1', '🦷', 'แปรงฟันเช้า', 'Brush teeth (morning)', 2, true, now],
      ['t2', '🦷', 'แปรงฟันเย็น', 'Brush teeth (evening)', 2, true, now],
      ['t3', '🧸', 'เก็บของเล่น', 'Tidy up toys', 3, true, now],
      ['t4', '🥦', 'กินผัก', 'Eat vegetables', 3, true, now],
      ['t5', '🚿', 'อาบน้ำ', 'Take a bath', 2, true, now],
      ['t6', '📚', 'ฟังนิทาน', 'Listen to a story', 3, true, now],
      ['t7', '👟', 'ใส่รองเท้าเอง', 'Put on shoes', 2, true, now],
    ];
    tasksSheet.getRange(2, 1, defaults.length, defaults[0].length).setValues(defaults);
  }

  // Seed default rewards if empty
  const rewardsSheet = ss.getSheetByName(REWARDS_TAB);
  if (rewardsSheet.getLastRow() < 2) {
    const now = new Date().toISOString();
    const defaults = [
      ['r1', '🟡', 'รถตัก',     'Toy excavator',  20, true, now],
      ['r2', '🔵', 'รถบรรทุก',  'Toy truck',      30, true, now],
      ['r3', '🔴', 'รถเครน',    'Toy crane',      50, true, now],
      ['r4', '🧱', 'บล็อกตัวต่อ', 'Building blocks', 40, true, now],
    ];
    rewardsSheet.getRange(2, 1, defaults.length, defaults[0].length).setValues(defaults);
  }

  return '✅ Setup complete — created tabs + seeded defaults. Now deploy as Web app.';
}