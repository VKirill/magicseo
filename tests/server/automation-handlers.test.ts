import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, type Config, type SiteConfig } from '../../lib/config.ts';
import type { MagicSeoClient } from '../../lib/magicseo/client.ts';
import type { Concert } from '../../lib/concerts/wordpress.ts';
import { createAutomationHandlers, lifecycleLogKey } from '../../server/automation-handlers.ts';

const MUTATING = new Set([
  'createProject',
  'copyProject',
  'updateProject',
  'startJob',
  'stopJob',
  'setAutolaunch',
  'uploadKeywords',
  'startPositionsJob',
  'setKeywordsField',
  'createFolder',
  'moveCatalogItem',
]);

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

function concert(): Concert {
  return {
    id: 1,
    status: 'publish',
    link: 'https://atmosphere-show.ru/koncert/',
    city: 'Воткинск',
    cityIn: 'в Воткинске',
    date: '2027-02-03',
    time: '19:00',
    soldOut: false,
    postponedTo: null,
    modifiedGmt: '2026-10-01T00:00:00Z',
  };
}

function fakeClient() {
  const calls: string[] = [];
  const client = {
    async catalogItems() {
      calls.push('catalogItems');
      return { items: [] };
    },
    async getAutolaunch(id: number) {
      calls.push('getAutolaunch');
      return { project_id: id, active: false };
    },
    async createProject() {
      calls.push('createProject');
      return { id: 1 };
    },
    async uploadKeywords() {
      calls.push('uploadKeywords');
      return {};
    },
    async setAutolaunch() {
      calls.push('setAutolaunch');
      return {};
    },
    async stopJob() {
      calls.push('stopJob');
      return {};
    },
  } as unknown as MagicSeoClient;
  return { client, calls };
}

function siteWithMode(mode: SiteConfig['mode']): SiteConfig {
  return { ...DEFAULT_CONFIG.sites[0], mode };
}

function harness(mode: SiteConfig['mode']) {
  let config: Config = { ...DEFAULT_CONFIG, sites: [siteWithMode(mode)] };
  const kv = memoryKv();
  const fake = fakeClient();
  const handlers = createAutomationHandlers({
    getConfig: async () => config,
    saveConfig: async (c) => {
      config = c;
      await kv.set('config', c);
      return c;
    },
    kv,
    client: fake.client,
    fetchConcerts: async () => [concert()],
    now: () => new Date('2027-01-29T12:00:00.000Z'),
  });
  return { handlers, kv, fake, getConfig: () => config };
}

test('automation_preview on a live site makes 0 mutating calls and logs dry-run entries', async () => {
  const { handlers, kv, fake } = harness('live');
  const siteId = DEFAULT_CONFIG.sites[0].id;
  const results = await handlers.automation_preview(siteId);
  assert.ok(results.length > 0);
  for (const r of results) assert.equal(r.mode, 'dry-run');
  assert.equal(fake.calls.filter((c) => MUTATING.has(c)).length, 0);
  const stored = kv.store.get(lifecycleLogKey(siteId)) as object[];
  assert.equal(stored.length, results.length);
  for (const entry of stored) {
    assert.equal((entry as { mode: string }).mode, 'dry-run');
    assert.equal('keywords' in entry, false);
  }
});

test('automation_run on an off site returns [] and makes 0 client calls', async () => {
  const { handlers, fake } = harness('off');
  const results = await handlers.automation_run(DEFAULT_CONFIG.sites[0].id);
  assert.deepEqual(results, []);
  assert.equal(fake.calls.length, 0);
});

test("site_save with mode 'auto' throws and keeps the previous site", async () => {
  const { handlers, getConfig } = harness('dry-run');
  const before = structuredClone(getConfig());
  await assert.rejects(() => handlers.site_save({ ...before.sites[0], mode: 'auto' }));
  assert.deepEqual(getConfig(), before);
});

function assertNoUndefined(value: unknown, path: string): void {
  if (value === undefined) assert.fail(`undefined at ${path}`);
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoUndefined(item, `${path}[${i}]`));
    return;
  }
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    assertNoUndefined(field, `${path}.${key}`);
  }
}

test('automation_preview result has no undefined value', async () => {
  const { handlers } = harness('live');
  const results = await handlers.automation_preview(DEFAULT_CONFIG.sites[0].id);
  assert.ok(results.length > 0);
  assertNoUndefined(results, '$result');
});

test('205 previews keep 200 log entries without keywords under 256 KiB', async () => {
  const { handlers, kv } = harness('live');
  const siteId = DEFAULT_CONFIG.sites[0].id;
  const key = lifecycleLogKey(siteId);
  for (let i = 0; i < 205; i++) {
    await handlers.automation_preview(siteId);
  }
  const stored = kv.store.get(key) as object[];
  assert.equal(stored.length, 200);
  for (const entry of stored) {
    assert.equal('keywords' in entry, false);
  }
  const json = JSON.stringify(stored);
  assert.ok(json.length < 262144, `stored log is ${json.length} chars, must stay under 262144`);
});
