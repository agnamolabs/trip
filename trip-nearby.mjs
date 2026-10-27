// Nearby places from OpenStreetMap: real coordinates, categories, opening hours and
// trail difficulty. No ratings exist in OSM, so ranking uses honest signals only
// (open now, notability, distance) and never invents a star score.
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function dayIndex(token) {
  const found = DAYS.indexOf(token);
  return found < 0 ? null : found;
}

function expandDays(spec) {
  // "Mo-Fr", "Sa,Su", "Mo-We,Fr"
  const days = new Set();
  for (const part of spec.split(',')) {
    const range = /^([A-Z][a-z])-([A-Z][a-z])$/.exec(part.trim());
    if (range) {
      const start = dayIndex(range[1]);
      const end = dayIndex(range[2]);
      if (start === null || end === null) return null;
      for (let step = 0; step < 7; step++) {
        const day = (start + step) % 7;
        days.add(day);
        if (day === end) break;
      }
      continue;
    }
    const single = dayIndex(part.trim());
    if (single === null) return null;
    days.add(single);
  }
  return days.size ? days : null;
}

function minutesOf(clock) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  return (hours % 24) * 60 + minutes;
}

// Returns true/false when the string can be understood, null when it cannot.
export function openNow(hours, date = new Date()) {
  if (typeof hours !== 'string' || !hours.trim()) return null;
  const value = hours.trim();
  if (/^24\/7$/i.test(value)) return true;
  const day = date.getDay();
  const now = date.getHours() * 60 + date.getMinutes();
  let understood = false;
  for (const rule of value.split(';')) {
    const match = /^\s*([A-Za-z,\-]+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s*$/.exec(rule);
    if (!match) continue;
    const days = expandDays(match[1]);
    const start = minutesOf(match[2]);
    const end = minutesOf(match[3]);
    if (!days || start === null || end === null) continue;
    understood = true;
    if (!days.has(day)) continue;
    // An end before the start means it runs past midnight.
    if (end >= start) {
      if (now >= start && now <= end) return true;
    } else if (now >= start || now <= end) return true;
  }
  // Also accept "Mo-Su 09:00-17:00, 19:00-23:00" by retrying each fence as a day list.
  if (!understood && /^\s*[A-Z][a-z]/.test(value)) return null;
  return understood ? false : null;
}

const CATEGORY_RULES = [
  { key: 'bar', indoor: true, durationMin: 90, match: tags => tags.amenity === 'bar' || tags.amenity === 'pub' },
  { key: 'cafe', indoor: true, durationMin: 45, match: tags => tags.amenity === 'cafe' },
  { key: 'food', indoor: true, durationMin: 75, match: tags => tags.amenity === 'restaurant' || tags.amenity === 'fast_food' },
  { key: 'market', indoor: false, durationMin: 60, match: tags => tags.amenity === 'marketplace' },
  { key: 'museum', indoor: true, durationMin: 120, match: tags => tags.tourism === 'museum' || tags.tourism === 'gallery' },
  { key: 'culture', indoor: true, durationMin: 120, match: tags => tags.amenity === 'theatre' || tags.amenity === 'cinema' },
  { key: 'viewpoint', indoor: false, durationMin: 30, match: tags => tags.tourism === 'viewpoint' },
  { key: 'beach', indoor: false, durationMin: 120, match: tags => tags.natural === 'beach' },
  { key: 'park', indoor: false, durationMin: 60, match: tags => tags.leisure === 'park' || tags.leisure === 'garden' || tags.leisure === 'nature_reserve' },
  { key: 'trail', indoor: false, durationMin: 90, match: tags => tags.highway === 'path' || tags.route === 'hiking' },
];

export function categorise(tags = {}) {
  const rule = CATEGORY_RULES.find(entry => entry.match(tags));
  return rule ? rule.key : null;
}

const DIFFICULTY = {
  hiking: 'easy',
  mountain_hiking: 'moderate',
  demanding_mountain_hiking: 'hard',
  alpine_hiking: 'hard',
  demanding_alpine_hiking: 'hard',
};

export function difficultyOf(tags = {}) {
  return DIFFICULTY[tags.sac_scale] || null;
}

export function durationOf(category, tags = {}) {
  const rule = CATEGORY_RULES.find(entry => entry.key === category);
  let base = rule ? rule.durationMin : 60;
  if (category === 'trail') {
    base = { easy: 75, moderate: 150, hard: 240 }[difficultyOf(tags)] || 120;
  }
  return base;
}

export const CATEGORIES = CATEGORY_RULES.map(rule => ({ key: rule.key, indoor: rule.indoor }));

export function overpassQuery(lat, lon, radius) {
  const around = `(around:${Math.round(radius)},${lat.toFixed(5)},${lon.toFixed(5)})`;
  return `[out:json][timeout:25];(
    nwr["amenity"~"^(bar|pub|cafe|restaurant|fast_food|marketplace|theatre|cinema)$"]${around};
    nwr["tourism"~"^(museum|gallery|viewpoint|attraction)$"]${around};
    nwr["leisure"~"^(park|garden|nature_reserve)$"]${around};
    nwr["natural"="beach"]${around};
    nwr["route"="hiking"]${around};
  );out center tags 80;`;
}

const distanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = value => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export async function nearbyPlaces(fetcher, lat, lon, radius, now = new Date()) {
  const body = 'data=' + encodeURIComponent(overpassQuery(lat, lon, radius));
  // Overpass instances fall over independently; try the shortlist before giving up.
  const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
  ];
  let data = null;
  let lastError = '';
  for (const mirror of mirrors) {
    let response;
    try {
      response = await fetcher(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'trip.agnamo.com nearby (trip.agnamo.com)' },
        body,
        signal: AbortSignal.timeout(18000),
      });
    } catch {
      lastError = 'timeout';
      continue;
    }
    if (!response.ok) { lastError = 'HTTP ' + response.status; continue; }
    try { data = await response.json(); } catch { lastError = 'invalid JSON'; continue; }
    if (data) break;
  }
  if (!data) throw Object.assign(new Error('OpenStreetMap is not answering right now (' + lastError + '). Try again in a minute.'), { status: 503 });
  const elements = Array.isArray(data?.elements) ? data.elements : [];
  const seen = new Set();
  const items = [];
  for (const element of elements) {
    const tags = element?.tags || {};
    const name = typeof tags.name === 'string' ? tags.name.trim().slice(0, 90) : '';
    if (!name) continue;
    const itemLat = Number(element.lat ?? element.center?.lat);
    const itemLon = Number(element.lon ?? element.center?.lon);
    if (!Number.isFinite(itemLat) || !Number.isFinite(itemLon)) continue;
    const category = categorise(tags);
    if (!category) continue;
    const id = tagId(element, name);
    if (seen.has(id)) continue;
    seen.add(id);
    const hours = typeof tags.opening_hours === 'string' ? tags.opening_hours.slice(0, 120) : '';
    items.push({
      id,
      name,
      category,
      indoor: CATEGORY_RULES.find(rule => rule.key === category)?.indoor ?? false,
      distanceKm: Math.round(distanceKm(lat, lon, itemLat, itemLon) * 10) / 10,
      lat: itemLat,
      lon: itemLon,
      hours,
      open: openNow(hours, now),
      difficulty: difficultyOf(tags),
      durationMin: durationOf(category, tags),
      notable: Boolean(tags.wikidata || tags.wikipedia),
      sourceUrl: tags.wikidata ? 'https://www.wikidata.org/wiki/' + tags.wikidata : tags.wikipedia ? 'https://en.wikipedia.org/wiki/' + encodeURIComponent(tags.wikipedia) : '',
    });
  }
  // Honest ranking: open first, then notability, then nearness. No invented ratings.
  items.sort((a, b) => {
    const openDiff = Number(b.open === true) - Number(a.open === true);
    if (openDiff) return openDiff;
    const notableDiff = Number(b.notable) - Number(a.notable);
    if (notableDiff) return notableDiff;
    return a.distanceKm - b.distanceKm;
  });
  return items;
}

function tagId(element, name) {
  return (element.type || 'node') + '/' + (element.id ?? name);
}

// Google Places (New) gives what OSM cannot: a real rating and a real open-now flag.
// Same nearby feed shape, so the client does not care which source answered.
const PLACE_TYPES = {
  bar: ['bar', 'pub'], cafe: ['cafe'], food: ['restaurant', 'meal_takeaway'],
  market: ['market'], museum: ['museum', 'art_gallery'], culture: ['movie_theater', 'performing_arts_theater'],
  viewpoint: ['tourist_attraction'], beach: ['beach'], park: ['park', 'national_park', 'garden'], trail: ['hiking_area'],
};
const TYPE_TO_CATEGORY = Object.entries(PLACE_TYPES).reduce((map, [category, types]) => {
  for (const type of types) map[type] = category;
  return map;
}, {});
const CATEGORY_DURATION = { bar: 90, cafe: 45, food: 75, market: 60, museum: 120, culture: 120, viewpoint: 30, beach: 120, park: 60, trail: 120 };

export async function nearbyPlacesGoogle(key, lat, lon, radius, fetcher) {
  const includedTypes = ['bar', 'cafe', 'restaurant', 'museum', 'art_gallery', 'tourist_attraction', 'park', 'beach', 'hiking_area', 'market'];
  let response;
  try {
    response = await fetcher('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.currentOpeningHours.weekdayDescriptions,places.types,places.primaryType,places.googleMapsUri,places.regularOpeningHours.openNow',
      },
      body: JSON.stringify({ includedTypes, maxResultCount: 20, rankPreference: 'POPULARITY', locationRestriction: { circle: { center: { latitude: lat, longitude: lon }, radius: Math.min(50000, radius) } } }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw Object.assign(new Error('Google Places timed out'), { status: 504 });
  }
  if (!response.ok) throw Object.assign(new Error('Google Places returned HTTP ' + response.status), { status: 502 });
  const data = await response.json();
  const places = Array.isArray(data?.places) ? data.places : [];
  const items = [];
  for (const place of places) {
    const name = place?.displayName?.text;
    const placeLat = Number(place?.location?.latitude);
    const placeLon = Number(place?.location?.longitude);
    if (!name || !Number.isFinite(placeLat) || !Number.isFinite(placeLon)) continue;
    const types = [place.primaryType, ...(Array.isArray(place.types) ? place.types : [])].filter(Boolean);
    const category = types.map(type => TYPE_TO_CATEGORY[type]).find(Boolean) || 'food';
    const openNowValue = place?.currentOpeningHours?.openNow ?? place?.regularOpeningHours?.openNow;
    items.push({
      id: String(place.id || name),
      name: String(name).slice(0, 90),
      category,
      indoor: !['beach', 'park', 'trail', 'viewpoint', 'market'].includes(category),
      distanceKm: Math.round(distanceKm(lat, lon, placeLat, placeLon) * 10) / 10,
      lat: placeLat,
      lon: placeLon,
      hours: Array.isArray(place?.currentOpeningHours?.weekdayDescriptions) ? String(place.currentOpeningHours.weekdayDescriptions[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || '').slice(0, 120) : '',
      open: typeof openNowValue === 'boolean' ? openNowValue : null,
      difficulty: null,
      durationMin: CATEGORY_DURATION[category] || 60,
      notable: Number(place?.userRatingCount) >= 500,
      rating: Number.isFinite(Number(place?.rating)) ? Number(place.rating) : null,
      reviews: Number.isFinite(Number(place?.userRatingCount)) ? Number(place.userRatingCount) : null,
      sourceUrl: typeof place?.googleMapsUri === 'string' ? place.googleMapsUri : '',
    });
  }
  items.sort((a, b) => {
    const openDiff = Number(b.open === true) - Number(a.open === true);
    if (openDiff) return openDiff;
    const ratingDiff = (b.rating || 0) - (a.rating || 0);
    if (ratingDiff) return ratingDiff;
    return a.distanceKm - b.distanceKm;
  });
  return items;
}
