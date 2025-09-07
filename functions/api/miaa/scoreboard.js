export async function onRequest(context) {
  const url = new URL(context.request.url);
  const iso = url.searchParams.get('date') || new Date().toISOString().slice(0,10);
  const [Y,M,D] = iso.split('-');
  const mdy = `${M}-${D}-${Y}`;
  const resp = (obj, code=200) => new Response(JSON.stringify(obj), {
    status: code,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=60', 'access-control-allow-origin': '*' }
  });

  async function fetchText(u){ const r=await fetch(u,{cf:{cacheTtl:60}}); if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); }
  async function fetchJSON(u){ const r=await fetch(u,{cf:{cacheTtl:60}}); if(!r.ok) throw new Error('HTTP '+r.status); const t=await r.text(); try { return JSON.parse(t); } catch(e){ throw new Error('Bad JSON'); } }
  const n = (s) => (s||'').toLowerCase();

  const MIAA = ["Central Missouri","Central Oklahoma","Emporia State","Fort Hays State","Missouri Southern","Missouri Western","Nebraska-Kearney","Northwest Missouri State","Pittsburg State","Washburn"];

  function normal(home, away, hs, as, st, src){
    return {
      id: `${iso}:${home}:${away}`.replace(/\s+/g,'_'),
      date: iso, time: /\d/.test(st||'') ? st : '', state: st||'',
      home: {name: home, record:'', score: (hs??'')+''},
      away: {name: away, record:'', score: (as??'')+''},
      source: src
    };
  }

  // PRIMARY: MIAA scoreboard HTML
  try{
    const html = await fetchText(`https://themiaa.com/scoreboard.aspx?path=football&date=${iso}`);
    // Grab "scorebox" blocks if present
    const blocks = html.split('<div class="scorebox"').slice(1).map(b=>'<'+'div class="scorebox"'+b);
    if(blocks.length){
      const games = blocks.map(b=>{
        const tds = [...b.matchAll(/<span class="team-name">\s*([^<]+)\s*<\/span>/gi)].map(m=>m[1].trim());
        const scores = [...b.matchAll(/<span class="score">\s*(\d+)\s*<\/span>/gi)].map(m=>+m[1]);
        const status = (b.match(/<div class="status">\s*([^<]+)\s*<\/div>/i)||[])[1] || '';
        if(tds.length>=2){
          const [away, home] = tds; // SIDEARM usually lists away then home
          const [as, hs] = scores.length>=2 ? scores : ['',''];
          return normal(home, away, hs, as, status, 'themiaa.com');
        }
        return null;
      }).filter(Boolean);
      if(games.length) return resp({games});
    }
    // Fallback pairing heuristic
    const teamNames = MIAA.map(t=>t.toLowerCase());
    const lines = html.split(/\n|\r/);
    const cand = [];
    for(let i=0;i<lines.length;i++){
      const L = lines[i].toLowerCase();
      for(const t of teamNames){ if(L.includes(t)){ cand.push({i,t}); break; } }
    }
    const games2 = [];
    for(let i=0;i<cand.length-1;i+=2){
      const a=cand[i], b=cand[i+1];
      const block = lines.slice(Math.max(0,a.i-5), Math.min(lines.length,b.i+10)).join(' ');
      const nums = [...block.matchAll(/>(\d{1,3})</g)].map(m=>+m[1]);
      const status = (block.match(/(FINAL|\b\d{1,2}:\d{2}\s*(?:AM|PM)?|\bQ\d\b)/i)||[])[1] || '';
      const names = [a.t, b.t].map(x=> MIAA.find(T=>T.toLowerCase()==x) || x);
      const [away, home] = names;
      const [as, hs] = nums.length>=2? nums : ['',''];
      games2.push(normal(home, away, hs, as, status, 'themiaa.com'));
    }
    if(games2.length) return resp({games:games2});
  }catch(e){}

  // SECONDARY: data.ncaa.com
  try{
    const data = await fetchJSON(`https://data.ncaa.com/casablanca/scoreboard/football/d2/${Y}/${M}/${D}/scoreboard.json`);
    const arr = Array.isArray(data?.games) ? data.games : (Array.isArray(data?.events) ? data.events : []);
    const norm = arr.map(g=>{
      const home = g.home || g.h || g?.game?.home || {};
      const away = g.away || g.a || g?.game?.away || {};
      const status = g.status || g.s || g?.game || {};
      const id = g.id || g.gameID || g.gameId || (g.link || g.url || '').split('/').filter(Boolean).pop();
      const time = g.time || g.startTime || g.gameTime || '';
      return {
        id, date: iso, time, state: (status?.type || status?.gameState || status?.shortDetail || '').toString(),
        home: { name: home.name || home.team || home.names?.short || home.school || 'Home', record: '', score: (home.score ?? '') },
        away: { name: away.name || away.team || away.names?.short || away.school || 'Away', record: '', score: (away.score ?? '') },
        source: 'data.ncaa.com'
      };
    }).filter(g => MIAA.some(t => n(g.home.name).includes(n(t)) || n(g.away.name).includes(n(t))));
    if(norm.length) return resp({games:norm});
  }catch(e){}

  // TERTIARY: week-scan
  for(let w=1; w<=25; w++){
    const wk = String(w).padStart(2,'0');
    try{
      const d = await fetchJSON(`https://ncaa-api.henrygd.me/scoreboard/football/d2/${Y}/${wk}/all-conf`);
      const list = (Array.isArray(d?.games)? d.games:[]).filter(g => (g.game?.startDate || g.game?.start_date) === mdy).map(g => ({
        id: g.game?.gameID || (g.game?.url||'').split('/').filter(Boolean).pop(),
        date: iso, time: g.game?.startTime || '', state: g.game?.gameState || g.game?.currentPeriod || '',
        home: { name: g.game?.home?.names?.short || g.game?.home?.names?.full || 'Home', record: '', score: (g.game?.home?.score ?? '') },
        away: { name: g.game?.away?.names?.short || g.game?.away?.names?.full || 'Away', record: '', score: (g.game?.away?.score ?? '') },
        source: 'henrygd'
      })).filter(g => MIAA.some(t => n(g.home.name).includes(n(t)) || n(g.away.name).includes(n(t))));
      if(list.length) return resp({games:list});
    }catch(e){}
  }
  return resp({games:[]});
}