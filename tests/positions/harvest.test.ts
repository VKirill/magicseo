import { test } from 'node:test';
import assert from 'node:assert/strict';
import sample from '../fixtures/positions-sample.json' with { type: 'json' };
import type { MagicSeoClient } from '../../lib/magicseo/client.ts';
import type { KeywordV2, PositionsResponse } from '../../lib/magicseo/types.ts';
import { harvest } from '../../lib/positions/harvest.ts';

const TODAY = '2026-07-13';
const PROJECT = { id: 527041, domain: 'proart-show.ru', region: 213, name: '[Москва] PRO АРТ' };
const MONTHS_2026 = ['pos:527041:2026-06', 'pos:527041:2026-07'];

type Call = { method: string; args: unknown[] };

/** Records every call; the mutating methods exist so a stray call cannot hide. */
function fakeClient(responses: PositionsResponse[]) {
  const calls: Call[] = [];
  let n = 0;
  const client = {
    async positions(id: number, range: { from: string; to: string }) {
      calls.push({ method: 'positions', args: [id, range] });
      return responses[Math.min(n++, responses.length - 1)];
    },
    async startPositionsJob(id: number) {
      calls.push({ method: 'startPositionsJob', args: [id] });
      return {};
    },
    async stopJob(id: number) {
      calls.push({ method: 'stopJob', args: [id] });
      return {};
    },
    async createProject(body: unknown) {
      calls.push({ method: 'createProject', args: [body] });
      return {};
    },
    async uploadKeywords(id: number, csv: string) {
      calls.push({ method: 'uploadKeywords', args: [id, csv] });
      return {};
    },
    async setAutolaunch(id: number, settings: unknown) {
      calls.push({ method: 'setAutolaunch', args: [id, settings] });
      return {};
    },
  } as unknown as MagicSeoClient;
  return { client, calls };
}

function memoryKv() {
  const store = new Map<string, unknown>();
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

function positionsCalls(calls: Call[]): Array<{ id: number; range: { from: string; to: string } }> {
  return calls
    .filter((c) => c.method === 'positions')
    .map((c) => ({ id: c.args[0] as number, range: c.args[1] as { from: string; to: string } }));
}

test('first harvest requests from = today − 30 days, second from = the stored lastDate', async () => {
  const kv = memoryKv();
  const fake = fakeClient([sample as PositionsResponse, sample as PositionsResponse]);
  await harvest({ client: fake.client, kv, projects: [PROJECT], today: TODAY, pauseMs: 0 });
  await harvest({ client: fake.client, kv, projects: [PROJECT], today: TODAY, pauseMs: 0 });
  assert.deepEqual(positionsCalls(fake.calls), [
    { id: 527041, range: { from: '2026-06-13', to: TODAY } },
    { id: 527041, range: { from: '2026-07-13', to: TODAY } },
  ]);
  assert.deepEqual(await kv.get('pos-meta:527041'), { lastDate: '2026-07-13' });
});

test('checks dated in two months land in two month keys and 101 is stored as 101', async () => {
  const kv = memoryKv();
  const fake = fakeClient([sample as PositionsResponse]);
  const result = await harvest({ client: fake.client, kv, projects: [PROJECT], today: TODAY, pauseMs: 0 });
  assert.deepEqual(result, { projects: 1, checks: 6 });
  assert.deepEqual(
    [...kv.store.keys()].filter((k) => k.startsWith('pos:')).sort(),
    MONTHS_2026,
  );
  const june = (await kv.get('pos:527041:2026-06')) as Record<string, Record<string, { pc: number | null }>>;
  const july = (await kv.get('pos:527041:2026-07')) as Record<
    string,
    Record<string, { mobile: number | null }>
  >;
  assert.equal(june['оркестр при свечах']['2026-06-17'].pc, 101);
  assert.equal(july['оркестр при свечах']['2026-07-13'].mobile, 101);
});

test('the second run merges into the stored months and keeps checks of both runs', async () => {
  const kv = memoryKv();
  const secondRun: PositionsResponse = {
    result: [
      {
        id: 67000003,
        text: 'свечи с доставкой',
        checks: [
          {
            time: '2026-07-13T00:00:00+03:00',
            provider: 'topvisor',
            position: 7,
            pc_position: 7,
            mobile_position: 8,
            delta: 0,
            found_url: 'https://proart-show.ru/dostavka',
            errors_count: 0,
            position_id: 900007,
          },
        ],
      } as KeywordV2,
    ],
  };
  const fake = fakeClient([sample as PositionsResponse, secondRun]);
  await harvest({ client: fake.client, kv, projects: [PROJECT], today: TODAY, pauseMs: 0 });
  await harvest({ client: fake.client, kv, projects: [PROJECT], today: TODAY, pauseMs: 0 });
  const june = (await kv.get('pos:527041:2026-06')) as Record<string, Record<string, unknown>>;
  const july = (await kv.get('pos:527041:2026-07')) as Record<
    string,
    Record<string, { pc: number | null; url: string }>
  >;
  assert.deepEqual(june['3000 свечей']['2026-06-17'], {
    pc: 12,
    mobile: 15,
    url: 'https://proart-show.ru/svechi',
  });
  assert.deepEqual(july['свечи с доставкой']['2026-07-13'], {
    pc: 7,
    mobile: 8,
    url: 'https://proart-show.ru/dostavka',
  });
  assert.ok(july['оркестр при свечах']['2026-07-13'], 'first run checks survive the merge');
});

test('a failing project is skipped, the others go on, and only GET positions is called', async () => {
  const kv = memoryKv();
  const calls: Call[] = [];
  let n = 0;
  const client = {
    async positions(id: number, range: { from: string; to: string }) {
      calls.push({ method: 'positions', args: [id, range] });
      if (id === 2) throw new Error('cabinet error');
      return sample as PositionsResponse;
    },
    async startPositionsJob(id: number) {
      calls.push({ method: 'startPositionsJob', args: [id] });
      return {};
    },
  } as unknown as MagicSeoClient;
  const result = await harvest({
    client,
    kv,
    projects: [PROJECT, { ...PROJECT, id: 2, region: 2 }],
    today: TODAY,
    pauseMs: 0,
  });
  assert.deepEqual(result, { projects: 1, checks: 6 });
  assert.deepEqual(
    calls.map((c) => c.method),
    ['positions', 'positions'],
  );
  assert.ok(kv.store.has('pos:527041:2026-06'));
  assert.equal([...kv.store.keys()].filter((k) => k.startsWith('pos:2:')).length, 0);
});

test('a generated month of 100 keywords × 31 days serializes below the 256 KiB KV limit', async () => {
  const keywords: KeywordV2[] = [];
  for (let i = 1; i <= 100; i++) {
    const checks = [];
    for (let d = 1; d <= 31; d++) {
      checks.push({
        time: `2026-07-${String(d).padStart(2, '0')}T00:00:00+03:00`,
        provider: 'topvisor',
        position: ((i + d) % 100) + 1,
        pc_position: ((i + d) % 100) + 1,
        mobile_position: ((i + d + 1) % 100) + 1,
        delta: 0,
        found_url: `https://proart-show.ru/koncert/${i}`,
        errors_count: 0,
        position_id: i * 100 + d,
      });
    }
    keywords.push({ id: i, text: `оркестр при свечах город ${i}`, checks } as KeywordV2);
  }
  const kv = memoryKv();
  const fake = fakeClient([{ result: keywords } as PositionsResponse]);
  await harvest({ client: fake.client, kv, projects: [PROJECT], today: '2026-07-31', pauseMs: 0 });
  const stored = JSON.stringify(kv.store.get('pos:527041:2026-07')) as string;
  assert.ok(stored.length < 262144, `stored month is ${stored.length} chars, must stay below 262144`);
});
