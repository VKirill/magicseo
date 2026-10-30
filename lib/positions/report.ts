import { cityByRegion } from '../cities/index.ts';
import type { KvLike } from '../log-store.ts';
import type { HarvestProject } from './projects.ts';

export type ReportRow = {
  site: string;
  city: string;
  keyword: string;
  date: string;
  pcPosition: number | null;
  mobilePosition: number | null;
  foundUrl: string;
};

export type ReportFilter = {
  domain: string;
  region?: number;
  /** Substring of a keyword, case-sensitive; omit for all. */
  keyword?: string;
  from: string;
  to: string;
};

/** The shape harvest() stores under `pos:<projectId>:<YYYY-MM>`. */
type StoredCheck = { pc: number | null; mobile: number | null; url: string };
type MonthValue = Record<string, Record<string, StoredCheck>>;

function monthsInRange(from: string, to: string): string[] {
  const months: string[] = [];
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  for (let y = fromYear, m = fromMonth; y < toYear || (y === toYear && m <= toMonth); ) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

/** Reads the stored months of the filter's projects; rows sorted by keyword, then date. */
export async function reportRows(
  kv: KvLike,
  projects: HarvestProject[],
  filter: ReportFilter,
): Promise<ReportRow[]> {
  const rows: ReportRow[] = [];
  for (const project of projects) {
    if (project.domain !== filter.domain) continue;
    if (filter.region !== undefined && project.region !== filter.region) continue;
    const city = cityByRegion(project.region) ?? project.name;
    for (const month of monthsInRange(filter.from, filter.to)) {
      const stored = (await kv.get(`pos:${project.id}:${month}`)) as MonthValue | undefined;
      if (!stored) continue;
      for (const [keyword, byDate] of Object.entries(stored)) {
        if (filter.keyword !== undefined && !keyword.includes(filter.keyword)) continue;
        for (const [date, check] of Object.entries(byDate)) {
          if (date < filter.from || date > filter.to) continue;
          rows.push({
            site: project.domain,
            city,
            keyword,
            date,
            pcPosition: check.pc,
            mobilePosition: check.mobile,
            foundUrl: check.url,
          });
        }
      }
    }
  }
  return rows.sort(
    (a, b) =>
      a.keyword.localeCompare(b.keyword) ||
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      a.city.localeCompare(b.city),
  );
}

const CSV_HEADER = 'site,city,keyword,date,pc_position,mobile_position,found_url';

/** RFC-4180: comma, quote or newline → double quotes with inner quotes doubled. */
function csvField(value: string | number | null): string {
  const s = value === null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(rows: ReportRow[]): string {
  const lines = [CSV_HEADER];
  for (const row of rows) {
    lines.push(
      [row.site, row.city, row.keyword, row.date, row.pcPosition, row.mobilePosition, row.foundUrl]
        .map(csvField)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
