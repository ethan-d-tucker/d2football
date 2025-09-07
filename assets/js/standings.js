/* Standings page with dropdown Go-to */
const S = {
  body: document.querySelector('#standTable tbody'),
  meta: document.getElementById('standingsMeta'),
  goto: document.getElementById('gotoTeam'),
  btn: document.getElementById('btnGo'),
};
async function api(p){ const r = await fetch(p); if(!r.ok) throw new Error('API '+r.status); return r.json(); }
function highlight(team){
  const rows = Array.from(S.body.querySelectorAll('tr'));
  rows.forEach(r=> r.classList.remove('highlight'));
  const m = rows.find(r => r.firstElementChild && r.firstElementChild.textContent.toLowerCase().includes(team.toLowerCase()));
  if(m){ m.classList.add('highlight'); m.scrollIntoView({behavior:'smooth', block:'center'}); }
}
async function load(){
  S.body.innerHTML = `<tr><td colspan="3"><div class="loader"></div> Loading standings…</td></tr>`;
  try {
    const data = await api('/api/miaa/standings');
    const list = data.standings || [];
    if(!list.length) throw new Error('empty');
    S.body.innerHTML = list.map(r=> `<tr><td>${r.team}</td><td>${r.conf_w}-${r.conf_l}</td><td>${r.ovr_w}-${r.ovr_l}</td></tr>`).join('');
    S.meta.textContent = `Last updated ${new Date().toLocaleDateString()}`;
  } catch (e) {
    S.body.innerHTML = `<tr><td colspan="3">Failed to load standings.</td></tr>`;
  }
}
S.btn.addEventListener('click', ()=>{ if(S.goto.value) highlight(S.goto.value); });
S.goto.addEventListener('change', ()=>{ if(S.goto.value) highlight(S.goto.value); });
load();
