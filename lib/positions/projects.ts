export type HarvestProject = {
  id: number;
  domain: string;
  region: number;
  name: string;
};

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * One entry per project item of the catalog_items tree (folder nodes are
 * skipped), the same walk as rowsFromCatalog in lib/hierarchy.ts.
 */
export function projectsFromCatalog(catalog: unknown): HarvestProject[] {
  const rows: HarvestProject[] = [];
  const walk = (node: unknown): void => {
    if (!isObj(node)) return;
    const info = node.project_info;
    if (isObj(info) && typeof info.id === 'number') {
      rows.push({
        id: info.id,
        domain: typeof info.domain === 'string' ? info.domain : '',
        region: typeof info.region === 'number' ? info.region : 0,
        name: typeof info.name === 'string' ? info.name : '',
      });
    }
    if (Array.isArray(node.children)) for (const child of node.children) walk(child);
  };
  if (Array.isArray(catalog)) for (const item of catalog) walk(item);
  else if (isObj(catalog) && Array.isArray(catalog.items)) for (const item of catalog.items) walk(item);
  return rows;
}
