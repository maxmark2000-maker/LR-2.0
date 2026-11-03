// Only server-side shared competition data is cached. Callers still authenticate
// each request and must restrict the returned payload to the verified referee.
const reads = new Map();
const TTL_MS = 5000;

export async function cachedWorkspaceRead(key, load, ttlMs = TTL_MS) {
  const existing = reads.get(key);
  if (existing && existing.expires > Date.now()) return await existing.promise;
  // A throttled refresh must never take a call sheet down: the last known
  // snapshot is served instead, so referees keep seeing their sheet.
  const previous = existing?.value;
  const entry = { expires: Infinity, promise: null, value: previous };
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
  if (reads.size >= 64) reads.delete(reads.keys().next().value);
  reads.set(key, entry);
  return await entry.promise;
}

// The load test clears the cache first so a round measures the cold path, when
// everybody opens a sheet at the same moment without warm shared data.
export function forgetWorkspaceReads() {
  reads.clear();
}

// Drop one cached snapshot. A referee who just submitted calls must read their
// own race fresh, whatever the shared cache still holds for other referees.
export function forgetWorkspaceRead(key) {
  reads.delete(key);
}

// Legacy SDK paging is explicit: never silently truncate a race's calls.
// A referee opening a call sheet must not fail because the shared backend budget
// is momentarily exhausted by a burst of colleagues loading theirs: wait the
// announced time and ask once more, never in a loop.
export async function readWorkspacePages(repo, query, fields = undefined) {
  const records = [];
  const pageSize = 500;
  for (let skip = 0; ; skip += pageSize) {
    let page;
    try {
      page = await repo.filter(query, '-created_date', pageSize, skip, fields);
    } catch (error) {
      if ((error.status || error.response?.status) !== 429) throw error;
      const message = String(error.response?.data?.error || error.message || '');
      const waitSeconds = Math.min(5, Number(message.match(/Retry after (\d+)s/i)?.[1]) || 1);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000 + 250));
      page = await repo.filter(query, '-created_date', pageSize, skip, fields);
    }
    records.push(...page);
    if (page.length < pageSize) return records;
  }
}