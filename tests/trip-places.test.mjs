import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePlaces,cleanText} from '../trip-places.mjs';

const page = `# Where to Eat
##### Seasonal picks from the staff.
## MW Restaurant/Artizen by MW
_888 Kapi'olani Blvd., Kaka'ako, **[mwrestaurant.com](https://mwrestaurant.com/)**_
![Mud Hen Water exterior](https://example.com/mudhen.jpg)
## Olena by Ron Simon
_Dole Cannery Food Court, 650 Iwilei Road, (808) 745-7777_
## Most Popular
### [At Buns Gone Wong, Wagyu Burgers Start at $7](https://example.com/buns)`;

test('headings become separate places with their own detail', () => {
  const places = parsePlaces(page, 'Where to Eat', 'https://example.com/list');
  assert.equal(places.length, 2, 'the "Most Popular" block is a link list, not a place');
  assert.equal(places[0].name, 'MW Restaurant/Artizen by MW');
  assert.match(places[0].detail, /888 Kapi/);
  assert.equal(places[1].name, 'Olena by Ron Simon');
});

test('a place inherits the page photo when it has none of its own', () => {
  const places = parsePlaces(page, 'Where to Eat', 'https://example.com/list');
  assert.equal(places[0].image, 'https://example.com/mudhen.jpg');
});

test('a link wall becomes places instead of one article card', () => {
  const wall = 'Eat here: [Babbo](https://babbo.example) | [Bangkok Supper Club](https://bkk.example) | [Barbuto](https://barbuto.example)';
  const places = parsePlaces(wall, 'Where to eat right now', 'https://example.com/wall');
  assert.deepEqual(places.map(place => place.name), ['Babbo', 'Bangkok Supper Club', 'Barbuto']);
});

test('a guide hub that only links to other guides yields nothing', () => {
  const hub = '![cover](https://example.com/cover.jpg)\n\n[The 38 Best Restaurants in Honolulu](https://example.com/a) [The 20 Best in Waikiki](https://example.com/b)';
  assert.deepEqual(parsePlaces(hub, 'Honolulu - Eater', 'https://example.com/hub'), []);
});

test('a single venue page is one place', () => {
  const places = parsePlaces('Great poke, open late.', 'Ono Seafood - Honolulu', 'https://example.com/ono');
  assert.equal(places.length, 1);
  assert.equal(places[0].name, 'Ono Seafood');
});

test('markdown is stripped from names and details', () => {
  assert.equal(cleanText('**[mwrestaurant.com](https://mwrestaurant.com/)**'), 'mwrestaurant.com');
  assert.equal(cleanText('#  Head  ##  line'), 'Head line');
});
