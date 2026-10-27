import test from 'node:test';
import assert from 'node:assert/strict';
import {openNow,categorise,difficultyOf,durationOf,overpassQuery,parseListing} from '../trip-nearby.mjs';

// Fixed clocks keep the tests independent of when they run.
const at = (day, hour, minute = 0) => new Date(2026, 9, 25 + ((day + 7 - 0) % 7), hour, minute); // Oct 25 2026 is a Sunday
const sunday = at(0, 12);
const wednesday = at(3, 12);

test('24/7 is always open', () => {
  assert.equal(openNow('24/7', wednesday), true);
});

test('weekday ranges are respected', () => {
  assert.equal(openNow('Mo-Su 09:00-17:00', wednesday), true);
  assert.equal(openNow('Mo-Su 09:00-17:00', at(3, 18)), false);
  assert.equal(openNow('Mo-Fr 09:00-17:00', sunday), false);
  assert.equal(openNow('Mo-Fr 09:00-17:00', at(3, 8, 59)), false);
});

test('opening lists with commas and several days parse', () => {
  assert.equal(openNow('Sa,Su 10:00-16:00', sunday), true);
  assert.equal(openNow('We-Mo 08:00-20:00', sunday), true, 'wrapping day range');
});

test('hours that cannot be understood return null instead of a guess', () => {
  assert.equal(openNow('by appointment', wednesday), null);
  assert.equal(openNow('', wednesday), null);
  assert.equal(openNow(undefined, wednesday), null);
  assert.equal(openNow('sunrise-sunset', wednesday), null);
});

test('categories map to the filter buckets', () => {
  assert.equal(categorise({amenity:'bar'}), 'bar');
  assert.equal(categorise({amenity:'pub'}), 'bar');
  assert.equal(categorise({tourism:'museum'}), 'museum');
  assert.equal(categorise({natura:''}), null);
  assert.equal(categorise({highway:'path',sac_scale:'mountain_hiking'}), 'trail');
  assert.equal(categorise({leisure:'nature_reserve'}), 'park');
});

test('trail difficulty and duration follow sac_scale', () => {
  assert.equal(difficultyOf({sac_scale:'hiking'}), 'easy');
  assert.equal(difficultyOf({sac_scale:'demanding_mountain_hiking'}), 'hard');
  assert.equal(difficultyOf({}), null);
  assert.equal(durationOf('trail',{sac_scale:'hiking'}), 75);
  assert.equal(durationOf('trail',{sac_scale:'demanding_mountain_hiking'}), 240);
  assert.equal(durationOf('bar',{}), 90);
});

test('the overpass query is scoped to a radius and stays bounded', () => {
  const query = overpassQuery(21.3069, -157.8583, 8000);
  assert.match(query, /around:8000,21\.30690,-157\.85830/);
  assert.match(query, /out center tags 80/);
});

test('listing text yields a rating and a review count', () => {
  const rated = parseListing('Duke\'s Waikiki · 4.6 ★ (3,412) · Open now');
  assert.equal(rated.rating, 4.6);
  assert.equal(rated.reviews, 3412);
  assert.equal(rated.open, true);
  const paren = parseListing('Barefoot Beach Cafe 4.2 (1,204)');
  assert.equal(paren.rating, 4.2);
  assert.equal(paren.reviews, 1204);
});

test('listing text never guesses hours it cannot read', () => {
  assert.equal(parseListing('Some place · good views').open, null);
  assert.equal(parseListing('Permanently closed').open, false);
  assert.equal(parseListing('Closes 11 PM', new Date(2026, 9, 26, 21, 0)).open, true);
  assert.equal(parseListing('Closes 11 PM', new Date(2026, 9, 26, 23, 30)).open, false);
});

test('ratings outside 0-5 are clamped', () => {
  assert.equal(parseListing('9.4 stars').rating, 5);
});
