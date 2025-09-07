export async function onRequest(context) {
  const URL = "https://themiaa.com/standings.aspx?path=football";
  const resp = (obj, code=200) => new Response(JSON.stringify(obj), {
    status: code,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=900, s-maxage=900",
      "access-control-allow-origin": "*"
    }
  });

  const TEAMS = ["Central Missouri","Central Oklahoma","Emporia State","Fort Hays State","Missouri Southern","Missouri Western","Nebraska-Kearney","Northwest Missouri State","Pittsburg State","Washburn"];
  const norm = s => (s||"").toLowerCase().replace(/[^a-z0-9]/g,"");

  function clean(html) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi,"")
      .replace(/<style[\s\S]*?<\/style>/gi,"")
      .replace(/&nbsp;|&#160;/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  try {
    const r = await fetch(URL, { cf: { cacheTtl: 900 }});
    if (!r.ok) throw new Error("HTTP " + r.status);
    const raw = await r.text();
    const html = raw.replace(/\r?\n/g," ");

    // Grab each table row
    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);

    const out = [];
    for (const row of rows) {
      // Cells in this row
      const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => clean(m[1]));
      if (cells.length < 3) continue;

      // Find a plausible team cell (alphabetic and matches known list)
      const teamCell = cells.find(c => TEAMS.some(t => norm(c).includes(norm(t))));
      if (!teamCell) continue;

      // Pull the first two record-looking tokens after the team cell
      const startIdx = cells.indexOf(teamCell) + 1;
      const rest = cells.slice(startIdx).join(" | ");
      const recs = [...rest.matchAll(/(\d+)-(\d+)(?:-(\d+))?/g)].map(m => m[0]);

      // Expect at least conference and overall
      const conf = recs[0] || "";
      const over = recs[1] || "";

      const [cw, cl] = (conf.match(/(\d+)-(\d+)/) || []).slice(1).map(n=>+n||0);
      const [ow, ol] = (over.match(/(\d+)-(\d+)/) || []).slice(1).map(n=>+n||0);

      // Use canonical team name from list
      const team = TEAMS.find(t => norm(teamCell).includes(norm(t))) || teamCell;

      out.push({ team, conf_w: cw||0, conf_l: cl||0, ovr_w: ow||0, ovr_l: ol||0 });
    }

    if (out.length) {
      // Sort by conference record, then overall, then name
      out.sort((a,b) => (b.conf_w - a.conf_w) || (a.conf_l - b.conf_l) || (b.ovr_w - a.ovr_w) || (a.ovr_l - b.ovr_l) || a.team.localeCompare(b.team));
      return resp({ standings: out });
    }

    // If parsing failed silently, fall through to computed fallback:
    throw new Error("No rows parsed");
  } catch (e) {
    // Fallback: compute from season games via henry API
    try {
      const year = new Date().getFullYear();
      const stat = {}; TEAMS.forEach(t=> stat[t] = {team:t, conf_w:0, conf_l:0, ovr_w:0, ovr_l:0});
      for(let w=1; w<=25; w++){
        const wk = String(w).padStart(2,'0');
        try{
          const dres = await fetch(`https://ncaa-api.henrygd.me/scoreboard/football/d2/${year}/${wk}/all-conf`, { cf: { cacheTtl: 300 }});
          if(!dres.ok) continue;
          const txt = await dres.text();
          const d = JSON.parse(txt);
          const games = Array.isArray(d?.games)? d.games : [];
          for(const g of games){
            const home = g.game?.home?.names?.short || g.game?.home?.names?.full || "";
            const away = g.game?.away?.names?.short || g.game?.away?.names?.full || "";
            const hs = +((g.game?.home?.score ?? "").toString().replace(/[^0-9]/g,"")) || null;
            const as = +((g.game?.away?.score ?? "").toString().replace(/[^0-9]/g,"")) || null;
            if(hs===null || as===null) continue;
            const inH = TEAMS.find(t=> norm(home).includes(norm(t)));
            const inA = TEAMS.find(t=> norm(away).includes(norm(t)));
            if(inH){ if(hs>as) stat[inH].ovr_w++; else if(as>hs) stat[inH].ovr_l++; }
            if(inA){ if(as>hs) stat[inA].ovr_w++; else if(hs>as) stat[inA].ovr_l++; }
            if(inH && inA){ if(hs>as){ stat[inH].conf_w++; stat[inA].conf_l++; } else if(as>hs){ stat[inA].conf_w++; stat[inH].conf_l++; } }
          }
        }catch(e2){}
      }
      const list = Object.values(stat);
      if(list.some(r=>r.ovr_w+r.ovr_l>0)){
        list.sort((a,b)=> (b.conf_w - a.conf_w) || (a.conf_l - b.conf_l) || (b.ovr_w - a.ovr_w) || (a.ovr_l - b.ovr_l) || a.team.localeCompare(b.team));
        return resp({ standings: list });
      }
    } catch (e2) {}
    return resp({ standings: [] }, 502);
  }
}