export type SiteConfig = {
  id: string;
  domain: string;
  concerts: { baseUrl: string; postType: string; credentialName: string | null };
  nameTemplate: string;
  keywordTemplates: string[];
  cityAliases: Record<string, string>;
  regionOverrides: Record<string, number>;
  timeZoneOverrides: Record<string, string>;
  mode: 'off' | 'dry-run' | 'live';
  stopHoursBefore: number;
  newProject: {
    provider: string;
    device: number;
    parentFolderId: number | null;
    autolaunch: Record<string, unknown> | null;
  } | null;
};

export type Config = {
  sites: SiteConfig[];
  automationIntervalMinutes: number;
  positionsIntervalHours: number;
};

const STOP_HOURS_BEFORE = 48;
const WP_CREDENTIAL_NAME = 'ATMOSPHERE_WP_APP';

const CONFIG_KEYS = new Set(['sites', 'automationIntervalMinutes', 'positionsIntervalHours']);
const SITE_KEYS = new Set([
  'id',
  'domain',
  'concerts',
  'nameTemplate',
  'keywordTemplates',
  'cityAliases',
  'regionOverrides',
  'timeZoneOverrides',
  'mode',
  'stopHoursBefore',
  'newProject',
]);
const CONCERTS_KEYS = new Set(['baseUrl', 'postType', 'credentialName']);
const NEW_PROJECT_KEYS = new Set(['provider', 'device', 'parentFolderId', 'autolaunch']);
const SECRET_KEY = /password|passwd|secret|token|credential|api[-_]?key|bearer|jwt|basic[-_]?auth|username|login/i;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkKeys(o: Obj, allowed: Set<string>, path: string): void {
  for (const k of Object.keys(o)) {
    if (!allowed.has(k)) throw new Error(`config: unknown key '${k}' at ${path}`);
    if (k !== 'credentialName' && SECRET_KEY.test(k)) {
      throw new Error(`config: credential field '${k}' is not allowed at ${path}`);
    }
  }
}

function reqString(v: unknown, path: string): string {
  if (typeof v !== 'string' || v === '') throw new Error(`config: ${path} must be a non-empty string`);
  return v;
}

function strOr(v: unknown, path: string, dflt: string): string {
  return v === undefined ? dflt : reqString(v, path);
}

function strArray(v: unknown, path: string, dflt: string[]): string[] {
  if (v === undefined) return [...dflt];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x === '')) {
    throw new Error(`config: ${path} must be an array of non-empty strings`);
  }
  return [...v];
}

function strRecord(v: unknown, path: string, dflt: Record<string, string>): Record<string, string> {
  if (v === undefined) return { ...dflt };
  if (!isObj(v) || Object.values(v).some((x) => typeof x !== 'string')) {
    throw new Error(`config: ${path} must be a string record`);
  }
  return { ...(v as Record<string, string>) };
}

function numRecord(v: unknown, path: string, dflt: Record<string, number>): Record<string, number> {
  if (v === undefined) return { ...dflt };
  if (!isObj(v) || Object.values(v).some((x) => !Number.isInteger(x))) {
    throw new Error(`config: ${path} must be an integer record`);
  }
  return { ...(v as Record<string, number>) };
}

function intOr(v: unknown, path: string, dflt: number): number {
  if (v === undefined) return dflt;
  if (!Number.isInteger(v) || (v as number) < 1) {
    throw new Error(`config: ${path} must be a positive integer`);
  }
  return v as number;
}

function parseConcerts(raw: unknown, path: string): SiteConfig['concerts'] {
  if (!isObj(raw)) throw new Error(`config: ${path} must be an object`);
  checkKeys(raw, CONCERTS_KEYS, path);
  const credentialName = raw.credentialName ?? null;
  if (credentialName !== null && credentialName !== WP_CREDENTIAL_NAME) {
    throw new Error(`config: ${path}.credentialName must be null or '${WP_CREDENTIAL_NAME}'`);
  }
  return {
    baseUrl: reqString(raw.baseUrl, `${path}.baseUrl`),
    postType: strOr(raw.postType, `${path}.postType`, 'concerts'),
    credentialName,
  };
}

function parseNewProject(raw: unknown, path: string): SiteConfig['newProject'] {
  if (raw === undefined || raw === null) return null;
  if (!isObj(raw)) throw new Error(`config: ${path} must be an object or null`);
  checkKeys(raw, NEW_PROJECT_KEYS, path);
  const parentFolderId = raw.parentFolderId ?? null;
  if (parentFolderId !== null && !Number.isInteger(parentFolderId)) {
    throw new Error(`config: ${path}.parentFolderId must be an integer or null`);
  }
  const autolaunch = raw.autolaunch ?? null;
  if (autolaunch !== null && !isObj(autolaunch)) {
    throw new Error(`config: ${path}.autolaunch must be an object or null`);
  }
  if (!Number.isInteger(raw.device)) throw new Error(`config: ${path}.device must be an integer`);
  return {
    provider: reqString(raw.provider, `${path}.provider`),
    device: raw.device as number,
    parentFolderId: parentFolderId as number | null,
    autolaunch: autolaunch as Record<string, unknown> | null,
  };
}

function parseSite(raw: unknown, index: number): SiteConfig {
  const path = `config.sites[${index}]`;
  if (!isObj(raw)) throw new Error(`config: ${path} must be an object`);
  checkKeys(raw, SITE_KEYS, path);
  const id = reqString(raw.id, `${path}.id`);
  const domain = reqString(raw.domain, `${path}.domain`);
  if (raw.mode !== undefined && raw.mode !== 'off' && raw.mode !== 'dry-run' && raw.mode !== 'live') {
    throw new Error(`config: ${path}.mode must be 'off', 'dry-run' or 'live'`);
  }
  if (raw.stopHoursBefore !== undefined && raw.stopHoursBefore !== STOP_HOURS_BEFORE) {
    throw new Error(`config: ${path}.stopHoursBefore is fixed at ${STOP_HOURS_BEFORE}`);
  }
  return {
    id,
    domain,
    concerts: parseConcerts(raw.concerts, `${path}.concerts`),
    nameTemplate: strOr(raw.nameTemplate, `${path}.nameTemplate`, `[%город%] ${domain.toUpperCase()}`),
    keywordTemplates: strArray(raw.keywordTemplates, `${path}.keywordTemplates`, [
      'оркестр при свечах %город%',
      '3000 свечей %город%',
    ]),
    cityAliases: strRecord(raw.cityAliases, `${path}.cityAliases`, { 'СПб': 'Санкт-Петербург' }),
    regionOverrides: numRecord(raw.regionOverrides, `${path}.regionOverrides`, {}),
    timeZoneOverrides: strRecord(raw.timeZoneOverrides, `${path}.timeZoneOverrides`, {}),
    mode: (raw.mode ?? 'dry-run') as SiteConfig['mode'],
    stopHoursBefore: STOP_HOURS_BEFORE,
    newProject: parseNewProject(raw.newProject, `${path}.newProject`),
  };
}

export function parseConfig(raw: unknown): Config {
  const input = raw === undefined || raw === null ? {} : raw;
  if (!isObj(input)) throw new Error('config: expected an object');
  checkKeys(input, CONFIG_KEYS, 'config');
  const sitesRaw = input.sites ?? [
    { id: 'atmosphere-show', domain: 'atmosphere-show.ru', concerts: { baseUrl: 'https://atmosphere-show.ru' } },
  ];
  if (!Array.isArray(sitesRaw)) throw new Error('config: sites must be an array');
  return {
    sites: sitesRaw.map(parseSite),
    automationIntervalMinutes: intOr(input.automationIntervalMinutes, 'config.automationIntervalMinutes', 1),
    positionsIntervalHours: intOr(input.positionsIntervalHours, 'config.positionsIntervalHours', 6),
  };
}

export const DEFAULT_CONFIG: Config = parseConfig({});
