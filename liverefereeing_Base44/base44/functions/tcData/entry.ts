import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyGateToken } from '../../shared/cubeAuth.ts';
import { runEntityOp, readEntityPages } from '../../shared/cubeData.ts';
import { cachedCubeRead, forgetCubeReads } from '../../shared/cubeReadCache.ts';

const READ_ENTITIES = [
  'Competition', 'Round', 'Race', 'Athlete', 'Call',
  'Referee', 'ScheduleEntry', 'LiveRace', 'DecisionRevision',
  'RefereeRaceFlag',
];

// TCCube may change a race (flag, final decision, scoring marks) and record a
// decision revision — nothing else is writable through this gateway.
const WRITE_ALLOWED: Record<string, string[]> = {
  Race: ['update'],
  DecisionRevision: ['create'],
};

const WRITE_OPS = new Set(['create', 'update', 'delete', 'bulkCreate', 'bulkUpdate', 'deleteMany', 'updateMany']);

// TCCube reads whole competitions — every race, the roster and every call. Served
// for a few seconds from memory, a tablet switching competitions, or a second one
// opening the same one, no longer re-reads all of it from the service-role budget
// that the live referees depend on. The LIVE jump is never cached, and a TC write
// clears everything.
const READ_OPS = ['list', 'filter'];
const cachedRead = (entity: string, op: string, args: any[]) =>
  entity !== 'LiveRace' && READ_OPS.includes(op) &&
  (args?.[2] === undefined || Number(args[2]) >= 200);

// The single data gateway for TCCube. Only reachable with a valid TCCube gate
// token, so the underlying entities can stay closed to direct access.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    if (!(await verifyGateToken('tc', String(body?.token || '')))) {
      return Response.json({ error: 'TCCube session expired. Please unlock again.' }, { status: 401 });
    }

    const entity = String(body?.entity || '');
    const op = String(body?.op || '');
    if (!READ_ENTITIES.includes(entity)) return Response.json({ error: 'Unknown entity' }, { status: 400 });
    if (WRITE_OPS.has(op) && !(WRITE_ALLOWED[entity] || []).includes(op)) {
      return Response.json({ error: 'Operation not allowed for TCCube' }, { status: 403 });
    }

    const args = Array.isArray(body?.args) ? body.args : [];
    const repo = base44.asServiceRole.entities[entity];

    if (cachedRead(entity, op, args)) {
      const key = `${entity}|${op}|${JSON.stringify(args)}`;
      // A limit of 500 is a page size here, not the number of calls a competition
      // may hold — paging keeps the report complete.
      const read = () => (Number(args[2]) >= 500
        ? readEntityPages(repo, args)
        : runEntityOp(repo, op, args));
      const result = await cachedCubeRead(key, read, { force: body?.fresh === true });
      return Response.json({ result });
    }

    const result = await runEntityOp(repo, op, args);
    if (WRITE_OPS.has(op)) forgetCubeReads();
    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}