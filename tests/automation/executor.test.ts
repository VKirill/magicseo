import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MagicSeoClient } from '../../lib/magicseo/client.ts';
import type { SiteConfig } from '../../lib/config.ts';
import type { Action } from '../../lib/automation/planner.ts';
import { executeActions, type ActionResult } from '../../lib/automation/executor.ts';

const SITE: SiteConfig = {
  id: 'atmosphere-show',
  domain: 'atmosphere-show.ru',
  concerts: { baseUrl: 'https://atmosphere-show.ru', postType: 'concerts', credentialName: null },
  nameTemplate: 'Концерт %город%',
  keywordTemplates: [],
  cityAliases: {},
  regionOverrides: {},
  timeZoneOverrides: {},
  mode: 'dry-run',
  stopHoursBefore: 48,
  newProject: { provider: 'topvisor', device: 2, parentFolderId: null, autolaunch: null },
};

type Fake = {
  client: MagicSeoClient;
  calls: string[];
  createBodies: unknown[];
  keywordUploads: Array<[number, string]>;
  autolaunchSets: Array<[number, boolean]>;
};

function fakeClient(opts: { ignoreSetActive?: boolean; activeIds?: number[] } = {}): Fake {
  const calls: string[] = [];
  const createBodies: unknown[] = [];
  const keywordUploads: Array<[number, string]> = [];
  const autolaunchSets: Array<[number, boolean]> = [];
  const active = new Map<number, boolean>();
  for (const id of opts.activeIds ?? []) active.set(id, true);
  const client = {
    async createProject(body: unknown) {
      calls.push('createProject');
      createBodies.push(body);
      return { id: 77 };
    },
    async uploadKeywords(id: number, csv: string) {
      calls.push('uploadKeywords');
      keywordUploads.push([id, csv]);
      return {};
    },
    async getAutolaunch(id: number) {
      calls.push('getAutolaunch');
      return { project_id: id, active: active.get(id) ?? false };
    },
    async setAutolaunch(id: number, settings: { active: boolean }) {
      calls.push('setAutolaunch');
      autolaunchSets.push([id, settings.active]);
      if (!opts.ignoreSetActive) active.set(id, settings.active);
      return {};
    },
    async stopJob(id: number) {
      calls.push('stopJob');
      return { id };
    },
  } as unknown as MagicSeoClient;
  return { client, calls, createBodies, keywordUploads, autolaunchSets };
}

function createAction(): Action {
  return {
    kind: 'create',
    city: 'Воткинск',
    region: 11149,
    projectId: null,
    name: 'Концерт Воткинск',
    keywords: ['a b', 'c'],
    reason: 'future_concert_no_project',
    nearestStartUtc: null,
  };
}

function startAction(projectId: number | null): Action {
  return {
    kind: 'start',
    city: 'Воткинск',
    region: 11149,
    projectId,
    reason: 'future_concert_project_inactive',
    nearestStartUtc: null,
  };
}

function stopAction(projectId: number): Action {
  return {
    kind: 'stop',
    city: 'Москва',
    region: 213,
    projectId,
    reason: 'concert_within_stop_window',
    nearestStartUtc: '2027-01-31T11:00:00.000Z',
  };
}

const MUTATING = new Set(['createProject', 'uploadKeywords', 'setAutolaunch', 'stopJob']);

function mutatingCalls(calls: string[]): number {
  return calls.filter((c) => MUTATING.has(c)).length;
}

test('dry-run plans create/start/stop with zero mutating client calls', async () => {
  const fake = fakeClient();
  const results = await executeActions([createAction(), startAction(5), stopAction(5)], {
    client: fake.client,
    site: SITE,
    mode: 'dry-run',
  });
  assert.equal(results.length, 3);
  for (const r of results) {
    assert.equal(r.outcome, 'planned');
    assert.equal(r.mode, 'dry-run');
  }
  assert.equal(mutatingCalls(fake.calls), 0);
  assert.equal(fake.calls.length, 0);
});

test('dry-run create result carries keywordsCount, not the keywords array', async () => {
  const fake = fakeClient();
  const results = await executeActions([createAction()], { client: fake.client, site: SITE, mode: 'dry-run' });
  const r: ActionResult = results[0];
  assert.equal(r.keywordsCount, 2);
  assert.equal('keywords' in r, false);
});

test('live create: createProject with name/domain/region/provider/device, then keywords CSV, then start', async () => {
  const fake = fakeClient();
  const results = await executeActions([createAction()], { client: fake.client, site: SITE, mode: 'live' });
  const r = results[0];
  assert.equal(r.outcome, 'done');
  assert.deepEqual(fake.createBodies[0], {
    name: 'Концерт Воткинск',
    domain: 'atmosphere-show.ru',
    region: 11149,
    provider: 'topvisor',
    device: 2,
  });
  assert.deepEqual(fake.keywordUploads, [[77, 'a b\nc\n']]);
  const at = (m: string) => fake.calls.indexOf(m);
  assert.ok(at('createProject') > -1);
  assert.ok(at('createProject') < at('uploadKeywords'));
  assert.ok(at('uploadKeywords') < at('setAutolaunch'));
  assert.equal(r.projectId, 77);
  assert.equal(r.keywordsCount, 2);
});

test('live create without new-project settings: blocked, no createProject call', async () => {
  const fake = fakeClient();
  const site: SiteConfig = { ...SITE, newProject: null };
  const results = await executeActions([createAction()], { client: fake.client, site, mode: 'live' });
  assert.equal(results[0].outcome, 'blocked');
  assert.equal(results[0].detail, 'new_project_settings_missing');
  assert.equal(mutatingCalls(fake.calls), 0);
});

test('live stop where promotion cannot be stopped: alert', async () => {
  const fake = fakeClient({ ignoreSetActive: true, activeIds: [5] });
  const results = await executeActions([stopAction(5)], { client: fake.client, site: SITE, mode: 'live' });
  assert.equal(results[0].outcome, 'alert');
  assert.ok(results[0].detail.startsWith('stop_failed:'));
});

test('live start after create does not start the freshly created project twice', async () => {
  const fake = fakeClient();
  const results = await executeActions([createAction(), startAction(null)], {
    client: fake.client,
    site: SITE,
    mode: 'live',
  });
  assert.deepEqual(results.map((r) => r.outcome), ['done', 'done']);
  assert.equal(results[1].detail, 'already_started_by_create');
  assert.deepEqual(
    fake.autolaunchSets.filter(([id]) => id === 77),
    [[77, true]], // exactly one start: the one inside create
  );
});
