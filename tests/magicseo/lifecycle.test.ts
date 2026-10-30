import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MagicSeoError } from '../../lib/magicseo/client.ts';
import { startPromotion, stopPromotion, StopFailedError } from '../../lib/magicseo/lifecycle.ts';
import type { Autolaunch } from '../../lib/magicseo/types.ts';

function settings(active: boolean): Autolaunch {
  return {
    project_id: 5,
    active,
    pos_check_freq_mins: 1440,
    click_freq_mins: 60,
    target_pos: 3,
    budget: 123,
    error: '',
    provider: 'yaxml_demo',
    start_pos: 30,
    type: 3,
    device: 2,
    adaptive_max_target_count: 5,
    use_recommendations: false,
    click_target_pos: true,
    updated_at: '2026-10-13T17:10:03.729978+03:00',
    adaptive_start_target_count: 1,
    adaptive_start_check_freq_mins: 180,
    use_brand_click: false,
    brand: '',
    user_id: 0,
    adaptive_min_check_freq_mins: 60,
    allow_demo_yaxml: true,
    adaptive_click_target_pos: true,
    speed_up_adaptive_start: false,
    brand_start_pos: 101,
    brand_finish_pos: 51,
    positions_device: 2,
  };
}

test('startPromotion GETs autolaunch and PATCHes active:true with the other fields as read', async () => {
  const stored = settings(false);
  const patches: Autolaunch[] = [];
  const client = {
    getAutolaunch: async () => stored,
    setAutolaunch: async (_id: number, body: Autolaunch) => {
      patches.push(body);
      stored.active = body.active;
    },
  };
  const out = await startPromotion(client, 5);
  assert.deepEqual(out, { ok: true, attempts: 1 });
  assert.equal(patches.length, 1);
  assert.equal(patches[0].active, true);
  assert.equal(patches[0].budget, 123);
  assert.equal(patches[0].click_freq_mins, 60);
  assert.equal(patches[0].provider, 'yaxml_demo');
  assert.equal(stored.active, true);
});

test('stopPromotion PATCHes active:false, DELETEs job, confirms GET autolaunch active:false', async () => {
  const stored = settings(true);
  const steps: string[] = [];
  const patches: Autolaunch[] = [];
  const client = {
    getAutolaunch: async () => stored,
    setAutolaunch: async (_id: number, body: Autolaunch) => {
      steps.push('patch');
      patches.push(body);
      stored.active = body.active;
    },
    stopJob: async () => {
      steps.push('delete');
    },
  };
  const out = await stopPromotion(client, 5);
  assert.deepEqual(out, { ok: true, attempts: 1 });
  assert.equal(stored.active, false);
  assert.equal(patches[0].active, false);
  assert.equal(patches[0].budget, 123);
  assert.deepEqual(steps, ['patch', 'delete']);
});

test('404 from DELETE /job with GET autolaunch active:false returns ok without retry', async () => {
  const stored = settings(true);
  let deletes = 0;
  const client = {
    getAutolaunch: async () => stored,
    setAutolaunch: async (_id: number, body: Autolaunch) => {
      stored.active = body.active;
    },
    stopJob: async () => {
      deletes += 1;
      throw new MagicSeoError(404, '/backend/project/5/job');
    },
  };
  const out = await stopPromotion(client, 5);
  assert.deepEqual(out, { ok: true, attempts: 1 });
  assert.equal(deletes, 1);
});

test('body error from DELETE /job with GET autolaunch active:false returns ok without retry', async () => {
  const stored = settings(true);
  let deletes = 0;
  const client = {
    getAutolaunch: async () => stored,
    setAutolaunch: async (_id: number, body: Autolaunch) => {
      stored.active = body.active;
    },
    stopJob: async () => {
      deletes += 1;
      throw new MagicSeoError(200, '/backend/project/5/job');
    },
  };
  const out = await stopPromotion(client, 5);
  assert.deepEqual(out, { ok: true, attempts: 1 });
  assert.equal(deletes, 1);
});

test('GET autolaunch still active retries up to 3 attempts then throws StopFailedError', async () => {
  let deletes = 0;
  const client = {
    getAutolaunch: async () => settings(true),
    setAutolaunch: async () => {},
    stopJob: async () => {
      deletes += 1;
      throw new Error('failure');
    },
  };
  await assert.rejects(
    () => stopPromotion(client, 5),
    (e: unknown) => {
      assert.ok(e instanceof StopFailedError);
      assert.equal(e.projectId, 5);
      assert.equal(e.attempts, 3);
      return true;
    },
  );
  assert.equal(deletes, 3);
});
