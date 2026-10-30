// Position history: RPC contract, handlers and the harvest schedule.
import { z } from 'zod';
import type { PluginContext } from './context.ts';
import { createPositionsHandlers, LAST_RUN_KEY } from './positions-handlers.ts';

const reportFilterInput = z.object({
  domain: z.string(),
  region: z.number().optional(),
  keyword: z.string().optional(),
  from: z.string(),
  to: z.string(),
});

export const positionsRpc = {
  positions_report: {
    input: reportFilterInput,
    output: z.array(
      z.object({
        site: z.string(),
        city: z.string(),
        keyword: z.string(),
        date: z.string(),
        pcPosition: z.number().nullable(),
        mobilePosition: z.number().nullable(),
        foundUrl: z.string(),
      }),
    ),
  },
  positions_csv: {
    input: reportFilterInput,
    output: z.string(),
  },
  positions_harvest_now: {
    input: z.null(),
    output: z.object({ projects: z.number(), checks: z.number() }),
  },
};

export function positionsHandlers(ctx: PluginContext) {
  return createPositionsHandlers({ client: ctx.client, kv: ctx.kv });
}

/** Harvests every 10 minutes, but only when the last run is older than the config interval. */
export function registerPositions(ctx: PluginContext): void {
  let inFlight = false;
  ctx.bb.background.schedule('positions', '*/10 * * * *', async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const intervalHours = (await ctx.getConfig()).positionsIntervalHours;
      const last = (await ctx.kv.get(LAST_RUN_KEY)) as { at?: string } | undefined;
      const at = last && typeof last.at === 'string' ? Date.parse(last.at) : NaN;
      const due = Number.isNaN(at) || Date.now() - at >= intervalHours * 3_600_000;
      if (due) await positionsHandlers(ctx).positions_harvest_now();
    } catch {
      // bb.background records the failure; the next tick retries the harvest.
    } finally {
      inFlight = false;
    }
  });
}
