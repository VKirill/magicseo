import type { KvLike } from '../log-store.ts';
import type { MagicSeoClient } from '../magicseo/client.ts';
import type { KeywordV2, PositionsResponse } from '../magicseo/types.ts';
import type { HarvestProject } from './projects.ts';

/** One stored check: `pos:<projectId>:<YYYY-MM>` = { keyword: { date: this } }. */
type StoredCheck = { pc: number | null; mobile: number | null; url: string };
type MonthValue = Record<string, Record<string, StoredCheck>>;

const DEFAULT_PAUSE_MS = 1000;

export type HarvestDeps = {
  /** Only the read side of the client: harvesting never mutates anything. */
  client: Pick<MagicSeoClient, 'positions'>;
  kv: KvLike;
  projects: HarvestProject[];
  /** YYYY-MM-DD; the window closes at this day. */
  today: string;
  /** Pause between projects, ms. */
  pauseMs?: number;
};

function shiftDays(today: string, days: number): string {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The positions endpoint returns a keywords array, possibly double-wrapped. */
function keywordsOf(resp: PositionsResponse): KeywordV2[] {
  if (Array.isArray(resp)) return resp;
  return resp.result ?? resp.keywords ?? [];
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * Reads positions of every project (GET only — never startPositionsJob or any
 * other mutation) and merges them into one KV key per project and month,
 * keeping the last harvested date in 'pos-meta:<projectId>'. A failing project
 * is skipped; the others go on.
 */
export async function harvest(deps: HarvestDeps): Promise<{ projects: number; checks: number }> {
  let projects = 0;
  let checks = 0;
  for (const [index, project] of deps.projects.entries()) {
    if (index > 0) await sleep(deps.pauseMs ?? DEFAULT_PAUSE_MS);
    try {
      checks += await harvestProject(deps.client, deps.kv, project, deps.today);
      projects += 1;
    } catch {
      // One broken project must not stop the others; the next run retries it.
    }
  }
  return { projects, checks };
}

async function harvestProject(
  client: Pick<MagicSeoClient, 'positions'>,
  kv: KvLike,
  project: HarvestProject,
  today: string,
): Promise<number> {
  const metaKey = `pos-meta:${project.id}`;
  const meta = (await kv.get(metaKey)) as { lastDate?: string } | undefined;
  const lastDate = meta?.lastDate;
  const from = lastDate !== undefined && lastDate <= today ? lastDate : shiftDays(today, -30);
  const keywords = keywordsOf(await client.positions(project.id, { from, to: today }));

  const byMonth = new Map<string, MonthValue>();
  let newest = '';
  let checks = 0;
  for (const kw of keywords) {
    for (const check of kw.checks ?? []) {
      const date = check.time.slice(0, 10);
      const month = date.slice(0, 7);
      let monthValue = byMonth.get(month);
      if (!monthValue) {
        monthValue = {};
        byMonth.set(month, monthValue);
      }
      let byDate = monthValue[kw.text];
      if (!byDate) {
        byDate = {};
        monthValue[kw.text] = byDate;
      }
      byDate[date] = {
        pc: check.pc_position ?? null,
        mobile: check.mobile_position ?? null,
        url: check.found_url ?? '',
      };
      if (date > newest) newest = date;
      checks += 1;
    }
  }

  for (const [month, monthValue] of byMonth) {
    const stored = (await kv.get(`pos:${project.id}:${month}`)) as MonthValue | undefined;
    const merged: MonthValue = { ...stored };
    for (const [text, byDate] of Object.entries(monthValue)) {
      merged[text] = { ...merged[text], ...byDate };
    }
    await kv.set(`pos:${project.id}:${month}`, merged);
  }
  if (newest !== '') {
    await kv.set(metaKey, { lastDate: lastDate !== undefined && lastDate > newest ? lastDate : newest });
  }
  return checks;
}
