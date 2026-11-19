import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchConcerts } from '../../lib/concerts/wordpress.ts';
import restFixture from '../fixtures/atmosphere-concerts-page.json' with { type: 'json' };
const baseUrl = 'https://atmosphere-show.ru';
const postType = 'concerts';

test('fetchConcerts reads one static snapshot and maps its flat concert fields', async () => {
  const calls: string[] = [];
  const show = {
    id: 10,
    status: 'publish',
    gorod: 'Тула',
    v_gorode: 'в Туле',
    data_kontserta: '2026-12-18',
    vremia_kontserta: '21:00',
    sold_out: 'true',
  };
  const fake: typeof fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(init?.method, 'GET');
    assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('authorization'), null);
    return Response.json([show, { id: 11, status: 'draft' }]);
  };
  const concerts = await fetchConcerts({
    baseUrl: baseUrl + '/',
    postType,
    fetch: fake,
  });
  assert.deepEqual(calls, ['https://atmosphere-show.ru/concerts.json']);
  assert.deepEqual(concerts[0], {
    id: 10,
    status: 'publish',
    link: 'https://atmosphere-show.ru/?post_type=concerts&p=10',
    city: 'Тула',
    cityIn: 'в Туле',
    date: '2026-12-18',
    time: '21:00',
    soldOut: true,
    postponedTo: null,
    modifiedGmt: '',
  });
  assert.equal(concerts[1].status, 'draft');
  assert.equal(concerts[1].link, '');
});

test('fetchConcerts fails on a malformed or empty snapshot', async () => {
  for (const data of [{}, [], [null], [{ id: 1 }]]) {
    const fake: typeof fetch = async () => Response.json(data);
    await assert.rejects(fetchConcerts({ baseUrl, postType, fetch: fake }));
  }
});

test('fetchConcerts reports an unavailable snapshot without a second request', async () => {
  const calls: string[] = [];
  const fake: typeof fetch = async (url) => {
    calls.push(String(url));
    return new Response('oops', { status: 500 });
  };
  await assert.rejects(fetchConcerts({ baseUrl, postType, fetch: fake }), /HTTP 500/);
  assert.deepEqual(calls, ['https://atmosphere-show.ru/concerts.json']);
});

test('a different WordPress site keeps its paginated REST reader', async () => {
  const calls: string[] = [];
  const fake: typeof fetch = async (url, init) => {
    const request = new URL(String(url));
    calls.push(request.pathname + request.search);
    assert.equal(new Headers(init?.headers).get('authorization'), 'Basic dXNlcjpwYXNz');
    const page = Number(request.searchParams.get('page'));
    const posts = page === 1 ? restFixture.slice(0, 2) : restFixture.slice(2);
    return Response.json(posts, { headers: { 'x-wp-totalpages': '2' } });
  };

  const concerts = await fetchConcerts({
    baseUrl: 'https://other.example',
    postType,
    fetch: fake,
    basicAuth: { username: 'user', password: 'pass' },
  });

  assert.deepEqual(calls, [
    '/wp-json/wp/v2/concerts?per_page=100&page=1',
    '/wp-json/wp/v2/concerts?per_page=100&page=2',
  ]);
  assert.equal(concerts.length, restFixture.length);
  assert.equal(concerts[0].link, restFixture[0].link);
  assert.equal(concerts[0].city, restFixture[0].meta.gorod);
});
