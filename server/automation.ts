import { z } from 'zod';
import type { PluginContext } from './context.ts';
import { fetchConcerts } from '../lib/concerts/wordpress.ts';
import {
  appendScheduleAlert,
  createAutomationHandlers,
  lastRunKey,
} from './automation-handlers.ts';

const actionResultSchema = z.object({
  kind: z.enum(['create', 'start', 'stop', 'skip']),
  city: z.string(),
  region: z.number().nullable(),
  projectId: z.number().nullable(),
  name: z.string().optional(),
  reason: z.string(),
  nearestStartUtc: z.string().nullable(),
  mode: z.enum(['dry-run', 'live']),
  outcome: z.enum(['planned', 'done', 'blocked', 'alert']),
  detail: z.string(),
  at: z.string(),
  keywordsCount: z.number().optional(),
});

export const automationRpc = {
  automation_preview: {
    input: z.object({ siteId: z.string() }),
    output: z.array(actionResultSchema),
  },
  automation_run: {
    input: z.object({ siteId: z.string() }),
    output: z.array(actionResultSchema),
  },
  lifecycle_log: {
    input: z.object({ siteId: z.string() }),
    output: z.object({ entries: z.array(actionResultSchema) }),
  },
  site_save: {
    input: z.object({ site: z.unknown() }),
    output: z.unknown(),
  },
};

function makeDeps(ctx: PluginContext) {
  return {
    getConfig: ctx.getConfig,
    saveConfig: ctx.saveConfig,
    kv: ctx.kv,
    client: ctx.client,
    fetchConcerts: (opts: { baseUrl: string; postType: string }) =>
      fetchConcerts({ baseUrl: opts.baseUrl, postType: opts.postType }),
    now: () => new Date(),
  };
}

export function automationHandlers(ctx: PluginContext) {
  const handlers = createAutomationHandlers(makeDeps(ctx));
  return {
    automation_preview: ({ siteId }: { siteId: string }) => handlers.automation_preview(siteId),
    automation_run: ({ siteId }: { siteId: string }) => handlers.automation_run(siteId),
    lifecycle_log: async ({ siteId }: { siteId: string }) => ({
      entries: await handlers.lifecycle_log(siteId),
    }),
    site_save: ({ site }: { site: unknown }) => handlers.site_save(site),
  };
}

function isDue(last: unknown, intervalMinutes: number, nowMs: number): boolean {
  if (typeof last !== 'string') return true;
  const ms = Date.parse(last);
  if (!Number.isFinite(ms)) return true;
  return nowMs - ms >= intervalMinutes * 60_000;
}

export function registerAutomation(ctx: PluginContext): void {
  const inFlight = new Set<string>();
  const handlers = createAutomationHandlers(makeDeps(ctx));

  ctx.bb.background.schedule('automation', '* * * * *', async () => {
    const config = await ctx.getConfig();
    const nowMs = Date.now();
    for (const site of config.sites) {
      if (site.mode === 'off') continue;
      if (inFlight.has(site.id)) continue;
      const last = await ctx.kv.get(lastRunKey(site.id));
      if (!isDue(last, config.automationIntervalMinutes, nowMs)) continue;
      inFlight.add(site.id);
      try {
        await handlers.automation_run(site.id);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        try {
          await appendScheduleAlert(ctx.kv, site.id, detail, site.mode);
        } catch (logErr) {
          console.error('automation: failed to append alert', logErr);
        }
      } finally {
        try {
          await ctx.kv.set(lastRunKey(site.id), new Date().toISOString());
        } catch (setErr) {
          console.error('automation: failed to write last-run', setErr);
        }
        inFlight.delete(site.id);
      }
    }
  });
}
