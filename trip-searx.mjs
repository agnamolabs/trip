// SearXNG (self-hosted on kae) is the free search backend: web results for discovery,
// images for place cards. It replaces per-call Firecrawl spend.
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

export const searxBase = env => String(env?.SEARX_URL || '').replace(/\/+$/, '');

export const searxAuth = env => {
  const raw = String(env?.SEARX_AUTH || '').trim();
  if (!raw) return '';
  if (/^Basic\s/i.test(raw)) return raw;
  return 'Basic ' + btoa(raw);
};

export async function searxSearch(env, { query, categories = 'general', language = 'en', time_range = '', fetcher = fetch, timeout = 12000 }) {
  const base = searxBase(env);
  if (!base) throw Object.assign(new Error('Search is not configured'), { status: 503 });
  const url = base + '/search?format=json&q=' + encodeURIComponent(query)
    + '&categories=' + encodeURIComponent(categories)
    + '&language=' + encodeURIComponent(language)
    + (time_range ? '&time_range=' + encodeURIComponent(time_range) : '');
  const headers = { 'User-Agent': 'trip.agnamo.com (search)', Accept: 'application/json' };
  const auth = searxAuth(env);
  if (auth) headers.Authorization = auth;
  if (env.SEARX_KEY) headers['x-media-key'] = env.SEARX_KEY;
  if (env.SEARX_GATEWAY_KEY) headers['x-gateway-key'] = env.SEARX_GATEWAY_KEY;
  const response = await fetcher(url, { headers, signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw Object.assign(new Error('Search failed (' + response.status + ')'), { status: 502 });
  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map(row => ({
    title: clean(row.title).slice(0, 200),
    url: String(row.url || ''),
    description: clean(row.content || row.snippet || '').slice(0, 1200),
  })).filter(row => row.url && /^https?:\/\//.test(row.url));
}

export async function searxImages(env, { query, count = 6, fetcher = fetch, timeout = 12000 }) {
  const base = searxBase(env);
  if (!base) return [];
  const url = base + '/search?format=json&q=' + encodeURIComponent(query) + '&categories=images&language=en';
  const headers = { 'User-Agent': 'trip.agnamo.com (images)', Accept: 'application/json' };
  const auth = searxAuth(env);
  if (auth) headers.Authorization = auth;
  if (env.SEARX_KEY) headers['x-media-key'] = env.SEARX_KEY;
  if (env.SEARX_GATEWAY_KEY) headers['x-gateway-key'] = env.SEARX_GATEWAY_KEY;
  try {
    const response = await fetcher(url, { headers, signal: AbortSignal.timeout(timeout) });
    if (!response.ok) return [];
    const data = await response.json();
    const rows = Array.isArray(data?.results) ? data.results : [];
    return rows.map(row => String(row.img_src || row.thumbnail_src || '')).filter(src => /^https:\/\//.test(src) && !/(logo|icon|sprite|avatar|placeholder)/i.test(src)).slice(0, count);
  } catch {
    return [];
  }
}
