import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyToken } from '../../shared/refereeAuth.ts';
import { forgetWorkspaceRead } from '../../shared/workspaceReads.ts';
import { raceCallKey } from '../../shared/refereeSheets.ts';

const VALID_CODES = ['S1','S2','S3','S4','S5','S6','S7','S8','S9','C1','C2','C3','C4','C5','F1','F2','F3','F4','F5','F6','ST1','ST2','ST3','ST4','ST5','ST6','SR','YC-B','YC-LAP','RC','ADV','ADV Final','ADV Final-B','DNF','NT','NO CALL','OFF','ASS','EMB'];

// A referee has at most one call per race + athlete + mark. This key is what
// makes a re-sent call (retry after a dropped response, or a correction) update
// the existing record instead of creating a duplicate.
const keyOf = (c) => `${c.raceId}|${c.athleteId || ''}|${c.mark || ''}`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const referee = await verifyToken(base44, body.refereeId, body.token);
    if (!referee) return Response.json({ error: 'Invalid referee session' }, { status: 401 });

    const incoming = Array.isArray(body.calls) ? body.calls.slice(0, 200) : [];
    if (incoming.length === 0) return Response.json({ error: 'No calls submitted' }, { status: 400 });

    // Validate codes and de-duplicate the batch itself (last entry per key wins).
    const valid = new Map();
    for (const item of incoming) {
      if (!item.raceId) continue;
      if (!VALID_CODES.includes(item.callCode)) continue;
      valid.set(keyOf(item), item);
    }
    if (valid.size === 0) return Response.json({ created: 0, updated: 0, processed: 0, calls: [] });

    // Fetch each involved race ONCE. Previously this was a Race.get() per call —
    // a full call sheet meant dozens of sequential round-trips and was a common
    // cause of submit timeouts.
    const raceIds = Array.from(new Set(Array.from(valid.values()).map((c) => c.raceId)));
    const raceResults = await Promise.all(
      raceIds.map((id) => base44.asServiceRole.entities.Race.get(id).catch(() => null))
    );
    const raceById = {};
    raceResults.forEach((r) => { if (r) raceById[r.id] = r; });

    // Existing calls for these races by this referee — used to update instead of
    // creating a duplicate. Matches by content so it also cleans up retries of
    // calls that were stored before.
    const existing = await base44.asServiceRole.entities.Call.filter(
      { refereeId: referee.id, raceId: { $in: raceIds } },
      '-timestamp',
      1000
    );
    const existingByKey = {};
    (Array.isArray(existing) ? existing : []).forEach((c) => {
      existingByKey[`${c.raceId}|${c.athleteId || ''}|${c.mark || ''}`] = c;
    });

    const toCreate = [];
    const toUpdate = [];
    // Every call the server refuses is reported back with its reason, so the
    // referee is told what actually happened instead of a blanket "race closed".
    const rejected = { closed: 0, notAssigned: 0, unknownRace: 0 };
    for (const [key, item] of valid) {
      const race = raceById[item.raceId];
      if (!race) { rejected.unknownRace += 1; continue; }
      if (!(referee.assignedCompetitionIds || []).includes(race.competitionId)) { rejected.notAssigned += 1; continue; }
      if (race.isClosed) { rejected.closed += 1; continue; }

      const payload = {
        competitionId: race.competitionId,
        raceId: race.id,
        roundId: race.roundId,
        genderGroup: race.genderGroup,
        refereeId: referee.id,
        refereeName: referee.displayName,
        refereeFunction: ['TC', 'APPR'].includes(referee.function) ? referee.function : '',
        callCode: item.callCode,
        mark: (item.mark || '').toString().slice(0, 10),
        athleteId: (item.athleteId || '').toString().slice(0, 60),
        helmetNumber: (item.helmetNumber || '').toString().slice(0, 10),
        notes: (item.notes || '').toString().slice(0, 500),
        timestamp: item.timestamp || new Date().toISOString()
      };

      const prev = existingByKey[key];
      if (prev) toUpdate.push({ id: prev.id, ...payload });
      else toCreate.push(payload);
    }

    const created = toCreate.length ? await base44.asServiceRole.entities.Call.bulkCreate(toCreate) : [];
    const updated = toUpdate.length ? await base44.asServiceRole.entities.Call.bulkUpdate(toUpdate) : [];

    // The shared per-race call snapshot must never hide a call that was just
    // submitted, so the referee reads their own entry back immediately.
    raceIds.forEach((id) => forgetWorkspaceRead(raceCallKey(id)));

    const rejectedCount = rejected.closed + rejected.notAssigned + rejected.unknownRace;
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'CALLS_SUBMITTED',
      actorName: referee.displayName,
      actorRole: 'REFEREE',
      details: `${created.length} created, ${updated.length} updated` +
        (rejectedCount ? `, ${rejectedCount} rejected (${rejected.closed} closed, ${rejected.notAssigned} not assigned, ${rejected.unknownRace} unknown race)` : ''),
      timestamp: new Date().toISOString()
    });

    return Response.json({
      created: created.length,
      updated: updated.length,
      processed: created.length + updated.length,
      rejected,
      calls: [...created, ...updated]
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}