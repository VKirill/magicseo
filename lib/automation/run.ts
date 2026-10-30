import type { MagicSeoClient } from '../magicseo/client.ts';
import type { CatalogItem, CatalogProjectInfo } from '../magicseo/types.ts';
import type { fetchConcerts } from '../concerts/wordpress.ts';
import type { SiteConfig } from '../config.ts';
import { planSite, type CityProject } from './planner.ts';
import { executeActions, type ActionResult } from './executor.ts';

export type RunDeps = {
  site: SiteConfig;
  client: MagicSeoClient;
  fetchConcerts: typeof fetchConcerts;
  now: () => Date;
  mode: 'dry-run' | 'live';
};

function flattenProjects(items: CatalogItem[], out: CatalogProjectInfo[] = []): CatalogProjectInfo[] {
  for (const item of items) {
    if (item.project_info) out.push(item.project_info);
    if (item.children) flattenProjects(item.children, out);
  }
  return out;
}

export async function runSite(deps: RunDeps): Promise<ActionResult[]> {
  const { site, client } = deps;
  const concerts = await deps.fetchConcerts({
    baseUrl: site.concerts.baseUrl,
    postType: site.concerts.postType,
  });
  const tree = await client.catalogItems();
  const items = Array.isArray(tree) ? tree : tree.items;
  const infos = flattenProjects(items).filter((p) => p.domain === site.domain);
  const projects: CityProject[] = [];
  for (const info of infos) {
    const autolaunch = await client.getAutolaunch(info.id);
    projects.push({
      id: info.id,
      name: info.name,
      domain: info.domain,
      region: info.region,
      active: autolaunch.active,
    });
  }
  const actions = planSite({ site, concerts, projects, now: deps.now() });
  return executeActions(actions, { client, site, mode: deps.mode });
}
