import citiesJson from './cities.json' with { type: 'json' };

type CityRow = { name: string; region: number | null; timeZone: string };

const rows = (citiesJson as { cities: CityRow[] }).cities;
const byName = new Map<string, CityRow>(rows.map((c) => [c.name, c]));
const byRegion = new Map<number, string>(
  rows.filter((c) => c.region !== null).map((c) => [c.region as number, c.name]),
);

export type ResolvedCity = { name: string; region: number; timeZone: string };

export function resolveCity(
  name: string,
  opts?: {
    aliases?: Record<string, string>;
    regionOverrides?: Record<string, number>;
    timeZoneOverrides?: Record<string, string>;
  },
): ResolvedCity | null {
  const canonical = opts?.aliases?.[name] ?? name;
  const row = byName.get(canonical);
  if (!row) return null;
  const region = opts?.regionOverrides?.[canonical] ?? row.region;
  if (region === null || region === undefined) return null;
  return { name: canonical, region, timeZone: opts?.timeZoneOverrides?.[canonical] ?? row.timeZone };
}

export function cityByRegion(region: number): string | null {
  return byRegion.get(region) ?? null;
}

const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

function localMsAt(timeZone: string, utcMs: number): number {
  let df = zoneFormatters.get(timeZone);
  if (!df) {
    df = new Intl.DateTimeFormat('en', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    zoneFormatters.set(timeZone, df);
  }
  const p: Record<string, string> = {};
  for (const part of df.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}

export function concertStartUtc(c: { date: string; time: string }, timeZone: string): Date {
  const [y, mo, d] = c.date.split('-').map(Number);
  const [h, mi] = c.time.split(':').map(Number);
  const want = Date.UTC(y, mo - 1, d, h, mi, 0);
  let utc = want;
  for (let i = 0; i < 3 && localMsAt(timeZone, utc) !== want; i++) {
    utc += want - localMsAt(timeZone, utc);
  }
  return new Date(utc);
}
