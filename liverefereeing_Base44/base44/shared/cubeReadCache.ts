// Short-lived cache for the gated cube gateways. Both cubes read through a
// service-role function, so every caller shares ONE backend read budget with the
// referees. A tablet switching competitions, or a second one opening the same
// competition, used to re-read the whole competition (races, rosters, every call)
// each time and ate that budget out of the live call sheets.
const reads = new Map<string, { expires: number; promise: Promise<any>; value: any }>();
const MAX_ENTRIES = 64;
// A TC change clears the cache, so the TTL only decides how long an unchanged
// competition may be served from memory.
const TTL_MS = 20000;

export async function cachedCubeRead(
  key: string,
  load: () => Promise<any>,
  { ttlMs = TTL_MS, force = false }: { ttlMs?: number; force?: boolean } = {}
): Promise<any> {
  const existing = reads.get(key);
  if (!force && existing && existing.expires > Date.now()) return await existing.promise;
  // An exhausted budget must not empty the report: the last snapshot is served.
  const previous = existing?.value;
  const entry: { expires: number; promise: Promise<any>; value: any } = { expires: Infinity, promise: null as any, value: previous };
  entry.promise = Promise.resolve().then(load).then((value) => {
    entry.value = value;
    entry.expires = Date.now() + ttlMs;
    return value;
  }, (error) => {
    const status = error?.status || error?.response?.status;
    if (previous !== undefined && (status === 429 || status === 500 || status === 503)) {
      entry.expires = Date.now() + 10000;
      return previous;
    }
    if (reads.get(key) === entry) reads.delete(key);
    throw error;
  });
  if (reads.size >= MAX_ENTRIES) reads.delete(reads.keys().next().value as string);
  reads.set(key, entry);
  return await entry.promise;
}

// Any write through the gateway drops every snapshot: what the TC just changed
// must be visible on the next read, not 20 seconds later.
export function forgetCubeReads() {
  reads.clear();
}