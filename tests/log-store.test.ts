import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendLog, readLog } from '../lib/log-store.ts';

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

test('appendLog keeps the last max entries and the stored value stays under the KV limit', async () => {
  const kv = memoryKv();
  for (let i = 1; i <= 502; i++) {
    await appendLog(kv, 'mutation-log', { method: 'POST', path: `/backend/project/${i}/job`, status: 200, ok: true, at: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.000Z` }, 500);
  }
  const log = await readLog(kv, 'mutation-log');
  assert.equal(log.length, 500);
  assert.equal((log[0] as { path: string }).path, '/backend/project/3/job');
  assert.equal((log[499] as { path: string }).path, '/backend/project/502/job');
  const stored = JSON.stringify(kv.store.get('mutation-log'));
  assert.ok(stored.length < 262144, `stored log is ${stored.length} chars, must stay under 262144`);
});
