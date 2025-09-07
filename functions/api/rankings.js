export async function onRequest(context) {
  const url = 'https://www.d2football.com/top25/';
  const resp = (obj, code=200) => new Response(JSON.stringify(obj), {
    status: code, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=1800, s-maxage=1800', 'access-control-allow-origin': '*' }
  });
  async function getText(u){ const r = await fetch(u, {cf:{cacheTtl:1800}}); if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); }
  try{
    const html = await getText(url);
    let asOf = (html.match(/(\bAs of[^<]+)<\/|<em>\s*([^<]*updated[^<]*)/i)||[])[1] || '';
    const rows = [];
    // Try a <table> layout
    const table = html.match(/<table[\s\S]*?<\/table>/i);
    if(table){
      const tr = [...table[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].slice(1); // skip header
      for(const m of tr){
        const cells = [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>x[1]);
        const clean = s => s.replace(/<[^>]+>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
        const c = cells.map(clean);
        if(c.length>=2){
          const rank = (c[0].match(/\d+/)||[])[0] || '';
          const team = c[1];
          const record = (c[2]||'').match(/\d+-\d+(?:-\d+)?/)?.[0] || '';
          rows.push({rank, team, record, notes: c.slice(3).join(' • ').trim()});
        }
      }
    }
    // Fallback: list items
    if(rows.length===0){
      const li = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(x=>x[1]);
      const clean = s => s.replace(/<[^>]+>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
      for(const it of li){
        const t = clean(it);
        const m = t.match(/^(\d{1,2})\.\s*(.*?)(\s+\d+-\d+(?:-\d+)?)?$/);
        if(m){ rows.push({rank:m[1], team:m[2].trim(), record:m[3]?.trim()||'', notes:''}); }
      }
    }
    return resp({asOf, ranks: rows});
  }catch(e){
    return resp({ranks:[]}, 502);
  }
}