import test from 'node:test';
import assert from 'node:assert/strict';
import {searxSearch,searxImages,searxAuth} from '../trip-searx.mjs';

const env = { SEARX_URL: 'https://searx.example/', SEARX_AUTH: 'trip:secret' };
const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('a search asks for JSON and sends basic auth', async () => {
  let seen;
  const fetcher = async (url, options) => { seen = { url, options }; return json({ results: [{ title: ' Poke  spots ', url: 'https://example.com/poke', content: ' eleven places' }] }); };
  const results = await searxSearch(env, { query: 'poke honolulu', fetcher });
  assert.match(seen.url, /^https:\/\/searx\.example\/search\?format=json&q=poke%20honolulu/);
  assert.equal(seen.options.headers.Authorization, 'Basic ' + Buffer.from('trip:secret').toString('base64'));
  assert.deepEqual(results, [{ title: 'Poke spots', url: 'https://example.com/poke', description: 'eleven places' }]);
});

test('a media gateway key rides along as a header', async () => {
  let seen;
  const fetcher = async (url, options) => { seen = options; return json({ results: [] }); };
  await searxSearch({ SEARX_URL: 'https://media.example/searx', SEARX_KEY: 'mk_123' }, { query: 'x', fetcher });
  assert.equal(seen.headers['x-media-key'], 'mk_123');
});

test('a basic auth value is never double wrapped', () => {
  assert.equal(searxAuth({ SEARX_AUTH: 'Basic abc' }), 'Basic abc');
  assert.equal(searxAuth({}), '');
});

test('images come back as https urls only', async () => {
  const fetcher = async () => json({ results: [{ img_src: 'https://img.example/1.jpg' }, { img_src: 'http://insecure/2.jpg' }, { img_src: 'https://img.example/logo.png' }] });
  assert.deepEqual(await searxImages(env, { query: 'mw restaurant', fetcher }), ['https://img.example/1.jpg']);
});

test('a failed search is an error, not an empty list', async () => {
  const fetcher = async () => new Response('nope', { status: 502 });
  await assert.rejects(searxSearch(env, { query: 'x', fetcher }), /Search failed \(502\)/);
});

test('without a configured instance, search says so', async () => {
  await assert.rejects(searxSearch({}, { query: 'x' }), /not configured/);
});
