const $ = id => document.getElementById(id);
const label = s => s === 'healthy' ? 'Healthy' : s === 'critical' ? 'Critical' : s === 'warning' ? 'Warning' : 'Unknown';
function esc(x){return String(x??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function pill(s){return `<span class="pill ${s}">${label(s)}</span>`}
function hStatus(s){return s === 'pass' ? 'healthy' : s === 'fail' ? 'critical' : s === 'warn' ? 'warning' : 'unknown'}
function severityStatus(s){return s === 'P0' || s === 'P1' ? 'critical' : s === 'P2' ? 'warning' : 'healthy'}
function bars(items){const max=Math.max(...items.map(x=>Number(x[1]||0)),1);return items.map(([name,val])=>`<div class="bar-row"><span>${esc(name)}</span><div class="bar"><i style="width:${Math.max(4,Number(val||0)/max*100)}%"></i></div><strong>${esc(val)}</strong></div>`).join('')}
async function loadSupportDigest(){
  try{
    const res = await fetch('/api/support-digest'); const d = await res.json();
    const s = d.summary || {};
    $('support-summary').innerHTML = d.ok ? `<div class="support-kpis"><div><span>Rows</span><strong>${esc(s.row_count||0)}</strong></div><div><span>Sample count</span><strong>${esc(s.sample_count||0)}</strong></div><div><span>Source</span><strong>${esc(d.tab||'—')}</strong></div><div><span>Updated</span><strong>${esc(new Date(d.generated_at).toLocaleString())}</strong></div></div>` : `<p class="detail">${esc(d.error||'No support digest data')}</p>`;
    $('support-charts').innerHTML = `<div><h3>Severity</h3>${bars(s.severity||[])}</div><div><h3>Services</h3>${bars(s.service||[])}</div>`;
    const rows = (d.rows||[]).slice(0,8);
    $('support-rows').innerHTML = rows.length ? `<div class="row support-head"><span>Severity</span><span>Service</span><span>Candidate</span><span>Count</span></div>` + rows.map(r=>`<div class="row support-row"><span>${pill(severityStatus(r.severity)).replace('Healthy',esc(r.severity)).replace('Warning',esc(r.severity)).replace('Critical',esc(r.severity))}</span><strong>${esc(r.service)}</strong><span>${esc(r.incident_candidate)}<br><small>${esc(r.error_signature)}</small></span><span>${esc(r.count_sampled)}</span></div>`).join('') : '<p class="muted">No digest rows yet.</p>';
  }catch(e){$('support-summary').innerHTML = `<p class="detail">Support digest load failed: ${esc(e.message)}</p>`}
}
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
  loadSupportDigest();
}
$('refresh').addEventListener('click', load);
load(); setInterval(load, 30000);
