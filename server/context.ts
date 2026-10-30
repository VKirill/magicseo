import type { BbPluginApi } from '@get-bb/plugin-sdk';
import type { MagicSeoClient } from '../lib/magicseo/client.ts';
import type { Config } from '../lib/config.ts';

export type PluginContext = {
  bb: BbPluginApi;
  client: MagicSeoClient;
  getConfig(): Promise<Config>;
  saveConfig(c: Config): Promise<Config>;
  kv: BbPluginApi['storage']['kv'];
};
