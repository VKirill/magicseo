import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchConcerts } from '../../lib/concerts/wordpress.ts';
import fixture from '../fixtures/atmosphere-concerts-page.json' with { type: 'json' };

type Call = { url: string; init: RequestInit | undefined };

function fakeFetch(pages: unknown[][]): { calls: Call[]; fetch: typeof fetch } {
  const calls: Call[] = [];
  const f = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const page = Number(new URL(url).searchParams.get('page'));
    const body = pages[page - 1];
    if (body === undefined) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json', 'x-wp-totalpages': String(pages.length) },
    });
  }) as typeof fetch;
  return { calls, fetch: f };
}

const PATHS = [
  '/wp-json/wp/v2/concerts?per_page=100&page=1',
  '/wp-json/wp/v2/concerts?per_page=100&page=2',
];

test('fetchConcerts follows X-WP-TotalPages with GET requests and maps meta fields', async () => {
  const { calls, fetch: fake } = fakeFetch([fixture.slice(0, 2), fixture.slice(2)]);
  const concerts = await fetchConcerts({
    baseUrl: 'https://atmosphere-show.ru',
    postType: 'concerts',
    fetch: fake,
  });

  assert.equal(concerts.length, fixture.length);
  assert.deepEqual(calls.map((c) => new URL(c.url).pathname + new URL(c.url).search), PATHS);
  for (const c of calls) {
    assert.equal(c.init?.method ?? 'GET', 'GET');
    assert.equal(new Headers(c.init?.headers).get('authorization'), null);
  }

  for (let i = 0; i < fixture.length; i++) {
    const src = fixture[i];
    const got = concerts[i];
    assert.equal(got.id, src.id);
    assert.equal(got.status, src.status);
    assert.equal(got.link, src.link);
    assert.equal(got.city, src.meta.gorod);
    assert.equal(got.cityIn, src.meta.v_gorode);
    assert.equal(got.date, src.meta.data_kontserta);
    assert.equal(got.time, src.meta.vremia_kontserta);
    assert.equal(got.soldOut, false);
    assert.equal(got.postponedTo, null);
    assert.equal(got.modifiedGmt, src.modified_gmt);
  }
});

test('fetchConcerts maps soldOut and postponedTo when meta carries them', async () => {
  const sold = JSON.parse(JSON.stringify(fixture[0]));
  sold.meta.sold_out = 'true';
  sold.meta.perenos_kontserta = 'https://atmosphere-show.ru/concerts/moved-01-02/';
  const { fetch: fake } = fakeFetch([[sold]]);
  const [c] = await fetchConcerts({ baseUrl: 'https://x.ru/', postType: 'concerts', fetch: fake });
  assert.equal(c.soldOut, true);
  assert.equal(c.postponedTo, 'https://atmosphere-show.ru/concerts/moved-01-02/');
});

test('Authorization header is sent only when basicAuth is passed', async () => {
  const noAuth = fakeFetch([fixture]);
  await fetchConcerts({ baseUrl: 'https://x.ru', postType: 'concerts', fetch: noAuth.fetch });
  assert.equal(new Headers(noAuth.calls[0].init?.headers).get('authorization'), null);

  const withAuth = fakeFetch([fixture]);
  await fetchConcerts({
    baseUrl: 'https://x.ru',
    postType: 'concerts',
    fetch: withAuth.fetch,
    basicAuth: { username: 'user', password: 'pass' },
  });
  assert.equal(
    new Headers(withAuth.calls[0].init?.headers).get('authorization'),
    'Basic ' + Buffer.from('user:pass').toString('base64'),
  );
});

test('fetchConcerts throws on non-2xx', async () => {
  const fake = (async () => new Response('oops', { status: 500 })) as typeof fetch;
  await assert.rejects(fetchConcerts({ baseUrl: 'https://x.ru', postType: 'concerts', fetch: fake }));
});
