/** Deep-copies a value into JSON-safe shape: object fields that are undefined are dropped. */
export function toJson<T>(value: T): T {
  return copy(value) as T;
}

function copy(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(copy);
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    if (field === undefined) continue;
    out[key] = copy(field);
  }
  return out;
}
