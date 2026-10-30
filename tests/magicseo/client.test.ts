import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MagicSeoClient, MagicSeoError } from '../../lib/magicseo/client.ts';
import type { MutationEntry } from '../../lib/magicseo/types.ts';

const PASSWORD = 'fake-secret-marker';
const USERNAME = 'fake@example.invalid';
const BASE = 'https://lk.magicseo.ru';

function makeToken(expSecondsAhead: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsAhead })).toString(
    'base64url',
  );
  return `e30.${payload}.fake-jwt-token-value`;
}

function envelope(result: unknown, status = 200, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ error: '', error_raw: '', result, total: 0, ...extra }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

type Rec = { url: string; method: string; headers: Headers; body: BodyInit | undefined; path: string };

function makeClient(opts: {
  token: string;
  onFetch?: (rec: Rec, respond: (r: Response) => Response) => Response | Promise<Response>;
  mutations?: MutationEntry[];
}): MagicSeoClient {
  const mutations = opts.mutations ?? [];
  return new MagicSeoClient({
    credentials: async () => ({ username: USERNAME, password: PASSWORD }),
    onMutation: (e) => {
      mutations.push(e);
    },
    fetch: async (url, init = {}) => {
      const u = new URL(String(url));
      const rec: Rec = {
        url: u.href,
        method: init.method ?? 'GET',
        headers: new Headers(init.headers),
        body: init.body as BodyInit | undefined,
        path: u.pathname,
      };
      const respond = (r: Response) => r;
      if (opts.onFetch) return opts.onFetch(rec, respond);
      if (u.pathname === '/backend/login') return envelope({ token: opts.token });
      return envelope({ id: 1 });
    },
  });
}

const READS: Array<{
  name: string;
  call: (c: MagicSeoClient) => Promise<unknown>;
  method: string;
  path: string;
  urlIncludes?: string;
}> = [
  { name: 'listProjects', call: (c) => c.listProjects(), method: 'GET', path: '/backend/projects/list' },
  { name: 'catalogItems', call: (c) => c.catalogItems(), method: 'GET', path: '/backend/catalog_items' },
  { name: 'getProject', call: (c) => c.getProject(5), method: 'GET', path: '/backend/project/5' },
  { name: 'getAutolaunch', call: (c) => c.getAutolaunch(5), method: 'GET', path: '/backend/project/5/autolaunch' },
  {
    name: 'keywordsV2',
    call: (c) => c.keywordsV2(5, { offset: 0, limit: 100 }),
    method: 'GET',
    path: '/backend/project/5/keywords/v2',
  },
  {
    name: 'positions',
    call: (c) => c.positions(5, { from: '2027-01-01', to: '2027-01-31' }),
    method: 'GET',
    path: '/backend/project/5/positions',
    urlIncludes: 'checks_mode=one_per_day',
  },
  { name: 'positionsJob', call: (c) => c.positionsJob(5), method: 'GET', path: '/backend/project/5/positions_job' },
  { name: 'balance', call: (c) => c.balance(), method: 'GET', path: '/backend/balance' },
  { name: 'balanceDetailed', call: (c) => c.balanceDetailed(), method: 'GET', path: '/backend/balance/detailed/v2' },
  {
    name: 'billingCounters',
    call: (c) => c.billingCounters('income', { from: '2027-01-01', to: '2027-01-31' }),
    method: 'GET',
    path: '/backend/billing/counters/income',
  },
  { name: 'listFolders', call: (c) => c.listFolders(), method: 'GET', path: '/backend/folders' },
  {
    name: 'keywordsImportPattern',
    call: (c) => c.keywordsImportPattern(),
    method: 'GET',
    path: '/backend/keywords/import_pattern',
  },
];

const MUTATIONS: Array<{
  name: string;
  call: (c: MagicSeoClient) => Promise<unknown>;
  method: string;
  path: string;
}> = [
  {
    name: 'createProject',
    call: (c) =>
      c.createProject({ name: 'X', domain: 'x.invalid', region: 213, provider: 'fixture', device: 2 }),
    method: 'POST',
    path: '/backend/project',
  },
  {
    name: 'copyProject',
    call: (c) => c.copyProject({ project_id: 5, name: 'Y', region: 2 }),
    method: 'POST',
    path: '/backend/project/copy',
  },
  { name: 'updateProject', call: (c) => c.updateProject(5, { name: 'Y' }), method: 'PATCH', path: '/backend/project/5' },
  { name: 'startJob', call: (c) => c.startJob(5), method: 'POST', path: '/backend/project/5/job' },
  { name: 'stopJob', call: (c) => c.stopJob(5), method: 'DELETE', path: '/backend/project/5/job' },
  {
    name: 'setAutolaunch',
    call: (c) => c.setAutolaunch(5, { active: true }),
    method: 'PATCH',
    path: '/backend/project/5/autolaunch',
  },
  {
    name: 'resetAutolaunchError',
    call: (c) => c.resetAutolaunchError(5),
    method: 'POST',
    path: '/backend/project/5/autolaunch/reset_error',
  },
  {
    name: 'startPositionsJob',
    call: (c) => c.startPositionsJob(5),
    method: 'POST',
    path: '/backend/project/5/positions_job',
  },
  {
    name: 'uploadKeywords',
    call: (c) => c.uploadKeywords(5, 'keyword\n'),
    method: 'POST',
    path: '/backend/project/5/keywords',
  },
  {
    name: 'setKeywordsField',
    call: (c) => c.setKeywordsField(5, { ids: [1], field: 'enabled', value: false }),
    method: 'PATCH',
    path: '/backend/project/5/keywords',
  },
  { name: 'createFolder', call: (c) => c.createFolder({ name: 'F' }), method: 'POST', path: '/backend/folders' },
  {
    name: 'moveCatalogItem',
    call: (c) => c.moveCatalogItem(9, { parent_id: 0 }),
    method: 'POST',
    path: '/backend/catalog_items/9/move',
  },
];

test('every read and mutation uses the documented method, path, and Bearer token', async () => {
  const token = makeToken(3600);
  const recs: Rec[] = [];
  const mutations: MutationEntry[] = [];
  const client = new MagicSeoClient({
    credentials: async () => ({ username: USERNAME, password: PASSWORD }),
    onMutation: (e) => {
      mutations.push(e);
    },
    fetch: async (url, init = {}) => {
      const u = new URL(String(url));
      recs.push({
        url: u.href,
        method: init.method ?? 'GET',
        headers: new Headers(init.headers),
        body: init.body as BodyInit | undefined,
        path: u.pathname,
      });
      if (u.pathname === '/backend/login') return envelope({ token });
      return envelope({ id: 1 });
    },
  });

  for (const row of [...READS, ...MUTATIONS]) {
    await row.call(client);
    const last = recs.at(-1)!;
    assert.equal(last.method, row.method, row.name);
    assert.equal(last.path, row.path, row.name);
    assert.equal(last.url, `${BASE}${row.path}${new URL(last.url).search}`, row.name);
    assert.equal(last.headers.get('authorization'), `Bearer ${token}`, row.name);
    if (row.name === 'positions') {
      assert.equal(new URL(last.url).searchParams.get('checks_mode'), 'one_per_day');
    }
    if (row.name === 'stopJob') {
      assert.equal(last.url, `${BASE}/backend/project/5/job`);
      assert.equal(last.method, 'DELETE');
    }
  }

  const upload = recs.find((r) => r.path === '/backend/project/5/keywords' && r.method === 'POST');
  assert.ok(upload?.body instanceof FormData);
  assert.ok(upload.body.get('file') instanceof Blob);
});

test('200 body error throws MagicSeoError', async () => {
  const token = makeToken(3600);
  const client = makeClient({
    token,
    onFetch: (rec) => {
      if (rec.path === '/backend/login') return envelope({ token });
      return new Response(
        JSON.stringify({ error: `${PASSWORD} ${token}`, error_raw: PASSWORD, result: null }),
        { status: 200 },
      );
    },
  });
  await assert.rejects(() => client.listProjects(), (e: unknown) => {
    assert.ok(e instanceof MagicSeoError);
    assert.equal(e.status, 200);
    assert.equal(e.path, '/backend/projects/list');
    assert.equal(e.message.includes(PASSWORD), false);
    assert.equal(e.message.includes(token), false);
    return true;
  });
});

test('401 triggers exactly one re-login and one repeat of the request', async () => {
  const token = makeToken(3600);
  const recs: Rec[] = [];
  let saw401 = false;
  const client = new MagicSeoClient({
    credentials: async () => ({ username: USERNAME, password: PASSWORD }),
    fetch: async (url, init = {}) => {
      const u = new URL(String(url));
      recs.push({
        url: u.href,
        method: init.method ?? 'GET',
        headers: new Headers(init.headers),
        body: init.body as BodyInit | undefined,
        path: u.pathname,
      });
      if (u.pathname === '/backend/login') return envelope({ token });
      if (!saw401) {
        saw401 = true;
        return envelope(null, 401);
      }
      return envelope({ projects: [] });
    },
  });
  await client.listProjects();
  const logins = recs.filter((r) => r.path === '/backend/login');
  const lists = recs.filter((r) => r.path === '/backend/projects/list');
  assert.equal(logins.length, 2);
  assert.equal(lists.length, 2);
});

test('token with exp more than 60s ahead is reused across two calls', async () => {
  const token = makeToken(3600);
  const recs: Rec[] = [];
  const client = new MagicSeoClient({
    credentials: async () => ({ username: USERNAME, password: PASSWORD }),
    fetch: async (url, init = {}) => {
      const u = new URL(String(url));
      recs.push({
        url: u.href,
        method: init.method ?? 'GET',
        headers: new Headers(init.headers),
        body: init.body as BodyInit | undefined,
        path: u.pathname,
      });
      if (u.pathname === '/backend/login') return envelope({ token });
      return envelope({ projects: [] });
    },
  });
  await client.listProjects();
  await client.balance();
  assert.equal(recs.filter((r) => r.path === '/backend/login').length, 1);
});

test('mutations call onMutation once; reads never do; login is absent', async () => {
  const token = makeToken(3600);
  const mutations: MutationEntry[] = [];
  const recs: Rec[] = [];
  const client = new MagicSeoClient({
    credentials: async () => ({ username: USERNAME, password: PASSWORD }),
    onMutation: (e) => {
      mutations.push(e);
    },
    fetch: async (url, init = {}) => {
      const u = new URL(String(url));
      recs.push({
        url: u.href,
        method: init.method ?? 'GET',
        headers: new Headers(init.headers),
        body: init.body as BodyInit | undefined,
        path: u.pathname,
      });
      if (u.pathname === '/backend/login') return envelope({ token });
      return envelope({ id: 1 });
    },
  });
  for (const row of READS) await row.call(client);
  assert.equal(mutations.length, 0);
  for (const row of MUTATIONS) {
    const before = mutations.length;
    await row.call(client);
    assert.equal(mutations.length, before + 1, row.name);
    const e = mutations.at(-1)!;
    assert.equal(e.method, row.method, row.name);
    assert.equal(e.path, row.path, row.name);
    assert.equal(e.status, 200, row.name);
    assert.equal(e.ok, true, row.name);
    assert.equal(typeof e.at, 'string', row.name);
  }
  assert.equal(
    mutations.some((e) => e.path === '/backend/login' || e.path.includes('login')),
    false,
  );
});

test('password, token and login stay out of onMutation and MagicSeoError messages', async () => {
  const token = makeToken(3600);
  const mutations: MutationEntry[] = [];
  const client = new MagicSeoClient({
    credentials: async () => ({ username: USERNAME, password: PASSWORD }),
    onMutation: (e) => {
      mutations.push(e);
    },
    fetch: async (url, init = {}) => {
      const u = new URL(String(url));
      if (u.pathname === '/backend/login') return envelope({ token });
      if (u.pathname === '/backend/project') {
        return new Response(JSON.stringify({ error: `${PASSWORD} leaked ${token}`, error_raw: token, result: null }), {
          status: 200,
        });
      }
      return envelope({ id: 1 });
    },
  });
  await client.startJob(5);
  await assert.rejects(
    () => client.createProject({ name: 'X', domain: 'x.invalid', region: 213, provider: 'fixture', device: 2 }),
    (e: unknown) => {
      assert.ok(e instanceof MagicSeoError);
      assert.equal(e.message.includes(PASSWORD), false);
      assert.equal(e.message.includes(token), false);
      return true;
    },
  );
  const dumped = JSON.stringify(mutations);
  assert.equal(dumped.includes(PASSWORD), false);
  assert.equal(dumped.includes(token), false);
  assert.equal(mutations.some((e) => e.path.includes('login')), false);
});

test('client has no payment, transfer, separate_balance, project-delete or admin methods', () => {
  const names = Object.getOwnPropertyNames(MagicSeoClient.prototype);
  for (const n of names) {
    assert.equal(/payment|transfer|separate_balance|admin/i.test(n), false, n);
  }
  assert.equal(names.includes('deleteProject'), false);
});
