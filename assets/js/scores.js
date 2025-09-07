/* Scores page with quick-jump buttons */
const els = {
  scoresList: document.getElementById('scoresList'),
  scoresMeta: document.getElementById('scoresMeta'),
  datePicker: document.getElementById('datePicker'),
  prevDay: document.getElementById('prevDay'),
  nextDay: document.getElementById('nextDay'),
  teamFilter: document.getElementById('teamFilter'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  modalClose: document.getElementById('modalClose'),
  btnToday: document.getElementById('btnToday'),
  btnLastSat: document.getElementById('btnLastSat'),
  btnNextSat: document.getElementById('btnNextSat'),
};

function fmtDateISO(d){ return d.toISOString().slice(0,10); }
function addDays(date, delta){ const d=new Date(date); d.setDate(d.getDate()+delta); return d; }
function todayLocalISO(){ const now = new Date(); const tzOff = now.getTimezoneOffset(); return fmtDateISO(new Date(now.getTime()-tzOff*60000)); }
function isToday(dateISO){ return dateISO === todayLocalISO(); }

function lastSaturday(d=new Date()){
  const x = new Date(d);
  const diff = (x.getDay() + 1) % 7; // Sat=6 => 0
  x.setDate(x.getDate() - diff);
  return x;
}
function nextSaturday(d=new Date()){
  const x = new Date(d);
  const diff = (6 - x.getDay() + 7) % 7;
  x.setDate(x.getDate() + (diff === 0 ? 7 : diff));
  return x;
}

function badge(state, time){
  const s = (state||'').toLowerCase();
  const final = s.includes('final');
  const live = s.includes('live') || s.includes('q');
  const cls = final ? 'badge final' : live ? 'badge live' : 'badge';
  const label = final ? 'FINAL' : (time || 'TBD');
  return `<span class="${cls}">${label}</span>`;
}
function teamBlock(t){
  const score = (t.score === '' || t.score === undefined || t.score === null) ? '—' : t.score;
  return `<div class="team"><div class="name">${t.name}</div><div class="rec">${t.record||''}</div><div class="score">${score}</div></div>`;
}
function buildGameCard(g){
  return `<article class="card" data-id="${g.id||''}">
    <div class="row">
      <div class="teams">${teamBlock(g.away)}<span class="at">@</span>${teamBlock(g.home)}</div>
      <div class="actions">${badge(g.state, g.time)} ${g.id?`<button class="btn btn-box" data-id="${g.id}">Box</button>`:''}</div>
    </div>
    <div class="row small"><span>${g.date || ''}</span><span class="muted">${g.source}</span></div>
  </article>`;
}

function renderScores(list, iso){
  const term = els.teamFilter.value.trim().toLowerCase();
  const filtered = term ? list.filter(g => g.home.name.toLowerCase().includes(term) || g.away.name.toLowerCase().includes(term)) : list;
  els.scoresMeta.textContent = `${filtered.length} game${filtered.length===1?'':'s'} • ${iso} • Last updated ${new Date().toLocaleTimeString()}`;
  els.scoresList.innerHTML = filtered.map(buildGameCard).join('') || `<div class="card">No games found.</div>`;
  document.querySelectorAll('.btn-box').forEach(b => b.addEventListener('click', ()=> openBox(b.dataset.id)));
}

async function api(path){
  const res = await fetch(path);
  if(!res.ok) throw new Error(`API ${res.status}`);
  return await res.json();
}
async function loadScoresForDate(iso){
  els.scoresList.innerHTML = `<div class="card"><div class="loader"></div> Loading…</div>`;
  try{
    const data = await api(`/api/miaa/scoreboard?date=${iso}`);
    renderScores(data.games||[], iso);
  }catch(e){
    els.scoresList.innerHTML = `<div class="card">Could not load games for this date.</div>`;
    els.scoresMeta.textContent = `0 games • ${iso} • Last updated ${new Date().toLocaleTimeString()}`;
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

/* Modal */
function openModal(title, html){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modal').style.display = 'flex';
}
function closeModal(){ document.getElementById('modal').style.display = 'none'; }
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', (e)=>{ if(e.target.id==='modal') closeModal(); });

/* Date controls + quick jumps + init */
function setDateISO(iso){ els.datePicker.value = iso; }
function moveDay(delta){ setDateISO(fmtDateISO(addDays(new Date(els.datePicker.value), delta))); loadScoresForDate(els.datePicker.value); }
els.prevDay.addEventListener('click', ()=>moveDay(-1));
els.nextDay.addEventListener('click', ()=>moveDay(+1));
els.datePicker.addEventListener('change', ()=>loadScoresForDate(els.datePicker.value));
els.btnToday.addEventListener('click', ()=>{ const iso=todayLocalISO(); setDateISO(iso); loadScoresForDate(iso); });
els.btnLastSat.addEventListener('click', ()=>{ const iso=fmtDateISO(lastSaturday()); setDateISO(iso); loadScoresForDate(iso); });
els.btnNextSat.addEventListener('click', ()=>{ const iso=fmtDateISO(nextSaturday()); setDateISO(iso); loadScoresForDate(iso); });

(function init(){
  const iso = todayLocalISO();
  setDateISO(iso);
  loadScoresForDate(iso);
  setInterval(()=>{ if(isToday(els.datePicker.value)) loadScoresForDate(els.datePicker.value); }, 60000);
  els.teamFilter.addEventListener('input', ()=> loadScoresForDate(els.datePicker.value));
})();