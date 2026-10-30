import { cityByRegion } from './cities/index.ts';

export type ProjectRow = {
  id: number;
  name: string;
  domain: string;
  region: number;
  active: boolean;
  keywords: number;
  periodSpent: number;
  totalSpent: number;
  lastJobStatus: number | null;
};

export type SiteNode = {
  domain: string;
  configured: boolean;
  projects: (ProjectRow & { city: string })[];
};

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Kopecks → rubles (catalog_items sample: total_money_spent 79800 = 798 ₽). */
function rub(kopecks: unknown): number {
  return typeof kopecks === 'number' ? kopecks / 100 : 0;
}

/**
 * Walks the catalog_items tree (items/children), one row per project item.
 * Money comes from project_info.total_money_spent / period_money_spent
 * (kopecks → rubles); project_info.total_spent / period_spent are click
 * counts and are not used as money.
 */
export function rowsFromCatalog(catalog: unknown, active: Record<number, boolean>): ProjectRow[] {
  const rows: ProjectRow[] = [];
  const walk = (node: unknown): void => {
    if (!isObj(node)) return;
    const info = node.project_info;
    if (isObj(info) && typeof info.id === 'number') {
      const keywords = isObj(node.keywords) ? node.keywords : {};
      const lastJob = isObj(info.last_job) ? info.last_job : {};
      rows.push({
        id: info.id,
        name: typeof info.name === 'string' ? info.name : '',
        domain: typeof info.domain === 'string' ? info.domain : '',
        region: typeof info.region === 'number' ? info.region : 0,
        active: active[info.id] ?? false,
        keywords: typeof keywords.keywords_count === 'number' ? keywords.keywords_count : 0,
        periodSpent: rub(info.period_money_spent),
        totalSpent: rub(info.total_money_spent),
        lastJobStatus: typeof lastJob.status === 'number' ? lastJob.status : null,
      });
    }
    if (Array.isArray(node.children)) for (const child of node.children) walk(child);
  };
  if (Array.isArray(catalog)) for (const item of catalog) walk(item);
  else if (isObj(catalog) && Array.isArray(catalog.items)) for (const item of catalog.items) walk(item);
  return rows;
}

/**
 * Groups project rows into site nodes: configured sites first, projects
 * sorted by city; the city comes from the Yandex region id and falls back to
 * the project name when the region is unknown.
 */
export function buildHierarchy(rows: ProjectRow[], configuredDomains: string[]): SiteNode[] {
  const configured = new Set(configuredDomains);
  const order: string[] = [];
  const byDomain = new Map<string, ProjectRow[]>();
  for (const domain of configuredDomains) {
    if (!byDomain.has(domain)) {
      byDomain.set(domain, []);
      order.push(domain);
    }
  }
  for (const row of rows) {
    let list = byDomain.get(row.domain);
    if (!list) {
      list = [];
      byDomain.set(row.domain, list);
      order.push(row.domain);
    }
    list.push(row);
  }
  return order
    .map((domain) => ({
      domain,
      configured: configured.has(domain),
      projects: byDomain
        .get(domain)!
        .map((row) => ({ ...row, city: cityByRegion(row.region) ?? row.name }))
        .sort((a, b) => a.city.localeCompare(b.city)),
    }))
    .sort((a, b) => Number(b.configured) - Number(a.configured));
}
