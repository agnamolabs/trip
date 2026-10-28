// Tower: the scraper status page, served by the trip Worker at /tower.
// No extra Worker, no extra hostname. Every card is a live request made at load time.
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function probe(name, url, init, read) {
  const started = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12000) });
    const ms = Date.now() - started;
    let detail = '';
    try { detail = read ? await read(res) : ''; } catch { detail = ''; }
    return { name, ok: res.ok, status: res.status, ms, detail };
  } catch (error) {
    return { name, ok: false, status: 0, ms: Date.now() - started, detail: String((error && error.message) || error).slice(0, 90) };
  }
}

export function towerChecks(env, origin) {
  const base = String(env.GATEWAY_URL || '').replace(/\/+$/, '');
  const auth = { 'x-gateway-key': env.GATEWAY_KEY || '' };
  return [
    probe('SearXNG', base + '/searx/search?q=health&format=json', { headers: auth }, async res => (await res.json()).results.length + ' results'),
    probe('Maps', base + '/maps/geocode?q=honolulu', { headers: auth }, async res => (await res.json()).places.length + ' places'),
    probe('n8n', base + '/n8n/healthz', { headers: auth }, async res => (res.ok ? 'workflow runner up' : 'runner down')),
    // A Worker cannot fetch its own hostname (522 loop). Probe the datastore it depends on instead.
    (async () => {
      const started = Date.now();
      try {
        await env.TRIPS_KV.get('tower:probe');
        return { name: 'Trip storage', ok: true, status: 200, ms: Date.now() - started, detail: 'KV reachable' };
      } catch (error) {
        return { name: 'Trip storage', ok: false, status: 0, ms: Date.now() - started, detail: String((error && error.message) || error).slice(0, 80) };
      }
    })(),
  ];
}

const PAGE = [
  '<!doctype html><html lang="en"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1"><title>k-tower</title>',
  '<style>',
  ':root{--ink:#141d1c;--ivory:#faf7ef;--line:#e3ddcd;--teal:#123b39;--ok:#1f7a4d;--bad:#b3402a}',
  '*{box-sizing:border-box}body{margin:0;background:var(--ivory);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}',
  'header{display:flex;align-items:baseline;justify-content:space-between;padding:26px 28px 8px}',
  'h1{font-size:26px;letter-spacing:-.6px;margin:0;font-weight:800}h1 span{color:#7a8783;font-weight:500}',
  '.wrap{padding:0 28px 40px;max-width:1100px}.sub{color:#66736f;font-size:13px;margin:6px 0 22px}',
  '.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}',
  '.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:0 2px 10px -8px rgba(20,29,28,.5)}',
  '.row{display:flex;align-items:center;gap:10px;justify-content:space-between}.name{font-weight:700;font-size:15px}',
  '.dot{width:9px;height:9px;border-radius:50%}.ok{background:var(--ok)}.bad{background:var(--bad)}',
  '.meta{display:flex;gap:14px;color:#66736f;font-size:12.5px;margin-top:10px;flex-wrap:wrap}',
  '.badge{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:3px 7px;border-radius:100px;background:#eef1e8;color:#284a48}',
  '.detail{margin-top:8px;font-size:13px;color:#3d4a47}.detail:empty{display:none}',
  'footer{margin-top:22px;color:#7a8783;font-size:12px}',
  'button{background:var(--teal);color:#fff;border:0;border-radius:100px;padding:9px 15px;font-weight:650;font-size:13px;cursor:pointer}',
  '</style></head><body>',
  '<header><h1>k-tower <span>&middot; scrapers</span></h1><button onclick="load()">Re-check</button></header>',
  '<div class="wrap"><div class="sub" id="stamp">checking&hellip;</div><div class="grid" id="grid"></div>',
  '<footer>Each card is a live request made just now. Refreshes every 60s.</footer></div>',
  '<script>',
  'var el=document.getElementById("grid"),stamp=document.getElementById("stamp");',
  'function card(c){return "<article class=\\"card\\"><div class=\\"row\\"><div class=\\"name\\">"+c.name+"</div><span class=\\"dot "+(c.ok?"ok":"bad")+"\\"></span></div>"',
  '+"<div class=\\"meta\\"><span class=\\"badge\\">"+(c.ok?"live":"down")+"</span><span>HTTP "+(c.status||"--")+"</span><span>"+c.ms+" ms</span></div>"',
  '+(c.detail?"<div class=\\"detail\\">"+c.detail+"</div>":"")+"</article>";}',
  'function load(){stamp.textContent="checking…";fetch("/tower/status",{cache:"no-store"}).then(function(r){return r.json()}).then(function(d){',
  'el.innerHTML=d.checks.map(card).join("");var up=d.checks.filter(function(c){return c.ok}).length;',
  'stamp.textContent=up+" of "+d.checks.length+" live · checked "+new Date(d.checkedAt).toLocaleTimeString();',
  '}).catch(function(){stamp.textContent="status endpoint unreachable";});}',
  'load();setInterval(load,60000);',
  '</script></body></html>',
].join('\n');

export async function handleTower(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/tower/status') {
    return json({ checkedAt: new Date().toISOString(), checks: await Promise.all(towerChecks(env, url.origin)) });
  }
  if (url.pathname === '/tower' || url.pathname === '/tower/') {
    return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return null;
}
