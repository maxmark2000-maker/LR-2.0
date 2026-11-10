import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { verifyGateToken } from '../../shared/cubeAuth.ts';
import { runEntityOp, publicRefereeResult } from '../../shared/cubeData.ts';

const ENTITIES = [
  'Competition', 'Round', 'Race', 'Athlete', 'Call',
  'Referee', 'ScheduleEntry', 'LiveRace', 'DecisionRevision', 'AuditLog',
];

// The single data gateway for ORGACube. Only reachable with a valid ORGACube
// gate token, so the underlying entities can stay closed to direct access.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    if (!(await verifyGateToken('orga', String(body?.token || '')))) {
      return Response.json({ error: 'ORGACube session expired. Please unlock again.' }, { status: 401 });
    }

    const entity = String(body?.entity || '');
    if (!ENTITIES.includes(entity)) return Response.json({ error: 'Unknown entity' }, { status: 400 });

    const op = String(body?.op || '');
    let client = base44.asServiceRole;
    // Admins already have entity access under RLS. Use their own read budget,
    // rather than making competition administration compete with every live poll.
    if (['get', 'list', 'filter', 'count'].includes(op) && req.headers.get('authorization')) {
      const user = await base44.auth.me().catch((error) => {
        if (error.status === 401 || error.status === 403) return null;
        throw error;
      });
      if (user?.role === 'admin') client = base44;
    }
    const repo = client.entities[entity];
    const args = Array.isArray(body?.args) ? body.args : [];
    // Referee credentials are only ever updated through refereeCreate/refereeUpdate.
    // Prevent arbitrary field writes via the generic ORGACube entity gateway.
    if (entity === 'Referee' && !['list', 'get', 'filter', 'count', 'update', 'delete'].includes(op)) {
      return Response.json({ error: 'Use Referee management functions' }, { status: 403 });
    }
    if (entity === 'Referee' && op === 'update') {
      const changes = args[1] || {};
      const allowed = ['assignedCompetitionIds', 'assignedGenderGroups', 'active', 'loginConfirmed'];
      if (!changes || typeof changes !== 'object' || Object.keys(changes).some((key) => !allowed.includes(key))) {
        return Response.json({ error: 'Use refereeUpdate for account details' }, { status: 403 });
      }
    }
    const result = await runEntityOp(repo, op, args);
    return Response.json({ result: entity === 'Referee' ? publicRefereeResult(result) : result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status === 429 ? 429 : 500 });
  }
}