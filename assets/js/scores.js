/* Scores page with team dropdown + box scores */
const els = {
  list: document.getElementById('scoresList'),
  meta: document.getElementById('scoresMeta'),
  date: document.getElementById('datePicker'),
  prev: document.getElementById('prevDay'),
  next: document.getElementById('nextDay'),
  team: document.getElementById('teamSelect'),
  btnToday: document.getElementById('btnToday'),
  btnLastSat: document.getElementById('btnLastSat'),
  btnNextSat: document.getElementById('btnNextSat'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  modalClose: document.getElementById('modalClose'),
};

const MIAA = ["Central Missouri","Central Oklahoma","Emporia State","Fort Hays State","Missouri Southern","Missouri Western","Nebraska-Kearney","Northwest Missouri State","Pittsburg State","Washburn"];
const ALIASES = [
  ["Nebraska-Kearney","Neb.-Kearney","Neb Kearney","Nebraska–Kearney","Nebraska Kearney","UNK"],
  ["Northwest Missouri State","Northwest Mo. St.","NW Missouri State","NW Mo. St.","Northwest Missouri","Northwest Mo St"],
  ["Missouri Southern","Mo. Southern","Missouri Southern St.","Missouri Southern State"],
  ["Missouri Western","Mo. Western","Missouri Western St.","Missouri Western State"],
  ["Fort Hays State","Fort Hays","FHSU"],
  ["Central Oklahoma","UCO"],
  ["Pittsburg State","Pitt State","Pittsburg St."],
  ["Emporia State","Emporia St."],
  ["Central Missouri","Central Mo.","Central Missouri St."],
  ["Washburn","Washburn U"]
];
function norm(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function matchesTeam(name){
  const n = norm(name);
  for(const [canon, ...alts] of ALIASES){ if(n.includes(norm(canon))) return canon; for(const a of alts){ if(n.includes(norm(a))) return canon; } }
  for(const t of MIAA){ if(n.includes(norm(t))) return t; }
  return null;
}
function fmtDateISO(d){ return d.toISOString().slice(0,10); }
function addDays(date, delta){ const d=new Date(date); d.setDate(d.getDate()+delta); return d; }
function todayLocalISO(){ const now = new Date(); const tzOff = now.getTimezoneOffset(); return fmtDateISO(new Date(now.getTime()-tzOff*60000)); }
function isToday(iso){ return iso === todayLocalISO(); }
function lastSaturday(d=new Date()){ const x=new Date(d); const diff=(x.getDay()+1)%7; x.setDate(x.getDate()-diff); return x; }
function nextSaturday(d=new Date()){ const x=new Date(d); const diff=(6-x.getDay()+7)%7; x.setDate(x.getDate()+(diff===0?7:diff)); return x; }

function badge(state, time){
  const s=(state||'').toLowerCase();
  const final=s.includes('final'); const live=s.includes('live')||s.includes('q');
  const cls = final?'badge final': live?'badge live':'badge';
  const label = final?'FINAL':(time||'TBD');
  return `<span class="${cls}">${label}</span>`;
}
function teamBlock(t){ const score=(t.score===''||t.score==null)?'—':t.score; return `<div class="team"><div class="name">${t.name}</div><div class="rec">${t.record||''}</div><div class="score">${score}</div></div>`; }
function card(g){ const box=g.link?`<a class="btn" href="${g.link}" target="_blank" rel="noopener">Box</a>`:(g.id?`<button class="btn btn-box" data-id="${g.id}">Box</button>`:''); return `<article class="card" data-id="${g.id||''}"><div class="row"><div class="teams">${teamBlock(g.away)}<span class="at">@</span>${teamBlock(g.home)}</div><div class="actions">${badge(g.state,g.time)} ${box}</div></div><div class="row small"><span>${g.date||''}</span><span class="muted">${g.source}</span></div></article>`; }

async function api(path){ const r = await fetch(path); if(!r.ok) throw new Error('API '+r.status); return r.json(); }
async function load(iso){
  els.list.innerHTML = `<div class="card"><div class="loader"></div> Loading…</div>`;
  try{
    const data = await api(`/api/miaa/scoreboard?date=${iso}`);
    let games = data.games||[];
    const t = els.team.value.trim();
    if(t){ games = games.filter(g => g.home.name===t || g.away.name===t); }
    els.meta.textContent = `${games.length} game${games.length===1?'':'s'} • ${iso} • Last updated ${new Date().toLocaleTimeString()}`;
    els.list.innerHTML = games.map(card).join('') || `<div class="card">No games found.</div>`;
    document.querySelectorAll('.btn-box').forEach(b => b.addEventListener('click', ()=> openBox(b.dataset.id)));
  }catch(e){
    els.list.innerHTML = `<div class="card">Could not load games for this date.</div>`;
    els.meta.textContent = `0 games • ${iso} • Last updated ${new Date().toLocaleTimeString()}`;
  }
}
async function openBox(id){
  try{
    const data = await api(`/api/miaa/boxscore?id=${encodeURIComponent(id)}`);
    const title = `${data?.gameInfo?.away?.name || 'Away'} @ ${data?.gameInfo?.home?.name || 'Home'}`;
    let html = '';
    if(data?.linescore){
      const lines = data.linescore;
      const th = lines[0]?.map((_,i)=> i===0?'':`Q${i}`).filter(Boolean).join('</th><th>');
      const rows = lines.map(row=>`<tr>${row.map((c,i)=> i===0?`<th>${c}</th>`:`<td>${c}</td>`).join('')}</tr>`).join('');
      html += `<table class="table"><thead><tr><th></th><th>${th}</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    if(data?.teamStats){
      const rows = Object.entries(data.teamStats).map(([k,v])=>`<tr><th>${k.replace(/_/g,' ')}</th><td>${v}</td></tr>`).join('');
      html += `<h3>Team Stats</h3><table class="table"><tbody>${rows}</tbody></table>`;
    }
    if(!html) html = `<pre class="small">${JSON.stringify(data,null,2)}</pre>`;
    openModal(title, html);
  }catch(e){
    openModal('Box Score', `<div class="card">Unable to load box score.</div>`);
  }
}
function openModal(title, html){ document.getElementById('modalTitle').textContent = title; document.getElementById('modalBody').innerHTML = html; els.modal.style.display='flex'; }
function closeModal(){ els.modal.style.display='none'; }
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', (e)=>{ if(e.target.id==='modal') closeModal(); });

function setDateISO(iso){ els.date.value=iso; }
function moveDay(delta){ setDateISO(fmtDateISO(addDays(new Date(els.date.value), delta))); load(els.date.value); }
els.prev.addEventListener('click', ()=>moveDay(-1));
els.next.addEventListener('click', ()=>moveDay(+1));
els.date.addEventListener('change', ()=>load(els.date.value));
els.btnToday.addEventListener('click', ()=>{ const iso=todayLocalISO(); setDateISO(iso); load(iso); });
els.btnLastSat.addEventListener('click', ()=>{ const iso=fmtDateISO(lastSaturday()); setDateISO(iso); load(iso); });
els.btnNextSat.addEventListener('click', ()=>{ const iso=fmtDateISO(nextSaturday()); setDateISO(iso); load(iso); });
els.team.addEventListener('change', ()=> load(els.date.value));

(function init(){ const iso=todayLocalISO(); setDateISO(iso); load(iso); setInterval(()=>{ if(isToday(els.date.value)) load(els.date.value); }, 60000); })();
