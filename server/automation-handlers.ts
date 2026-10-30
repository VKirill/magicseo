import type { MagicSeoClient } from '../lib/magicseo/client.ts';
import type { Concert } from '../lib/concerts/wordpress.ts';
import { parseConfig, type Config, type SiteConfig } from '../lib/config.ts';
import { appendLog, readLog, type KvLike } from '../lib/log-store.ts';
import { runSite } from '../lib/automation/run.ts';
import type { ActionResult } from '../lib/automation/executor.ts';

export const LIFECYCLE_LOG_MAX = 200;
export const LAST_RUN_PREFIX = 'automation-last-run:';

export type FetchConcerts = (opts: { baseUrl: string; postType: string }) => Promise<Concert[]>;

export type AutomationHandlerDeps = {
  getConfig(): Promise<Config>;
  saveConfig(c: Config): Promise<Config>;
  kv: KvLike;
  client: MagicSeoClient;
  fetchConcerts: FetchConcerts;
  now: () => Date;
};

export function lifecycleLogKey(siteId: string): string {
  return `lifecycle-log:${siteId}`;
}

export function lastRunKey(siteId: string): string {
  return `${LAST_RUN_PREFIX}${siteId}`;
}

export function toLogEntry(result: ActionResult): ActionResult {
  const entry = { ...result } as ActionResult & { keywords?: unknown };
  delete entry.keywords;
  return entry;
}

function requireSite(config: Config, siteId: string): SiteConfig {
  const site = config.sites.find((s) => s.id === siteId);
  if (!site) throw new Error(`unknown site '${siteId}'`);
  return site;
}

async function appendResults(kv: KvLike, siteId: string, results: ActionResult[]): Promise<void> {
  const key = lifecycleLogKey(siteId);
  for (const result of results) {
    await appendLog(kv, key, toLogEntry(result), LIFECYCLE_LOG_MAX);
  }
}

export async function appendScheduleAlert(
  kv: KvLike,
  siteId: string,
  detail: string,
  mode: SiteConfig['mode'],
): Promise<void> {
  const entry: ActionResult = {
    kind: 'skip',
    city: siteId,
    region: null,
    projectId: null,
    reason: 'schedule_error',
    nearestStartUtc: null,
    mode: mode === 'live' ? 'live' : 'dry-run',
    outcome: 'alert',
    detail,
    at: new Date().toISOString(),
  };
  await appendLog(kv, lifecycleLogKey(siteId), toLogEntry(entry), LIFECYCLE_LOG_MAX);
}

export function createAutomationHandlers(deps: AutomationHandlerDeps) {
  async function run(siteId: string, mode: 'dry-run' | 'live'): Promise<ActionResult[]> {
    const config = await deps.getConfig();
    const site = requireSite(config, siteId);
    const results = await runSite({
      site,
      client: deps.client,
      fetchConcerts: deps.fetchConcerts,
      now: deps.now,
      mode,
    });
    await appendResults(deps.kv, siteId, results);
    return results;
  }

  return {
    async automation_preview(siteId: string): Promise<ActionResult[]> {
      return run(siteId, 'dry-run');
    },

    async automation_run(siteId: string): Promise<ActionResult[]> {
      const config = await deps.getConfig();
      const site = requireSite(config, siteId);
      if (site.mode === 'off') return [];
      return run(siteId, site.mode);
    },

    async lifecycle_log(siteId: string): Promise<ActionResult[]> {
      return (await readLog(deps.kv, lifecycleLogKey(siteId))) as ActionResult[];
    },

    async site_save(site: unknown): Promise<SiteConfig> {
      if (!site || typeof site !== 'object' || Array.isArray(site)) {
        throw new Error('site_save: site must be an object');
      }
      const id = (site as { id?: unknown }).id;
      if (typeof id !== 'string' || id === '') {
        throw new Error('site_save: site.id must be a non-empty string');
      }
      const current = await deps.getConfig();
      const sites = current.sites.slice();
      const index = sites.findIndex((s) => s.id === id);
      if (index === -1) sites.push(site as SiteConfig);
      else sites[index] = site as SiteConfig;
      const parsed = parseConfig({
        sites,
        automationIntervalMinutes: current.automationIntervalMinutes,
        positionsIntervalHours: current.positionsIntervalHours,
      });
      await deps.saveConfig(parsed);
      return parsed.sites.find((s) => s.id === id) as SiteConfig;
    },
  };
}
