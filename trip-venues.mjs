// Real venues for a search, not articles about venues.
// Photon (OpenStreetMap) finds the places; Firecrawl image search finds each place's photo.
const INTENTS = [
  { key: 'food', label: 'Food', query: 'restaurant', match: /\b(food|eat|eats|restaurant|dinner|lunch|brunch|breakfast|poke|sushi|taco|ramen|pizza|burger|noodle|bbq|plate lunch)\b/i, kinds: ['restaurant', 'fast_food', 'food_court', 'deli', 'steakhouse'] },
  { key: 'coffee', label: 'Coffee', query: 'cafe', match: /\b(coffee|espresso|cafe|café|bakery|pastry)\b/i, kinds: ['cafe', 'bakery', 'coffee'] },
  { key: 'drinks', label: 'Drinks', query: 'bar', match: /\b(bar|bars|cocktail|drink|drinks|pub|brewery|beer|wine)\b/i, kinds: ['bar', 'pub', 'biergarten', 'brewery'] },
  { key: 'hike', label: 'Hike', query: 'trail', match: /\b(hike|hikes|hiking|trail|trails|trek)\b/i, kinds: ['path', 'trail', 'trailhead', 'peak'] },
  { key: 'beach', label: 'Beach', query: 'beach', match: /\b(beach|beaches|swim|snorkel|surf)\b/i, kinds: ['beach'] },
  { key: 'museum', label: 'Museum', query: 'museum', match: /\b(museum|museums|gallery|art|history|palace)\b/i, kinds: ['museum', 'gallery', 'attraction', 'artwork'] },
  { key: 'view', label: 'Viewpoint', query: 'viewpoint', match: /\b(view|views|viewpoint|lookout|sunset|scenic)\b/i, kinds: ['viewpoint', 'peak'] },
];

export function classifyIntent(query) {
  const text = String(query || '');
  for (const intent of INTENTS) if (intent.match.test(text)) return intent;
  return { key: 'all', label: 'Places', query: 'restaurant', match: /$^/, kinds: ['restaurant', 'cafe', 'bar', 'museum', 'viewpoint', 'beach'] };
}

const km = (lat1, lon1, lat2, lon2) => {
  const rad = value => (value * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const KINDS = { restaurant: 'Restaurant', fast_food: 'Fast food', food_court: 'Food hall', deli: 'Deli', steakhouse: 'Steakhouse', cafe: 'Cafe', bakery: 'Bakery', coffee: 'Coffee', bar: 'Bar', pub: 'Pub', biergarten: 'Beer garden', brewery: 'Brewery', museum: 'Museum', gallery: 'Gallery', attraction: 'Attraction', viewpoint: 'Viewpoint', peak: 'Peak', beach: 'Beach', path: 'Trail', trail: 'Trail', trailhead: 'Trailhead' };

export async function cityCentre(fetcher, city) {
  if (!city) return null;
  try {
    const response = await fetcher('https://photon.komoot.io/api/?limit=1&lang=en&q=' + encodeURIComponent(city), {
      headers: { 'User-Agent': 'trip.agnamo.com (places search)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const feature = data?.features?.[0];
    const [lon, lat] = feature?.geometry?.coordinates || [];
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  } catch { return null; }
}

export function venueFromFeature(feature, originLat, originLon, intent) {
  const properties = feature?.properties || {};
  const [lon, lat] = feature?.geometry?.coordinates || [];
  const name = String(properties.name || '').trim();
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const osmValue = String(properties.osm_value || '').toLowerCase();
  if (intent.kinds.length && !intent.kinds.includes(osmValue)) return null;
  const address = [properties.housenumber, properties.street].filter(Boolean).join(' ') || properties.locality || properties.district || '';
  return {
    id: 'v' + (properties.osm_type || 'x') + (properties.osm_id || Math.round(lat * 1e5) + '-' + Math.round(lon * 1e5)),
    name,
    kind: KINDS[osmValue] || intent.label,
    lat, lon,
    distanceKm: originLat == null ? null : Math.round(km(originLat, originLon, lat, lon) * 10) / 10,
    address,
    city: properties.city || '',
    osmValue,
    image: '',
  };
}

export async function photonVenues({ fetcher = fetch, lat, lon, intent, limit = 30 }) {
  const url = 'https://photon.komoot.io/api/?limit=' + limit + '&lang=en&q=' + encodeURIComponent(intent.query)
    + '&lat=' + lat.toFixed(4) + '&lon=' + lon.toFixed(4);
  const response = await fetcher(url, { headers: { 'User-Agent': 'trip.agnamo.com (places search)' }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw Object.assign(new Error('Place lookup failed (' + response.status + ')'), { status: 503 });
  const data = await response.json();
  if (!Array.isArray(data?.features)) throw Object.assign(new Error('Place lookup returned nothing readable'), { status: 503 });
  return data.features;
}

export const photoDebug = { key: false, lastStatus: 0, error: '' };

// One photo per venue from Firecrawl image search. Cached, best effort.
export async function venuePhoto({ fetcher = fetch, kv, key, name, city }) {
  const cacheKey = 'vimg:' + (name + '|' + (city || '')).toLowerCase().replace(/[^a-z0-9|]+/g, '-').slice(0, 120);
  if (kv) {
    try {
      const hit = await kv.get(cacheKey);
      if (hit === 'none') { try { await kv.delete(cacheKey); } catch {} }
      else if (hit) return hit;
    } catch {}
  }
  let found = '';
  photoDebug.key = Boolean(key);
  if (key) {
    try {
      const response = await fetcher('https://api.firecrawl.dev/v2/search', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: [name, city].filter(Boolean).join(' '), limit: 4, sources: ['images'] }),
        signal: AbortSignal.timeout(9000),
      });
      photoDebug.lastStatus = response.status;
      if (response.ok) {
        const data = await response.json();
        const rows = Array.isArray(data?.data) ? data.data : (data?.data?.images || []);
        const good = rows.find(row => {
          const url = String(row?.imageUrl || row?.url || '');
          return /^https:\/\//.test(url) && !/(logo|icon|avatar|sprite|placeholder)/i.test(url);
        });
        found = String(good?.imageUrl || good?.url || '');
      }
    } catch (error) { photoDebug.error = String(error?.message || error).slice(0, 120); }
  }
  // Only cache hits: a miss is often a temporary provider failure, not a verdict.
  if (kv && found) { try { await kv.put(cacheKey, found, { expirationTtl: 60 * 60 * 24 * 30 }); } catch {} }
  return found;
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await worker(items[index], index);
    }
  }));
  return out;
}

export async function searchVenues({ fetcher = fetch, kv, imageKey, lat, lon, city, query, radius = 12, limit = 18, photos = 9 }) {
  const intent = classifyIntent(query);
  const features = await photonVenues({ fetcher, lat, lon, intent });
  const seen = new Set();
  const venues = [];
  for (const feature of features) {
    const venue = venueFromFeature(feature, lat, lon, intent);
    if (!venue) continue;
    if (venue.distanceKm != null && venue.distanceKm > radius) continue;
    const dedupe = venue.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (dedupe.length < 3 || seen.has(dedupe)) continue;
    seen.add(dedupe);
    venues.push(venue);
  }
  venues.sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
  const top = venues.slice(0, limit);
  await mapLimit(top.slice(0, photos), 5, async venue => {
    venue.image = await venuePhoto({ fetcher, kv, key: imageKey, name: venue.name, city: city || venue.city });
  });
  return { intent, venues: top };
}

// The free OpenRouter router drops whatever does not match the ask. Best effort:
// any failure keeps the deterministic list.
export async function refineWithModel({ fetcher = fetch, key, model = 'deepseek/deepseek-chat-v3-0324:free', query, venues }) {
  if (!key || venues.length < 5) return venues;
  const list = venues.map((venue, index) => `${index}. ${venue.name} — ${venue.kind}${venue.address ? ', ' + venue.address : ''}`).join('\n');
  const prompt = `A traveller searched "${query}". Keep only entries that satisfy that search.\nReturn ONLY a JSON array of the numbers to keep, e.g. [0,2,3]. Drop shops, hotels, offices and anything that is not what was asked for. Keep at least ${Math.min(5, venues.length)} entries.\n\n${list}`;
  try {
    const response = await fetcher('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://trip.agnamo.com', 'X-Title': 'trip discovery' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 200, temperature: 0 }),
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return venues;
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    const keep = [...new Set((text.match(/\d+/g) || []).map(Number).filter(index => index >= 0 && index < venues.length))];
    if (keep.length < Math.min(5, venues.length)) return venues;
    return keep.map(index => venues[index]);
  } catch {
    return venues;
  }
}
