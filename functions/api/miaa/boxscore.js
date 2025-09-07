export async function onRequest(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id');
  const resp = (obj, code=200) => new Response(JSON.stringify(obj), {
    status: code,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=60', 'access-control-allow-origin': '*' }
  });
  if(!id) return resp({error:'missing id'}, 400);
  async function fetchJSON(u){ const r = await fetch(u, {cf:{cacheTtl:60}}); if(!r.ok) throw new Error('HTTP '+r.status); const t=await r.text(); return JSON.parse(t); }
  try{ const data = await fetchJSON(`https://ncaa-api.henrygd.me/game/${encodeURIComponent(id)}/boxscore`); return resp(data); }
  catch(e){ return resp({error:'unavailable'}, 502); }
}