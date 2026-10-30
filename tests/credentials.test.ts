import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLogin } from '../lib/credentials.ts';

test('loadLogin calls env-catalog env_get_value and returns access.username / access.password', async () => {
  const calls: unknown[] = [];
  const fakeCallRpc = async (req: unknown) => {
    calls.push(req);
    return { access: { username: 'owner@example.test', password: 'pw-marker' } };
  };
  const creds = await loadLogin(fakeCallRpc, 'MAGICSEO_LOGIN');
  assert.deepEqual(calls, [
    { pluginId: 'env-catalog', method: 'env_get_value', input: { name: 'MAGICSEO_LOGIN' } },
  ]);
  assert.deepEqual(creds, { username: 'owner@example.test', password: 'pw-marker' });
});

test('loadLogin throws naming the variable when access has no password', async () => {
  const fakeCallRpc = async () => ({ access: { username: 'owner@example.test' } });
  await assert.rejects(loadLogin(fakeCallRpc, 'MAGICSEO_LOGIN'), (e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    assert.ok(message.includes('MAGICSEO_LOGIN'), `message must name the variable: ${message}`);
    assert.ok(!message.includes('owner@example.test'), 'message must not leak the username');
    return true;
  });
});
