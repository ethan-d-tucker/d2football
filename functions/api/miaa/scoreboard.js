export async function onRequest(context) {
  const url = new URL(context.request.url);
  const iso = url.searchParams.get('date') || new Date().toISOString().slice(0,10);

  const resp = (obj, code=200) => new Response(JSON.stringify(obj), {
    status: code,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30, s-maxage=60",
      "access-control-allow-origin": "*"
    }
  });

  // MIAA teams + aliases (to filter out non-conference noise if any)
  const TEAMS = ["Central Missouri","Central Oklahoma","Emporia State","Fort Hays State","Missouri Southern","Missouri Western","Nebraska-Kearney","Northwest Missouri State","Pittsburg State","Washburn"];
  const ALIASES = [
    ["Nebraska-Kearney","Neb.-Kearney","Neb Kearney","Nebraska–Kearney","Nebraska Kearney","UNK"],
    ["Northwest Missouri State","Northwest Mo. St.","NW Missouri State","NW Mo. St.","Northwest Missouri","Northwest Mo St","NWMSU"],
    ["Missouri Southern","Mo. Southern","Missouri Southern St.","Missouri Southern State","MSSU"],
    ["Missouri Western","Mo. Western","Missouri Western St.","Missouri Western State","MWSU"],
    ["Fort Hays State","Fort Hays","FHSU"],
    ["Central Oklahoma","UCO","Central Okla."],
    ["Pittsburg State","Pitt State","Pittsburg St.","PSU"],
    ["Emporia State","Emporia St.","ESU"],
    ["Central Missouri","Central Mo.","Central Missouri St.","UCM"],
    ["Washburn","Washburn U","WU"]
  ];
  const norm = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const canon = (name) => {
    const n = norm(name);
    for(const [c, ...alts] of ALIASES){ if(n.includes(norm(c))) return c; for(const a of alts){ if(n.includes(norm(a))) return c; } }
    for(const t of TEAMS){ if(n.includes(norm(t))) return t; }
    return null;
  };

  async function getText(u){
    const r = await fetch(u, { cf:{ cacheTtl: 60 } });
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.text();
  }

  function parseScoreboard(html){
    // Split into scoreboxes (Sidearm block)
    const blocks = html.split('<div class="scorebox"').slice(1).map(b => '<div class="scorebox"'+b);
    const games = [];
    for(const b of blocks){
      // Names
      const names = [...b.matchAll(/<span class="team-name">\s*([^<]+)\s*<\/span>/gi)].map(m=>m[1].trim());
      if(names.length < 2) continue;
      const [awayName, homeName] = names;
      // Filter to MIAA
      const H = canon(homeName), A = canon(awayName);
      if(!H && !A) continue;

      // Scores (if present)
      const scores = [...b.matchAll(/<span class="score">\s*([0-9]+)\s*<\/span>/gi)].map(m=>m[1]);
      const [awayScore, homeScore] = scores.length >= 2 ? [scores[0], scores[1]] : ['', ''];

      // Status/time
      const status = (b.match(/<div class="status">\s*([^<]+)\s*<\/div>/i) || b.match(/<div class="game-status">\s*([^<]+)\s*<\/div>/i) || [])[1] || '';
      const time = (b.match(/<div class="game-time">\s*([^<]+)\s*<\/div>/i) || [])[1] || '';

      // Box Score link (first "Box Score" anchor inside this scorebox)
      const box = (b.match(/<a[^>]+href="([^"]+)"[^>]*>\s*Box\s*Score\s*<\/a>/i) || [])[1] || '';
      const link = box ? (box.startsWith('http') ? box : `https://themiaa.com${box}`) : '';

      // Build object
      const obj = {
        id: `${iso}:${H||homeName}:${A||awayName}`.replace(/\s+/g,'_'),
        date: iso,
        time: time || '',
        state: status || (homeScore && awayScore ? 'Final' : ''),
        home: { name: H || homeName, record: '', score: homeScore },
        away: { name: A || awayName, record: '', score: awayScore },
        source: "themiaa.com",
        link
      };
      games.push(obj);
    }
    return games;
  }

  async function fetchMIAA(iso){
    // Sidearm has both /scoreboard/ and legacy /scoreboard.aspx. Try both for robustness.
    const urls = [
      `https://themiaa.com/scoreboard.aspx?path=football&date=${iso}`,
      `https://themiaa.com/scoreboard/?path=football&date=${iso}`,
      `https://themiaa.com/scoreboard/?date=${iso}&path=football`
    ];
    for(const u of urls){
      try{
        const html = await getText(u);
        const list = parseScoreboard(html);
        if(list.length) return list;
      }catch(e){ /* try next */ }
    }
    return [];
  }

  try{
    const games = await fetchMIAA(iso);
    return resp({games});
  }catch(e){
    return resp({games:[]}, 502);
  }
}