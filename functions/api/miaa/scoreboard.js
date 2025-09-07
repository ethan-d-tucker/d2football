export async function onRequest(context) {
  const url = new URL(context.request.url);
  const iso = url.searchParams.get('date') || new Date().toISOString().slice(0,10);
  const [Y,M,D] = iso.split('-');
  const mdy = `${M}-${D}-${Y}`;
  const resp = (obj, code=200) => new Response(JSON.stringify(obj), {
    status: code, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=60', 'access-control-allow-origin': '*' }
  });
  const TEAMS = ["Central Missouri","Central Oklahoma","Emporia State","Fort Hays State","Missouri Southern","Missouri Western","Nebraska-Kearney","Northwest Missouri State","Pittsburg State","Washburn"];
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
  const norm = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const belongs = (name) => {
    const n = norm(name);
    for(const [canon, ...alts] of ALIASES){ if(n.includes(norm(canon))) return canon; for(const a of alts){ if(n.includes(norm(a))) return canon; } }
    for(const t of TEAMS){ if(n.includes(norm(t))) return t; }
    return null;
  };
  const normal = (home, away, hs, as, state, time, id, src) => ({
    id: id || `${iso}:${home}:${away}`.replace(/\s+/g,'_'),
    date: iso, time: time||'', state: state||'',
    home: {name: home, record:'', score: (hs??'')+''},
    away: {name: away, record:'', score: (as??'')+''},
    source: src
  });
  async function getJSON(u){ const r = await fetch(u,{cf:{cacheTtl:60}}); if(!r.ok) throw new Error('HTTP '+r.status); const t=await r.text(); return JSON.parse(t); }
  async function getText(u){ const r = await fetch(u,{cf:{cacheTtl:60}}); if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); }

  // 1) Try MIAA scoreboard (if structure fits)
  try{
    const html = await getText(`https://themiaa.com/scoreboard.aspx?path=football&date=${iso}`);
    const blocks = html.split('<div class="scorebox"').slice(1).map(b=>'<'+'div class="scorebox"'+b);
    if(blocks.length){
      const games = blocks.map(b=>{
        const tds = [...b.matchAll(/<span class="team-name">\s*([^<]+)\s*<\/span>/gi)].map(m=>m[1].trim());
        const scores = [...b.matchAll(/<span class="score">\s*(\d+)\s*<\/span>/gi)].map(m=>+m[1]);
        const status = (b.match(/<div class="status">\s*([^<]+)\s*<\/div>/i)||[])[1] || '';
        if(tds.length>=2){
          const [away, home] = tds; const [as, hs] = scores.length>=2? scores : ['',''];
          const hB=belongs(home), aB=belongs(away); if(!hB && !aB) return null;
          return normal(hB||home, aB||away, hs, as, status, '', '', 'themiaa.com');
        } return null;
      }).filter(Boolean);
      if(games.length) return resp({games});
    }
  }catch(e){}

  // 2) data.ncaa.com for the day (filter to MIAA by alias match)
  try{
    const data = await getJSON(`https://data.ncaa.com/casablanca/scoreboard/football/d2/${Y}/${M}/${D}/scoreboard.json`);
    const arr = Array.isArray(data?.games) ? data.games : (Array.isArray(data?.events) ? data.events : []);
    const list = arr.map(g=>{
      const home = g.home || g.h || g?.game?.home || {};
      const away = g.away || g.a || g?.game?.away || {};
      const status = g.status || g.s || g?.game || {};
      const id = g.id || g.gameID || g.gameId || (g.link || g.url || '').split('/').filter(Boolean).pop();
      const time = g.time || g.startTime || g.gameTime || '';
      const H = belongs(home.name || home.team || home.names?.short || home.school); const A = belongs(away.name || away.team || away.names?.short || away.school);
      return normal(H||home.name||home.team||home.names?.short||home.school||'Home', A||away.name||away.team||away.names?.short||away.school||'Away', home.score, away.score, (status?.type || status?.gameState || status?.shortDetail || '').toString(), time, id, 'data.ncaa.com');
    }).filter(g => belongs(g.home.name) || belongs(g.away.name));
    if(list.length) return resp({games:list});
  }catch(e){}

  // 3) Week scan via henrygd (reliable & CORS-ok)
  for(let w=1; w<=25; w++){
    const wk = String(w).padStart(2,'0');
    try{
      const d = await getJSON(`https://ncaa-api.henrygd.me/scoreboard/football/d2/${Y}/${wk}/all-conf`);
      const raw = Array.isArray(d?.games)? d.games:[];
      const byDate = raw.filter(g => (g.game?.startDate || g.game?.start_date) === mdy);
      const mapped = byDate.map(g => {
        const homeN = g.game?.home?.names?.short || g.game?.home?.names?.full || 'Home';
        const awayN = g.game?.away?.names?.short || g.game?.away?.names?.full || 'Away';
        const H = belongs(homeN), A = belongs(awayN);
        if(!H && !A) return null;
        const id = g.game?.gameID || (g.game?.url||'').split('/').filter(Boolean).pop();
        return normal(H||homeN, A||awayN, g.game?.home?.score ?? '', g.game?.away?.score ?? '', g.game?.gameState || g.game?.currentPeriod || '', g.game?.startTime || '', id, 'henrygd');
      }).filter(Boolean);
      if(mapped.length) return resp({games:mapped});
    }catch(e){}
  }
  return resp({games:[]});
}