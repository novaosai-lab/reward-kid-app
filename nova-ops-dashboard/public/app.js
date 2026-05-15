const $ = id => document.getElementById(id);
const label = s => s === 'healthy' ? 'Healthy' : s === 'critical' ? 'Critical' : s === 'warning' ? 'Warning' : 'Unknown';
function esc(x){return String(x??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function pill(s){return `<span class="pill ${s}">${label(s)}</span>`}
function hStatus(s){return s === 'pass' ? 'healthy' : s === 'fail' ? 'critical' : s === 'warn' ? 'warning' : 'unknown'}
async function load(){
  const res = await fetch('/api/status'); const d = await res.json();
  $('updated').textContent = new Date(d.generatedAt).toLocaleString();
  $('overall').textContent = d.overall === 'healthy' ? 'All core systems healthy' : d.overall === 'critical' ? 'Critical attention required' : 'Some areas need attention';
  $('overall-dot').className = `dot ${d.overall}`;
  $('m-sessions').textContent = d.summary.sessions;
  $('m-tasks').textContent = d.summary.tasks;
  $('m-heartbeat').textContent = d.summary.heartbeat;
  $('m-restarts').textContent = d.summary.recentRestarts;
  $('services').innerHTML = d.services.map(s=>`<div class="service"><span class="dot ${s.status}"></span><div><strong>${esc(s.name)}</strong><div class="detail">${esc(s.detail)}</div></div>${pill(s.status)}</div>`).join('');
  $('channels').innerHTML = d.channels.map(c=>`${pill(c.status)}<span>${esc(c.name)}</span>`).join('');
  const h = d.harness || {overall:'unknown',failed:0,warned:0,checks:[],error:'No harness data'};
  const hs = h.overall === 'pass' ? 'healthy' : h.overall === 'fail' ? 'critical' : h.overall === 'warn' ? 'warning' : 'unknown';
  $('harness-summary').innerHTML = `<div class="gate ${hs}"><span class="dot ${hs}"></span><strong>${esc((h.overall||'unknown').toUpperCase())}</strong><span>${esc(h.checks?.length||0)} checks · ${esc(h.failed||0)} failed · ${esc(h.warned||0)} warnings</span></div>${h.error?`<p class="detail">${esc(h.error)}</p>`:''}`;
  $('harness').innerHTML = (h.checks||[]).map(c=>`<div class="check"><span class="dot ${hStatus(c.status)}"></span><div><strong>${esc(c.name)}</strong><div class="detail">${esc(c.detail)}</div></div><span class="muted">${esc(c.duration_ms)}ms</span></div>`).join('') || '<p class="muted">No harness checks reported.</p>';
  $('guard').innerHTML = d.guard.recent.map(g=>`<div class="timeline-item"><div><code>${esc(g.event)}</code> <span class="muted">${esc(g.ts)}</span></div><div class="detail">${esc(g.reason || g.policy || g.output || g.gateway_health || g.node_status || '')}</div></div>`).join('') || '<p class="muted">No guard events yet.</p>';
  $('docker').innerHTML = d.docker.length ? `<div class="row head"><span>Name</span><span>Status</span><span>Ports</span></div>` + d.docker.map(r=>`<div class="row"><strong>${esc(r.name)}</strong><span>${esc(r.status)}</span><span class="muted">${esc(r.ports)}</span></div>`).join('') : '<p class="muted">No Docker containers visible, or Docker not running.</p>';
  $('roadmap').innerHTML = d.roadmap.map(x=>`<li>${esc(x)}</li>`).join('');
  $('raw').textContent = d.raw.openclawStatus;
}
$('refresh').addEventListener('click', load);
load(); setInterval(load, 30000);
