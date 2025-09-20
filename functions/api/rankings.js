export async function onRequest(context) {
  const resp = (obj, code=200) => new Response(JSON.stringify(obj), {
    status: code, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=1800, s-maxage=1800', 'access-control-allow-origin': '*' }
  });
  async function getText(u){ const r = await fetch(u, {cf:{cacheTtl:1800}}); if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); }

  try{
    const html = await getText('https://www.d2football.com/top25/');
    const ranks = [];
    const table = html.match(/<table[\s\S]*?<\/table>/i);
    const clean = s => s.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
    if(table){
      const trs = [...table[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].slice(1);
      for(const tr of trs){
        const cells = [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=> clean(x[1]));
        if(cells.length>=2){
          const rank = (cells[0].match(/\d+/)||[])[0] || '';
          const team = cells[1];
          const record = (cells[2]||'').match(/\d+-\d+(?:-\d+)?/)?.[0] || '';
          const notes = cells.slice(3).join(' • ').trim();
          if(rank && team) ranks.push({rank, team, record, notes});
        }
      }
    }
    if(!ranks.length){
      const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(x=> clean(x[1]));
      for(const it of items){
        const m = it.match(/^(\d{1,2})\.\s*(.*?)(\s+\d+-\d+(?:-\d+)?)?$/);
        if(m) ranks.push({rank:m[1], team:m[2], record:m[3]||'', notes:''});
      }
    }
    if(ranks.length) return resp({source:'d2football', ranks});
  }catch(e){}

  try{
    const html = await getText('https://afca.com/polls/');
    const section = (html.match(/NCAA Division II[\s\S]*?<\/table>/i) || [])[0];
    const ranks = [];
    if(section){
      const table = section.match(/<table[\s\S]*?<\/table>/i)[0];
      const clean = s => s.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
      const trs = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].slice(1);
      for(const tr of trs){
        const cells = [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=> clean(x[1]));
        const rank = (cells[0]||'').match(/\d+/)?.[0] || '';
        const team = cells[1] || '';
        const record = (cells[2]||'').match(/\d+-\d+(?:-\d+)?/)?.[0] || '';
        if(rank && team) ranks.push({rank, team, record, notes:''});
      }
      if(ranks.length) return resp({source:'afca', ranks});
    }
  }catch(e){}

  return resp({ranks:[]}, 502);
}