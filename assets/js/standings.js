/* Standings page with "Go to team" highlight */
const S = {
  tableBody: document.querySelector('#standTable tbody'),
  meta: document.getElementById('standingsMeta'),
  goto: document.getElementById('gotoTeam'),
  btnGo: document.getElementById('btnGo'),
};

async function api(path){
  const res = await fetch(path);
  if(!res.ok) throw new Error(`API ${res.status}`);
  return await res.json();
}

function highlightRow(team){
  const rows = Array.from(S.tableBody.querySelectorAll('tr'));
  rows.forEach(r => r.classList.remove('highlight'));
  const match = rows.find(r => r.firstElementChild && r.firstElementChild.textContent.toLowerCase().includes(team.toLowerCase()));
  if(match){
    match.classList.add('highlight');
    match.scrollIntoView({behavior:'smooth', block:'center'});
  }
}

async function loadStandings(){
  S.tableBody.innerHTML = `<tr><td colspan="3"><div class="loader"></div> Loading standings…</td></tr>`;
  try{
    const data = await api('/api/miaa/standings');
    const list = data.standings || [];
    if(!list.length) throw new Error('empty');
    const rows = list.map(r => `<tr><td>${r.team}</td><td>${r.conf_w}-${r.conf_l}</td><td>${r.ovr_w}-${r.ovr_l}</td></tr>`).join('');
    S.tableBody.innerHTML = rows;
    S.meta.textContent = `Last updated ${new Date().toLocaleDateString()}`;
  }catch(e){
    S.tableBody.innerHTML = `<tr><td colspan="3">Failed to load standings.</td></tr>`;
  }
}

S.btnGo.addEventListener('click', ()=>{ if(S.goto.value.trim()) highlightRow(S.goto.value.trim()); });
S.goto.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && S.goto.value.trim()) highlightRow(S.goto.value.trim()); });

loadStandings();