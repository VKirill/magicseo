type RpcRequest = { pluginId: string; method: string; input: unknown };

type EnvValueResponse = {
  access?: { username?: unknown; password?: unknown } | null;
};

/**
 * Reads the MagicSEO cabinet login from Env Catalog over RPC (D7): the value
 * never touches KV, files, logs or the UI, only the client's memory.
 */
export async function loadLogin(
  callRpc: (req: RpcRequest) => Promise<unknown>,
  name: string,
): Promise<{ username: string; password: string }> {
  const res = (await callRpc({
    pluginId: 'env-catalog',
    method: 'env_get_value',
    input: { name },
  })) as EnvValueResponse | null;
  const access = res && typeof res === 'object' ? res.access : undefined;
  const username = access && typeof access === 'object' ? access.username : undefined;
  const password = access && typeof access === 'object' ? access.password : undefined;
  if (typeof username !== 'string' || username === '' || typeof password !== 'string' || password === '') {
    throw new Error(
      `env-catalog: '${name}' has no username/password access; add the MagicSEO login to Env Catalog`,
    );
  }
  return { username, password };
}
