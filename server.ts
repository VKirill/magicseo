import { defineRpcContract, type BbPluginApi } from '@get-bb/plugin-sdk';
import { z } from 'zod';
import { MagicSeoClient } from './lib/magicseo/client.ts';
import { startPromotion, stopPromotion } from './lib/magicseo/lifecycle.ts';
import type { MutationEntry } from './lib/magicseo/types.ts';
import { DEFAULT_CONFIG, parseConfig, type Config } from './lib/config.ts';
import { loadLogin } from './lib/credentials.ts';
import { buildHierarchy, rowsFromCatalog, type SiteNode } from './lib/hierarchy.ts';
import { toJson } from './lib/json.ts';
import { appendLog, readLog } from './lib/log-store.ts';
import type { PluginContext } from './server/context.ts';
import { automationHandlers, automationRpc, registerAutomation } from './server/automation.ts';
import { positionsHandlers, positionsRpc, registerPositions } from './server/positions.ts';

const MUTATION_LOG_KEY = 'mutation-log';
// BB plugin KV holds at most 256 KiB per key; 500 short entries stay far below it.
const MUTATION_LOG_MAX = 500;
const KEYWORDS_PAGE_LIMIT = 200;

const projectRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  domain: z.string(),
  region: z.number(),
  active: z.boolean(),
  keywords: z.number(),
  periodSpent: z.number(),
  totalSpent: z.number(),
  lastJobStatus: z.number().nullable(),
  city: z.string(),
});

const siteNodeSchema = z.object({
  domain: z.string(),
  configured: z.boolean(),
  projects: z.array(projectRowSchema),
});

const mutationEntrySchema = z.object({
  method: z.string(),
  path: z.string(),
  status: z.number(),
  ok: z.boolean(),
  at: z.string(),
});

const keywordRowSchema = z.object({
  id: z.number(),
  text: z.string(),
  pcPosition: z.number().nullable(),
  mobilePosition: z.number().nullable(),
  foundUrl: z.string().nullable(),
});

const configSchema = z.unknown();

export const rpcContract = defineRpcContract({
  ...automationRpc,
  ...positionsRpc,
  tree: {
    input: z.null(),
    output: z.object({ balanceRub: z.number(), sites: z.array(siteNodeSchema) }),
  },
  project_keywords: {
    input: z.object({ id: z.number() }),
    output: z.object({ keywords: z.array(keywordRowSchema) }),
  },
  project_start: {
    input: z.object({ id: z.number() }),
    output: z.object({ ok: z.boolean() }),
  },
  project_stop: {
    input: z.object({ id: z.number() }),
    output: z.object({ ok: z.boolean() }),
  },
  positions_check: {
    input: z.object({ id: z.number() }),
    output: z.object({ ok: z.boolean() }),
  },
  mutation_log: {
    input: z.null(),
    output: z.object({ entries: z.array(mutationEntrySchema) }),
  },
  config: { input: z.null(), output: configSchema },
  save_config: { input: configSchema, output: configSchema },
});

type CatalogObj = {
  project_info?: { id: number; autolaunch_settings?: { active?: boolean } };
  children?: CatalogObj[];
};

function collectActive(catalog: unknown, active: Record<number, boolean>): void {
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const item = node as CatalogObj;
    if (item.project_info && typeof item.project_info.id === 'number') {
      active[item.project_info.id] = item.project_info.autolaunch_settings?.active ?? false;
    }
    if (Array.isArray(item.children)) for (const child of item.children) walk(child);
  };
  if (Array.isArray(catalog)) for (const item of catalog) walk(item);
  else if (catalog && typeof catalog === 'object' && Array.isArray((catalog as { items?: unknown[] }).items)) {
    for (const item of (catalog as { items: unknown[] }).items) walk(item);
  }
}

export default async function plugin(bb: BbPluginApi) {
  const client = new MagicSeoClient({
    // D7: the login is read through Env Catalog at runtime and kept only in the client's memory.
    credentials: () =>
      loadLogin(
        (req) =>
          bb.sdk.plugins.callRpc({
            pluginId: req.pluginId,
            method: req.method,
            input: req.input as { name: string },
            outputSchema: z.unknown(),
          }),
        'MAGICSEO_LOGIN',
      ),
    onMutation: (e: MutationEntry) => appendLog(bb.storage.kv, MUTATION_LOG_KEY, e, MUTATION_LOG_MAX),
  });

  let cachedConfig: Config | null = null;
  const ctx: PluginContext = {
    bb,
    client,
    getConfig: async () => {
      if (!cachedConfig) {
        const stored = await bb.storage.kv.get('config');
        cachedConfig = stored === undefined || stored === null ? DEFAULT_CONFIG : parseConfig(stored);
      }
      return cachedConfig;
    },
    saveConfig: async (c: Config) => {
      cachedConfig = c;
      await bb.storage.kv.set('config', c);
      return c;
    },
    kv: bb.storage.kv,
  };

  async function tree(): Promise<{ balanceRub: number; sites: SiteNode[] }> {
    const [balance, catalog, config] = await Promise.all([
      client.balance(),
      client.catalogItems(),
      ctx.getConfig(),
    ]);
    const active: Record<number, boolean> = {};
    collectActive(catalog, active);
    return toJson({
      balanceRub: balance.money_balance / 100,
      sites: buildHierarchy(rowsFromCatalog(catalog, active), config.sites.map((s) => s.domain)),
    });
  }

  async function projectKeywords(id: number) {
    const keywords = await client.keywordsV2(id, { offset: 0, limit: KEYWORDS_PAGE_LIMIT });
    return toJson({
      keywords: keywords.map((k) => {
        const last = k.checks?.length ? k.checks[k.checks.length - 1] : undefined;
        return {
          id: k.id,
          text: k.text,
          pcPosition: last?.pc_position ?? null,
          mobilePosition: last?.mobile_position ?? null,
          foundUrl: last?.found_url ?? null,
        };
      }),
    });
  }

  bb.rpc.register(rpcContract, {
    ...automationHandlers(ctx),
    ...positionsHandlers(ctx),
    tree: () => tree(),
    project_keywords: ({ id }) => projectKeywords(id),
    project_start: async ({ id }) => {
      await startPromotion(client, id);
      return toJson({ ok: true });
    },
    project_stop: async ({ id }) => {
      await stopPromotion(client, id);
      return toJson({ ok: true });
    },
    positions_check: async ({ id }) => {
      await client.startPositionsJob(id);
      return toJson({ ok: true });
    },
    mutation_log: async () =>
      toJson({
        entries: (await readLog(bb.storage.kv, MUTATION_LOG_KEY)) as MutationEntry[],
      }),
    config: async () => toJson(await ctx.getConfig()),
    save_config: async (raw) => toJson(await ctx.saveConfig(parseConfig(raw))),
  });

  registerAutomation(ctx);
  registerPositions(ctx);
}
