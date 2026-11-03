import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { verifyGateToken } from '../../shared/cubeAuth.ts';
import { readEntityPages } from '../../shared/cubeData.ts';
import { readRefereeList } from '../../shared/refereeAuth.ts';

// Referee participation per competition, for the ORGACube participant list:
// how many calls each referee submitted, in how many races, and who is
// registered but never called. Counted server-side, because a competition holds
// more calls than one gateway page can return.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    if (!(await verifyGateToken('orga', String(body?.token || '')))) {
      return Response.json({ error: 'ORGACube session expired. Please unlock again.' }, { status: 401 });
    }

    const competitionId = String(body?.competitionId || '');
    if (!competitionId) return Response.json({ error: 'Competition is required' }, { status: 400 });

    const calls = await readEntityPages(base44.asServiceRole.entities.Call, [{ competitionId }, '-timestamp', 500]);
    const referees = await readRefereeList(base44);

    const perReferee = new Map();
    for (const call of calls) {
      const key = call.refereeId || `name:${call.refereeName || 'Unknown'}`;
      let entry = perReferee.get(key);
      if (!entry) {
        entry = { calls: 0, raceIds: new Set(), lastCall: null, name: call.refereeName || '', fn: '' };
        perReferee.set(key, entry);
      }
      entry.calls += 1;
      if (call.raceId) entry.raceIds.add(call.raceId);
      if (call.timestamp && (!entry.lastCall || call.timestamp > entry.lastCall)) entry.lastCall = call.timestamp;
      if (call.refereeName) entry.name = call.refereeName;
      if (call.refereeFunction) entry.fn = call.refereeFunction;
    }

    const rows = [];
    const covered = new Set();

    for (const referee of referees) {
      const assigned = (referee.assignedCompetitionIds || []).includes(competitionId);
      const stat = perReferee.get(referee.id);
      if (!assigned && !stat) continue;
      covered.add(referee.id);
      rows.push({
        refereeId: referee.id,
        name: referee.displayName || referee.username || 'Referee',
        username: referee.username || '',
        country: referee.country || '',
        function: referee.function || 'NONE',
        genderGroups: referee.assignedGenderGroups || [],
        assigned,
        calls: stat ? stat.calls : 0,
        races: stat ? stat.raceIds.size : 0,
        lastCall: stat ? stat.lastCall : null,
      });
    }

    // Calls recorded under a referee that no longer exists still count in the total.
    for (const [key, stat] of perReferee) {
      if (!key.startsWith('name:') && covered.has(key)) continue;
      rows.push({
        refereeId: key.startsWith('name:') ? null : key,
        name: stat.name || 'Unknown referee',
        username: '',
        country: '',
        function: stat.fn || 'NONE',
        genderGroups: [],
        assigned: false,
        calls: stat.calls,
        races: stat.raceIds.size,
        lastCall: stat.lastCall,
      });
    }

    rows.sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));

    const registered = rows.filter((row) => row.assigned);
    return Response.json({
      rows,
      totals: {
        registered: registered.length,
        participants: registered.filter((row) => row.calls > 0).length,
        withoutCalls: registered.filter((row) => row.calls === 0).length,
        totalCalls: calls.length,
        racesWithCalls: new Set(calls.map((call) => call.raceId).filter(Boolean)).size,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status === 429 ? 429 : 500 });
  }
}