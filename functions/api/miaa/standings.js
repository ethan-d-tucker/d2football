export async function onRequest(context) {
  const URL = "https://themiaa.com/standings.aspx?path=football";
  const resp = (obj, code=200) => new Response(JSON.stringify(obj), {
    status: code, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"public, max-age=900, s-maxage=900", "access-control-allow-origin":"*" }
  });
  const TEAMS = ["Central Missouri","Central Oklahoma","Emporia State","Fort Hays State","Missouri Southern","Missouri Western","Nebraska-Kearney","Northwest Missouri State","Pittsburg State","Washburn"];
  const norm = s => (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const clean = h => h.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"").replace(/&nbsp;|&#160;/g," ").replace(/\s+/g," ").trim();

  try{
    const r = await fetch(URL, { cf:{cacheTtl:900} });
    if(!r.ok) throw new Error("HTTP "+r.status);
    const html = (await r.text()).replace(/\r?\n/g," ");
    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
    const out = [];
    for(const row of rows){
      const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=> clean(m[1]));
      if(cells.length < 3) continue;
      const teamCell = cells.find(c => TEAMS.some(t => norm(c).includes(norm(t))));
      if(!teamCell) continue;
      const startIdx = cells.indexOf(teamCell) + 1;
      const rest = cells.slice(startIdx).join(" | ");
      const recs = [...rest.matchAll(/(\d+)-(\d+)(?:-(\d+))?/g)].map(m => m[0]);
      const conf = recs[0] || ""; const over = recs[1] || "";
      const [cw, cl] = (conf.match(/(\d+)-(\d+)/) || []).slice(1).map(n=>+n||0);
      const [ow, ol] = (over.match(/(\d+)-(\d+)/) || []).slice(1).map(n=>+n||0);
      const team = TEAMS.find(t => norm(teamCell).includes(norm(t))) || teamCell;
      out.push({ team, conf_w: cw||0, conf_l: cl||0, ovr_w: ow||0, ovr_l: ol||0 });
    }
    if(out.length){
      out.sort((a,b)=> (b.conf_w - a.conf_w) || (a.conf_l - b.conf_l) || (b.ovr_w - a.ovr_w) || (a.ovr_l - b.ovr_l) || a.team.localeCompare(b.team));
      return resp({ standings: out });
    }
    throw new Error("no rows");
  }catch(e){
    // fallback to computed standings if parse fails
    try{
      const year = new Date().getFullYear();
      const stat = {}; TEAMS.forEach(t=> stat[t] = {team:t, conf_w:0, conf_l:0, ovr_w:0, ovr_l:0});
      for(let w=1; w<=25; w++){
        try{
          const dres = await fetch(`https://ncaa-api.henrygd.me/scoreboard/football/d2/${year}/${String(w).padStart(2,'0')}/all-conf`, { cf:{cacheTtl:300} });
          if(!dres.ok) continue; const d = JSON.parse(await dres.text()); const games = Array.isArray(d?.games)? d.games:[];
          for(const g of games){
            const h = (g.game?.home?.names?.short || g.game?.home?.names?.full || "").toLowerCase();
            const a = (g.game?.away?.names?.short || g.game?.away?.names?.full || "").toLowerCase();
            const hs = +((g.game?.home?.score ?? '').toString().replace(/[^0-9]/g,'')) || null;
            const as = +((g.game?.away?.score ?? '').toString().replace(/[^0-9]/g,'')) || null;
            const H = TEAMS.find(t=> h.includes(t.toLowerCase())); const A = TEAMS.find(t=> a.includes(t.toLowerCase()));
            if(hs===null || as===null) continue;
            if(H){ if(hs>as) stat[H].ovr_w++; else if(as>hs) stat[H].ovr_l++; }
            if(A){ if(as>hs) stat[A].ovr_w++; else if(hs>as) stat[A].ovr_l++; }
            if(H && A){ if(hs>as){ stat[H].conf_w++; stat[A].conf_l++; } else if(as>hs){ stat[A].conf_w++; stat[H].conf_l++; } }
          }
        }catch(e2){}
      }
      const list = Object.values(stat);
      if(list.some(x=>x.ovr_w+x.ovr_l>0)){
        list.sort((a,b)=> (b.conf_w - a.conf_w) || (a.conf_l - b.conf_l) || (b.ovr_w - a.ovr_w) || (a.ovr_l - b.ovr_l) || a.team.localeCompare(b.team));
        return resp({ standings: list });
      }
    }catch(e2){}
    return resp({ standings: [] }, 502);
  }
}