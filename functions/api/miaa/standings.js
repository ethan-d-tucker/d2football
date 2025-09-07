export async function onRequest(context) {
  const resp = (obj, code=200) => new Response(JSON.stringify(obj), {
    status: code,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=300', 'access-control-allow-origin': '*' }
  });
  async function fetchText(u){ const r=await fetch(u,{cf:{cacheTtl:300}}); if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); }
  async function fetchJSON(u){ const r=await fetch(u,{cf:{cacheTtl:300}}); if(!r.ok) throw new Error('HTTP '+r.status); const t=await r.text(); return JSON.parse(t); }
  const TEAMS = ["Central Missouri","Central Oklahoma","Emporia State","Fort Hays State","Missouri Southern","Missouri Western","Nebraska-Kearney","Northwest Missouri State","Pittsburg State","Washburn"];
  const norm = s => (s||'').toLowerCase();

  // 1) Try parsing the official MIAA standings page
  try{
    const html = await fetchText('https://themiaa.com/standings.aspx?path=football');
    const rows = [...html.matchAll(/<tr[^>]*>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*>\s*(\d+)\s*-\s*(\d+)\s*<\/td>\s*<td[^>]*>\s*(\d+)\s*-\s*(\d+)\s*<\/td>/gi)];
    let list = rows.map(m => ({ team:m[1].trim(), conf_w:+m[2], conf_l:+m[3], ovr_w:+m[4], ovr_l:+m[5]}))
                   .filter(r => TEAMS.some(t => norm(r.team).includes(norm(t))));
    if(list.length){
      list.sort((a,b)=> (b.conf_w - a.conf_w) || (a.conf_l - b.conf_l) || a.team.localeCompare(b.team));
      return resp({standings:list});
    }
  }catch(e){}

  // 2) Computed fallback from season games
  try{
    const year = new Date().getFullYear();
    const stat = {}; TEAMS.forEach(t=> stat[t] = {team:t, conf_w:0, conf_l:0, ovr_w:0, ovr_l:0});
    for(let w=1; w<=25; w++){
      const wk = String(w).padStart(2,'0');
      try{
        const d = await fetchJSON(`https://ncaa-api.henrygd.me/scoreboard/football/d2/${year}/${wk}/all-conf`);
        const games = Array.isArray(d?.games)? d.games : [];
        for(const g of games){
          const home = g.game?.home?.names?.short || g.game?.home?.names?.full || '';
          const away = g.game?.away?.names?.short || g.game?.away?.names?.full || '';
          const hs = +((g.game?.home?.score ?? '').toString().replace(/[^0-9]/g,'')) || null;
          const as = +((g.game?.away?.score ?? '').toString().replace(/[^0-9]/g,'')) || null;
          if(hs===null || as===null) continue;
          const inH = TEAMS.find(t=> norm(home).includes(norm(t)));
          const inA = TEAMS.find(t=> norm(away).includes(norm(t)));
          if(inH){ if(hs>as) stat[inH].ovr_w++; else if(as>hs) stat[inH].ovr_l++; }
          if(inA){ if(as>hs) stat[inA].ovr_w++; else if(hs>as) stat[inA].ovr_l++; }
          if(inH && inA){ if(hs>as){ stat[inH].conf_w++; stat[inA].conf_l++; } else if(as>hs){ stat[inA].conf_w++; stat[inH].conf_l++; } }
        }
      }catch(e){}
    }
    const list = Object.values(stat);
    if(list.some(r=>r.ovr_w+r.ovr_l>0)){
      list.sort((a,b)=> (b.conf_w - a.conf_w) || (a.conf_l - b.conf_l) || (b.ovr_w - a.ovr_w) || (a.ovr_l - b.ovr_l) || a.team.localeCompare(b.team));
      return resp({standings:list});
    }
  }catch(e){}

  return resp({standings:[]}, 502);
}