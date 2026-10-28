import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyIntent,venueFromFeature,searchVenues} from '../trip-venues.mjs';

const feature = (name, value, lat, lon, extra = {}) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { name, osm_value: value, osm_type: 'N', osm_id: 1, ...extra } });

test('a food search is classified as food, not as places', () => {
  assert.equal(classifyIntent('food').key, 'food');
  assert.equal(classifyIntent('where can we eat dinner').key, 'food');
  assert.equal(classifyIntent('hikes').key, 'hike');
  assert.equal(classifyIntent('coffee near me').key, 'coffee');
});

test('only venues of the asked kind survive the filter', () => {
  const intent = classifyIntent('food');
  assert.ok(venueFromFeature(feature('Helena\u02bbs Hawaiian Food', 'restaurant', 21.31, -157.81, { street: '1240 N School St' }), 21.30, -157.85, intent));
  assert.equal(venueFromFeature(feature('Honolulu Museum of Art', 'museum', 21.30, -157.85), 21.30, -157.85, intent), null, 'a museum is not food');
  assert.equal(venueFromFeature(feature('Ala Moana Hotel', 'hotel', 21.29, -157.84), 21.30, -157.85, intent), null);
});

test('a venue carries its street and distance from the trip centre', () => {
  const venue = venueFromFeature(feature('MW Restaurant', 'restaurant', 21.30, -157.85, { housenumber: '1538', street: 'Kapiolani Blvd' }), 21.30, -157.85, classifyIntent('food'));
  assert.equal(venue.address, '1538 Kapiolani Blvd');
  assert.equal(venue.kind, 'Restaurant');
  assert.ok(venue.distanceKm < 0.2);
});

test('venues outside the search radius are dropped and duplicates collapse', async () => {
  const rows = [
    feature('Kabuki Restaurant', 'restaurant', 21.305, -157.855),
    feature('Kabuki Restaurant', 'restaurant', 21.3051, -157.8551),
    feature('Somewhere Far', 'restaurant', 22.5, -158.5),
  ];
  const fetcher = async () => new Response(JSON.stringify({ features: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const out = await searchVenues({ fetcher, lat: 21.3045, lon: -157.8556, city: 'Honolulu', query: 'food', photos: 0 });
  assert.deepEqual(out.venues.map(venue => venue.name), ['Kabuki Restaurant']);
});

test('a venue photo is cached so the same place is never looked up twice', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return new Response(JSON.stringify({ data: [{ imageUrl: 'https://img.example/mw.jpg' }] }), { status: 200 }); };
  const store = new Map();
  const kv = { get: async key => store.has(key) ? store.get(key) : null, put: async (key, value) => { store.set(key, value); } };
  const { venuePhoto } = await import('../trip-venues.mjs');
  const first = await venuePhoto({ fetcher, kv, key: 'k', name: 'MW Restaurant', city: 'Honolulu' });
  const second = await venuePhoto({ fetcher, kv, key: 'k', name: 'MW Restaurant', city: 'Honolulu' });
  assert.equal(first, 'https://img.example/mw.jpg');
  assert.equal(second, first);
  assert.equal(calls, 1, 'the second lookup came from the cache');
});
