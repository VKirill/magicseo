import type { MagicSeoClient } from '../magicseo/client.ts';
import type { SiteConfig } from '../config.ts';
import { startPromotion, stopPromotion, StopFailedError } from '../magicseo/lifecycle.ts';
import type { Action } from './planner.ts';
import { toKeywordsCsv } from './keywords.ts';

export type ActionResult = Action & {
  mode: 'dry-run' | 'live';
  outcome: 'planned' | 'done' | 'blocked' | 'alert';
  detail: string;
  at: string;
  keywordsCount?: number;
};

export type ExecuteDeps = {
  client: MagicSeoClient;
  site: SiteConfig;
  mode: 'dry-run' | 'live';
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function result(a: Action, mode: ExecuteDeps['mode'], outcome: ActionResult['outcome'], detail: string): ActionResult {
  const r: ActionResult = {
    kind: a.kind,
    city: a.city,
    region: a.region,
    projectId: a.projectId,
    name: a.name,
    reason: a.reason,
    nearestStartUtc: a.nearestStartUtc,
    mode,
    outcome,
    detail,
    at: new Date().toISOString(),
  };
  if (a.keywords) r.keywordsCount = a.keywords.length;
  return r;
}

function createdProjectId(res: unknown): number | null {
  if (res && typeof res === 'object' && 'id' in res) {
    const id = (res as { id: unknown }).id;
    if (typeof id === 'number' && Number.isInteger(id)) return id;
  }
  return null;
}

function resolveProjectId(a: Action, createdThisRun: Map<string, number>): number | null {
  return a.projectId ?? createdThisRun.get(a.city) ?? null;
}

async function runLiveCreate(
  a: Action,
  deps: ExecuteDeps,
  createdThisRun: Map<string, number>,
): Promise<ActionResult> {
  const { site, client } = deps;
  if (!site.newProject) {
    return result(a, 'live', 'blocked', 'new_project_settings_missing');
  }
  if (a.region === null) {
    return result(a, 'live', 'alert', 'create failed: city region unknown');
  }
  try {
    const body = {
      name: a.name ?? a.city,
      domain: site.domain,
      region: a.region,
      provider: site.newProject.provider,
      device: site.newProject.device,
      ...(site.newProject.parentFolderId !== null ? { parent_id: site.newProject.parentFolderId } : {}),
    };
    const res = await client.createProject(body);
    const id = createdProjectId(res);
    if (id === null) {
      return result(a, 'live', 'alert', `create failed: no project id in response`);
    }
    createdThisRun.set(a.city, id);
    if (a.keywords && a.keywords.length > 0) {
      await client.uploadKeywords(id, toKeywordsCsv(a.keywords));
    }
    await startPromotion(client, id);
    const r = result(a, 'live', 'done', 'project_created');
    r.projectId = id;
    return r;
  } catch (err) {
    return result(a, 'live', 'alert', `create failed: ${errorMessage(err)}`);
  }
}

export async function executeActions(actions: Action[], deps: ExecuteDeps): Promise<ActionResult[]> {
  if (deps.mode === 'dry-run') {
    return actions.map((a) => result(a, 'dry-run', 'planned', `planned ${a.kind}`));
  }

  const results: ActionResult[] = [];
  const createdThisRun = new Map<string, number>();
  for (const a of actions) {
    if (a.kind === 'skip') {
      results.push(result(a, 'live', 'done', a.reason));
      continue;
    }
    if (a.kind === 'create') {
      results.push(await runLiveCreate(a, deps, createdThisRun));
      continue;
    }
    const projectId = resolveProjectId(a, createdThisRun);
    if (projectId === null) {
      results.push(result(a, 'live', 'alert', `${a.kind} skipped: project id unknown`));
      continue;
    }
    if (a.kind === 'start' && a.projectId === null && createdThisRun.get(a.city) === projectId) {
      results.push(result(a, 'live', 'done', 'already_started_by_create'));
      continue;
    }
    try {
      if (a.kind === 'start') {
        await startPromotion(deps.client, projectId);
        results.push(result(a, 'live', 'done', 'promotion_started'));
      } else {
        await stopPromotion(deps.client, projectId);
        results.push(result(a, 'live', 'done', 'promotion_stopped'));
      }
    } catch (err) {
      const detail =
        a.kind === 'stop' && err instanceof StopFailedError
          ? `stop_failed: ${errorMessage(err)}`
          : `${a.kind} failed: ${errorMessage(err)}`;
      results.push(result(a, 'live', 'alert', detail));
    }
  }
  return results;
}
