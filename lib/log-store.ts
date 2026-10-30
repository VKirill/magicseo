export type KvLike = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
};

/** Appends an entry to a KV log and keeps at most `max` last entries. */
export async function appendLog(kv: KvLike, key: string, entry: object, max: number): Promise<void> {
  const current = await kv.get(key);
  const list = Array.isArray(current) ? current : [];
  await kv.set(key, [...list, entry].slice(-max));
}

/** Reads the whole stored log; a missing or non-array value is an empty log. */
export async function readLog(kv: KvLike, key: string): Promise<object[]> {
  const value = await kv.get(key);
  return Array.isArray(value) ? (value as object[]) : [];
}
