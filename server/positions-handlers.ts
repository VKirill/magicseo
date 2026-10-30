// Positions RPC handlers: report rows, CSV text and a manual harvest.
// Only type imports cross into the SDK and the client, so `node --test` runs
// this file without the SDK runtime.
import type { KvLike } from '../lib/log-store.ts';
import type { MagicSeoClient } from '../lib/magicseo/client.ts';
import { harvest } from '../lib/positions/harvest.ts';
import { projectsFromCatalog, type HarvestProject } from '../lib/positions/projects.ts';
import { reportRows, toCsv, type ReportFilter, type ReportRow } from '../lib/positions/report.ts';

/** Written by positions_harvest_now when its harvest ends; read by the schedule. */
export const LAST_RUN_KEY = 'pos-meta:last-run';

export type PositionsDeps = {
  client: Pick<MagicSeoClient, 'catalogItems' | 'positions'>;
  kv: KvLike;
};

export type PositionsHandlers = {
  positions_report(filter: ReportFilter): Promise<ReportRow[]>;
  positions_csv(filter: ReportFilter): Promise<string>;
  positions_harvest_now(): Promise<{ projects: number; checks: number }>;
};

/** The server-local day, YYYY-MM-DD (MagicSEO dates are plain days). */
function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function createPositionsHandlers(deps: PositionsDeps): PositionsHandlers {
  const projectsOfCatalog = async (): Promise<HarvestProject[]> =>
    projectsFromCatalog(await deps.client.catalogItems());
  const report = async (filter: ReportFilter): Promise<ReportRow[]> =>
    reportRows(deps.kv, await projectsOfCatalog(), filter);
  return {
    positions_report: report,
    positions_csv: async (filter) => toCsv(await report(filter)),
    positions_harvest_now: async () => {
      const result = await harvest({
        client: deps.client,
        kv: deps.kv,
        projects: await projectsOfCatalog(),
        today: localDate(new Date()),
      });
      await deps.kv.set(LAST_RUN_KEY, { at: new Date().toISOString() });
      return result;
    },
  };
}
