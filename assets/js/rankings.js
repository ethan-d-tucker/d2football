
const T = { body: document.querySelector('#rankTable tbody'), meta: document.getElementById('rankMeta') };
async function api(p){ const r = await fetch(p); if(!r.ok) throw new Error('API '+r.status); return r.json(); }
async function load(){
  T.body.innerHTML = `<tr><td colspan="4"><div class="loader"></div> Loading Top 25…</td></tr>`;
  try {
    const data = await api('/api/rankings');
    const rows = (data?.ranks||[]).map(r => `<tr><td>${r.rank}</td><td>${r.team}</td><td>${r.record||''}</td><td>${r.notes||''}</td></tr>`).join('');
    T.body.innerHTML = rows || `<tr><td colspan="4">No rankings available.</td></tr>`;
    if(data?.asOf) T.meta.textContent = `As of ${data.asOf}`;
  } catch(e){
    T.body.innerHTML = `<tr><td colspan="4">Failed to load rankings.</td></tr>`;
  }
}
load();
