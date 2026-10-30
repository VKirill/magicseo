import type {
  Autolaunch,
  Balance,
  BalanceDetailed,
  BillingCounters,
  BillingKind,
  CatalogItem,
  CopyProjectBody,
  CreateFolderBody,
  CreateProjectBody,
  DateRange,
  Folder,
  KeywordV2,
  KeywordsFieldBody,
  KeywordsPageQuery,
  MoveCatalogBody,
  MutationEntry,
  PositionsJob,
  PositionsResponse,
  Project,
  ProjectListItem,
  UpdateProjectBody,
} from './types.ts';

const DEFAULT_BASE = 'https://lk.magicseo.ru';
const REUSE_SKEW_MS = 60_000;

export class MagicSeoError extends Error {
  status: number;
  path: string;

  constructor(status: number, path: string) {
    super(`Cabinet request failed (${status}) ${path}`);
    this.name = 'MagicSeoError';
    this.status = status;
    this.path = path;
  }
}

type Credentials = { username: string; password: string };

type ClientOpts = {
  credentials: () => Promise<Credentials>;
  fetch?: typeof fetch;
  baseUrl?: string;
  onMutation?: (e: MutationEntry) => void | Promise<void>;
};

type RequestOpts = {
  query?: Record<string, string | number | undefined>;
  json?: unknown;
  form?: FormData;
  mutate?: boolean;
};

function jwtFresh(token: string, nowMs: number): boolean {
  const parts = token.split('.');
  if (parts.length < 2) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 > nowMs + REUSE_SKEW_MS;
  } catch {
    return false;
  }
}

function envelopeHasError(data: unknown): boolean {
  if (!data || typeof data !== 'object' || !('error' in data)) return false;
  const err = (data as { error: unknown }).error;
  return typeof err === 'string' && err.length > 0;
}

function unwrap(data: unknown): unknown {
  if (data && typeof data === 'object' && 'result' in data) {
    return (data as { result: unknown }).result;
  }
  return data;
}

function queryString(query: Record<string, string | number | undefined> | undefined): string {
  if (!query) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export class MagicSeoClient {
  #credentials: () => Promise<Credentials>;
  #fetch: typeof fetch;
  #baseUrl: string;
  #onMutation?: (e: MutationEntry) => void | Promise<void>;
  #token: string | null = null;
  #loginInFlight: Promise<string> | null = null;

  constructor(opts: ClientOpts) {
    this.#credentials = opts.credentials;
    this.#fetch = opts.fetch ?? fetch;
    this.#baseUrl = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
    this.#onMutation = opts.onMutation;
  }

  async listProjects(): Promise<ProjectListItem[]> {
    const data = await this.#request('GET', '/backend/projects/list');
    if (Array.isArray(data)) return data as ProjectListItem[];
    if (data && typeof data === 'object' && 'projects' in data) {
      return (data as { projects: ProjectListItem[] }).projects;
    }
    return [];
  }

  async catalogItems(): Promise<{ items: CatalogItem[] } | CatalogItem[]> {
    return (await this.#request('GET', '/backend/catalog_items')) as { items: CatalogItem[] } | CatalogItem[];
  }

  async getProject(id: number, range?: DateRange): Promise<Project> {
    return (await this.#request('GET', `/backend/project/${id}`, {
      query: { from: range?.from, to: range?.to },
    })) as Project;
  }

  async getAutolaunch(id: number): Promise<Autolaunch> {
    return (await this.#request('GET', `/backend/project/${id}/autolaunch`)) as Autolaunch;
  }

  async keywordsV2(id: number, q: KeywordsPageQuery): Promise<KeywordV2[]> {
    const data = await this.#request('GET', `/backend/project/${id}/keywords/v2`, {
      query: { offset: q.offset, limit: q.limit, from: q.from, to: q.to },
    });
    return (Array.isArray(data) ? data : []) as KeywordV2[];
  }

  async positions(id: number, range: { from: string; to: string }): Promise<PositionsResponse> {
    return (await this.#request('GET', `/backend/project/${id}/positions`, {
      query: { from: range.from, to: range.to, checks_mode: 'one_per_day' },
    })) as PositionsResponse;
  }

  async positionsJob(id: number): Promise<PositionsJob> {
    return (await this.#request('GET', `/backend/project/${id}/positions_job`)) as PositionsJob;
  }

  async balance(): Promise<Balance> {
    return (await this.#request('GET', '/backend/balance')) as Balance;
  }

  async balanceDetailed(): Promise<BalanceDetailed> {
    return (await this.#request('GET', '/backend/balance/detailed/v2')) as BalanceDetailed;
  }

  async billingCounters(kind: BillingKind, range: { from: string; to: string }): Promise<BillingCounters> {
    return (await this.#request('GET', `/backend/billing/counters/${kind}`, {
      query: { from: range.from, to: range.to },
    })) as BillingCounters;
  }

  async listFolders(): Promise<Folder[]> {
    const data = await this.#request('GET', '/backend/folders');
    if (Array.isArray(data)) return data as Folder[];
    if (data && typeof data === 'object' && 'folders' in data) {
      return (data as { folders: Folder[] }).folders;
    }
    return (data ?? []) as Folder[];
  }

  async keywordsImportPattern(): Promise<unknown> {
    return this.#request('GET', '/backend/keywords/import_pattern');
  }

  async createProject(body: CreateProjectBody): Promise<unknown> {
    return this.#request('POST', '/backend/project', { json: body, mutate: true });
  }

  async copyProject(body: CopyProjectBody): Promise<unknown> {
    return this.#request('POST', '/backend/project/copy', { json: body, mutate: true });
  }

  async updateProject(id: number, body: UpdateProjectBody): Promise<unknown> {
    return this.#request('PATCH', `/backend/project/${id}`, { json: body, mutate: true });
  }

  async startJob(id: number): Promise<unknown> {
    return this.#request('POST', `/backend/project/${id}/job`, { mutate: true });
  }

  async stopJob(id: number): Promise<unknown> {
    return this.#request('DELETE', `/backend/project/${id}/job`, { mutate: true });
  }

  async setAutolaunch(id: number, settings: Autolaunch | Record<string, unknown>): Promise<unknown> {
    return this.#request('PATCH', `/backend/project/${id}/autolaunch`, { json: settings, mutate: true });
  }

  async resetAutolaunchError(id: number): Promise<unknown> {
    return this.#request('POST', `/backend/project/${id}/autolaunch/reset_error`, { mutate: true });
  }

  async startPositionsJob(id: number): Promise<unknown> {
    return this.#request('POST', `/backend/project/${id}/positions_job`, { mutate: true });
  }

  async uploadKeywords(id: number, csvText: string): Promise<unknown> {
    const form = new FormData();
    form.set('file', new Blob([csvText], { type: 'text/csv' }), 'keywords.csv');
    return this.#request('POST', `/backend/project/${id}/keywords`, { form, mutate: true });
  }

  async setKeywordsField(id: number, body: KeywordsFieldBody): Promise<unknown> {
    return this.#request('PATCH', `/backend/project/${id}/keywords`, { json: body, mutate: true });
  }

  async createFolder(body: CreateFolderBody): Promise<unknown> {
    return this.#request('POST', '/backend/folders', { json: body, mutate: true });
  }

  async moveCatalogItem(itemId: number, body: MoveCatalogBody): Promise<unknown> {
    return this.#request('POST', `/backend/catalog_items/${itemId}/move`, { json: body, mutate: true });
  }

  async #login(): Promise<string> {
    if (this.#loginInFlight) return this.#loginInFlight;
    this.#loginInFlight = this.#loginOnce().finally(() => {
      this.#loginInFlight = null;
    });
    return this.#loginInFlight;
  }

  async #loginOnce(): Promise<string> {
    const creds = await this.#credentials();
    const url = `${this.#baseUrl}/backend/login`;
    const res = await this.#fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: creds.username, password: creds.password }),
    });
    const data = await this.#readBody(res);
    if (res.status !== 200 || envelopeHasError(data)) {
      throw new MagicSeoError(res.status, '/backend/login');
    }
    const payload = unwrap(data) as { token?: string } | null;
    const token = payload && typeof payload === 'object' ? payload.token : undefined;
    if (typeof token !== 'string' || token.length === 0) {
      throw new MagicSeoError(res.status, '/backend/login');
    }
    this.#token = token;
    return token;
  }

  async #ensureToken(): Promise<string> {
    if (this.#token && jwtFresh(this.#token, Date.now())) return this.#token;
    this.#token = null;
    return this.#login();
  }

  async #request(method: string, path: string, opts: RequestOpts = {}): Promise<unknown> {
    const token = await this.#ensureToken();
    let res = await this.#send(method, path, opts, token);
    if (res.status === 401) {
      this.#token = null;
      const next = await this.#login();
      res = await this.#send(method, path, opts, next);
    }
    const data = await this.#readBody(res);
    const failed = res.status === 401 || res.status >= 400 || envelopeHasError(data);
    const ok = res.status >= 200 && res.status < 300 && !envelopeHasError(data);
    if (opts.mutate) {
      await this.#onMutation?.({
        method,
        path,
        status: res.status,
        ok,
        at: new Date().toISOString(),
      });
    }
    if (failed) throw new MagicSeoError(res.status, path);
    return unwrap(data);
  }

  async #send(method: string, path: string, opts: RequestOpts, token: string): Promise<Response> {
    const url = `${this.#baseUrl}${path}${queryString(opts.query)}`;
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${token}`);
    let body: BodyInit | undefined;
    if (opts.form) {
      body = opts.form;
    } else if (opts.json !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(opts.json);
    }
    return this.#fetch(url, { method, headers, body });
  }

  async #readBody(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
}
