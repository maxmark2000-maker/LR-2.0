// Shared entity access used by the gated cube data functions. The functions run
// with the service role (bypassing row-level security), so every call here must
// already have passed a gate-token check in the calling function.

const PAGE_SHAPED = new Set(['list', 'filter']);

// A caller's limit is a page size, not a cap on how many records a competition
// may hold: without paging a report silently stops at the first page of calls.
const MAX_RECORDS = 5000;

export async function runEntityOp(repo: any, op: string, args: any[] = []): Promise<any> {
  let result: any;
  switch (op) {
    case 'list': result = await repo.list(...args); break;
    case 'filter': result = await repo.filter(...args); break;
    case 'get': result = await repo.get(args[0]); break;
    case 'create': result = await repo.create(args[0]); break;
    case 'update': result = await repo.update(args[0], args[1]); break;
    case 'updateMany': result = await repo.updateMany(args[0], args[1]); break;
    case 'delete': result = await repo.delete(args[0]); break;
    case 'bulkCreate': result = await repo.bulkCreate(args[0]); break;
    case 'bulkUpdate': result = await repo.bulkUpdate(args[0]); break;
    case 'deleteMany': result = await repo.deleteMany(args[0]); break;
    case 'count': result = await repo.count(args[0]); break;
    default: throw new Error('Unknown operation: ' + op);
  }
  // Some SDK versions answer list/filter with a page object; the cubes expect a
  // plain array of records.
  if (PAGE_SHAPED.has(op) && result && !Array.isArray(result) && Array.isArray(result.items)) {
    return result.items;
  }
  return result;
}

// Reads a whole collection in pages instead of cutting it at the caller's limit.
export async function readEntityPages(repo: any, args: any[] = []): Promise<any[]> {
  const [query, sort, limit, skip, fields] = args;
  const pageSize = Math.min(Number(limit) || 500, 500);
  const records: any[] = [];
  for (let offset = Number(skip) || 0; offset < MAX_RECORDS; offset += pageSize) {
    const page = await runEntityOp(repo, 'filter', [query, sort, pageSize, offset, fields]);
    if (!Array.isArray(page) || !page.length) break;
    records.push(...page);
    if (page.length < pageSize) break;
  }
  return records;
}