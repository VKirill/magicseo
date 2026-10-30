import { test } from 'node:test';
import assert from 'node:assert/strict';
import sample from '../fixtures/positions-sample.json' with { type: 'json' };
import type { MagicSeoClient } from '../../lib/magicseo/client.ts';
import type { PositionsResponse } from '../../lib/magicseo/types.ts';
import { createPositionsHandlers, LAST_RUN_KEY } from '../../server/positions-handlers.ts';

const CATALOG = [
  {
    id: 1,
    parent_id: null,
    type: 'folder',
    name: 'ПРО АРТ',
    children_count: 1,
    children: [
      {
        id: 2,
        parent_id: 1,
        type: 'project',
        name: '[Москва] PRO АРТ',
        children_count: 0,
        project_info: { id: 527041, domain: 'proart-show.ru', region: 213, name: '[Москва] PRO АРТ' },
      },
    ],
  },
];

function fakeClient() {
  const calls: string[] = [];
  const client = {
    async catalogItems() {
      calls.push('catalogItems');
      return CATALOG;
    },
    async positions(_id: number, _range: { from: string; to: string }) {
      calls.push('positions');
      return sample as PositionsResponse;
    },
    async startPositionsJob(id: number) {
      calls.push(`startPositionsJob:${id}`);
      return {};
    },
  } as unknown as MagicSeoClient;
  return { client, calls };
}

function memoryKv(seed: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(seed));
  return {
    store,
    async get(key: string) {
      return store.get(key);
    },
    async set(key: string, value: unknown) {
      store.set(key, value);
    },
  };
}

test('positions_report returns rows of the catalog project with the city from cityByRegion', async () => {
  const kv = memoryKv();
  const fake = fakeClient();
  const handlers = createPositionsHandlers({ client: fake.client, kv });
  await handlers.positions_harvest_now();
  const rows = await handlers.positions_report({ domain: 'proart-show.ru', from: '2026-06-01', to: '2026-07-31' });
  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0], {
    site: 'proart-show.ru',
    city: 'Москва',
    keyword: '3000 свечей',
    date: '2026-06-17',
    pcPosition: 12,
    mobilePosition: 15,
    foundUrl: 'https://proart-show.ru/svechi',
  });
  assert.ok(rows.every((r) => r.city === 'Москва'));
});

test('positions_csv returns the toCsv text for the filter', async () => {
  const kv = memoryKv();
  const fake = fakeClient();
  const handlers = createPositionsHandlers({ client: fake.client, kv });
  await handlers.positions_harvest_now();
  const csv = await handlers.positions_csv({ domain: 'proart-show.ru', from: '2026-06-01', to: '2026-07-31' });
  assert.ok(
    csv.startsWith('site,city,keyword,date,pc_position,mobile_position,found_url\n'),
    'CSV must start with the exact header line',
  );
  assert.ok(csv.includes(',101,'), 'position 101 is kept as 101 in the CSV');
  const filtered = await handlers.positions_csv({ domain: 'proart-show.ru', from: '2026-07-01', to: '2026-07-31' });
  const julyLines = filtered.trim().split('\n').length - 1;
  assert.equal(julyLines, 3, 'the July filter keeps only July checks');
  assert.ok(!filtered.includes('2026-06-'));
});

test('positions_harvest_now returns counts and stamps pos-meta:last-run with an ISO at', async () => {
  const kv = memoryKv();
  const fake = fakeClient();
  const handlers = createPositionsHandlers({ client: fake.client, kv });
  const before = new Date();
  const result = await handlers.positions_harvest_now();
  assert.deepEqual(result, { projects: 1, checks: 6 });
  const last = (await kv.get(LAST_RUN_KEY)) as { at?: string };
  assert.equal(typeof last.at, 'string');
  const at = Date.parse(last.at as string);
  assert.ok(!Number.isNaN(at), 'at must parse as an ISO timestamp');
  assert.equal(new Date(last.at as string).toISOString(), last.at);
  assert.ok(at >= before.getTime() - 1000);
  assert.deepEqual(
    [...kv.store.keys()].filter((k) => k.startsWith('pos:')).sort(),
    ['pos:527041:2026-06', 'pos:527041:2026-07'],
  );
  assert.deepEqual(
    fake.calls.filter((c) => c !== 'catalogItems'),
    ['positions'],
    'a harvest only reads positions',
  );
});
