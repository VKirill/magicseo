import type { SiteConfig } from '../config.ts';
import type { Concert } from '../concerts/wordpress.ts';
import { resolveCity, concertStartUtc, cityByRegion } from '../cities/index.ts';
import { renderKeywords } from './keywords.ts';

export type CityProject = {
  id: number;
  name: string;
  domain: string;
  region: number;
  active: boolean;
};

export type Action = {
  kind: 'create' | 'start' | 'stop' | 'skip';
  city: string;
  region: number | null;
  projectId: number | null;
  name?: string;
  keywords?: string[];
  reason: string;
  nearestStartUtc: string | null;
};

export type PlanInput = {
  site: SiteConfig;
  concerts: Concert[];
  projects: CityProject[];
  now: Date;
};

const HOUR_MS = 3_600_000;

function qualifies(c: Concert): boolean {
  return c.status === 'publish' && c.link !== '';
}

function projectFor(projects: CityProject[], site: SiteConfig, region: number): CityProject | null {
  return (
    projects.find((p) => p.domain === site.domain && p.region === region) ?? null
  );
}

function cityAction(
  a: Omit<Action, 'kind' | 'region' | 'projectId'>,
  kind: Action['kind'],
  region: number | null,
  projectId: number | null,
): Action {
  return { kind, region, projectId, ...a };
}

export function planSite(input: PlanInput): Action[] {
  const { site, concerts, projects, now } = input;
  const actions: Action[] = [];
  const skippedCities = new Set<string>();
  const groups = new Map<
    string,
    { city: string; region: number; timeZone: string; concerts: Concert[] }
  >();
  const coveredRegions = new Set<number>();

  for (const c of concerts) {
    if (!qualifies(c)) continue;
    const resolved = resolveCity(c.city, {
      aliases: site.cityAliases,
      regionOverrides: site.regionOverrides,
      timeZoneOverrides: site.timeZoneOverrides,
    });
    if (!resolved) {
      if (!skippedCities.has(c.city)) {
        skippedCities.add(c.city);
        actions.push(
          cityAction(
            { city: c.city, projectId: null, reason: 'unmapped_city', nearestStartUtc: null },
            'skip',
            null,
            null,
          ),
        );
      }
      continue;
    }
    let group = groups.get(resolved.name);
    if (!group) {
      group = { city: resolved.name, region: resolved.region, timeZone: resolved.timeZone, concerts: [] };
      groups.set(resolved.name, group);
    }
    group.concerts.push(c);
  }

  for (const group of groups.values()) {
    coveredRegions.add(group.region);
    const project = projectFor(projects, site, group.region);
    const starts = group.concerts
      .map((c) => ({ concert: c, start: concertStartUtc(c, group.timeZone) }))
      .filter((s) => s.start.getTime() > now.getTime())
      .sort((x, y) => x.start.getTime() - y.start.getTime());
    const nearest = starts[0] ?? null;
    const nearestStartUtc = nearest ? nearest.start.toISOString() : null;

    if (nearest && nearest.start.getTime() - now.getTime() > site.stopHoursBefore * HOUR_MS) {
      if (!project) {
        actions.push(
          cityAction(
            {
              city: group.city,
              name: site.nameTemplate.replaceAll('%город%', nearest.concert.city),
              keywords: renderKeywords(site.keywordTemplates, {
                gorod: nearest.concert.city,
                vGorode: nearest.concert.cityIn,
              }),
              reason: 'future_concert_no_project',
              nearestStartUtc,
            },
            'create',
            group.region,
            null,
          ),
        );
        actions.push(
          cityAction(
            { city: group.city, reason: 'project_created_needs_start', nearestStartUtc },
            'start',
            group.region,
            null,
          ),
        );
      } else if (!project.active) {
        actions.push(
          cityAction(
            { city: group.city, reason: 'future_concert_project_inactive', nearestStartUtc },
            'start',
            group.region,
            project.id,
          ),
        );
      }
    } else if (project?.active) {
      actions.push(
        cityAction(
          {
            city: group.city,
            reason: nearest ? 'concert_within_stop_window' : 'no_future_concert',
            nearestStartUtc,
          },
          'stop',
          group.region,
          project.id,
        ),
      );
    }
  }

  for (const project of projects) {
    if (project.domain !== site.domain || !project.active || coveredRegions.has(project.region)) {
      continue;
    }
    actions.push(
      cityAction(
        {
          city: cityByRegion(project.region) ?? project.name,
          reason: 'no_future_concert',
          nearestStartUtc: null,
        },
        'stop',
        project.region,
        project.id,
      ),
    );
  }

  return actions;
}
