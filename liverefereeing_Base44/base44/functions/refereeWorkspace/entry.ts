import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyToken } from '../../shared/refereeAuth.ts';
import { cachedWorkspaceRead, readWorkspacePages } from '../../shared/workspaceReads.ts';
import { readRefereeSheet, readRefereeStatus } from '../../shared/refereeSheets.ts';

// Personal review flags accept MM:SS and HH:MM:SS only; anything else is refused
// so a malformed position never ends up in the review metadata.
const MMSS = /^\d{1,3}:[0-5]\d$/;
const HHMMSS = /^\d{1,2}:[0-5]\d:[0-5]\d$/;

function cleanTimestamp(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (!MMSS.test(raw) && !HHMMSS.test(raw)) return null;
  const parts = raw.split(':').map((p) => String(Number(p)));
  if (parts.length === 2) return `${parts[0]}:${String(Number(parts[1])).padStart(2, '0')}`;
  return `${parts[0]}:${String(Number(parts[1])).padStart(2, '0')}:${String(Number(parts[2])).padStart(2, '0')}`;
}

// Returns the competitions / rounds / races / athletes a referee may see,
// plus that referee's own calls. Never returns other referees' calls.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    // Stagger status refreshes before any entity read. This also protects older
    // published clients still polling every 15s; opening/sending calls is exempt.
    if (body.mode === 'status' && typeof body.refereeId === 'string') {
      const windowMs = 15000;
      const now = Date.now();
      const slot = [...body.refereeId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
      const phase = Math.floor(now / windowMs) % 4;
      if (phase !== slot) {
        const retryAfterSeconds = Math.ceil((((slot - phase + 4) % 4) * windowMs - (now % windowMs)) / 1000);
        return Response.json({ error: 'Status refresh deferred to keep call sheets available.', retryAfterSeconds }, {
          status: 429, headers: { 'Retry-After': String(retryAfterSeconds) },
        });
      }
    }
    const referee = await verifyToken(base44, body.refereeId, body.token);
    if (!referee) return Response.json({ error: 'Invalid referee session' }, { status: 401 });
    if (['catalog', 'selection', 'sheet'].includes(body.mode)) {
      return await readRefereeSheet(base44, referee, body);
    }
    if (body.mode === 'status') return await readRefereeStatus(base44, referee, body);

    const ids = referee.assignedCompetitionIds || [];
    const competitionId = body.competitionId;

    // The competition records are only returned by the full workspace load. The
    // live/status polls and the flag actions never use them, so fetching them
    // there was pure overhead that dominated every poll once many referees were
    // online.
    let competitions = [];
    if (!body.mode && !body.action) {
      // Fetch all assigned competitions in parallel instead of sequentially — a
      // referee with several assignments used to wait for each Competition.get()
      // one after another, which dominated load time.
      const compResults = await Promise.all(
        ids.slice(0, 50).map((id) => base44.asServiceRole.entities.Competition.get(id).catch(() => null))
      );
      competitions = compResults.filter(Boolean);
    }

    // Flag / unflag / re-timestamp a race for the referee's own review. One record
    // per referee and race; unflagging deletes it. Calls, scoring, the Final
    // Decision and the official TC flag are never touched here.
    if (body.action === 'setFlag') {
      const race = await base44.asServiceRole.entities.Race.get(body.raceId).catch(() => null);
      if (!race || !ids.includes(race.competitionId)) {
        return Response.json({ error: 'Race not found for this referee' }, { status: 404 });
      }
      const [existing] = await base44.asServiceRole.entities.RefereeRaceFlag.filter({
        refereeId: referee.id,
        raceId: race.id,
      });

      if (body.flagged === false) {
        if (existing) await base44.asServiceRole.entities.RefereeRaceFlag.delete(existing.id);
        return Response.json({ flag: null });
      }

      const timestamp = cleanTimestamp(body.videoTimestamp);
      if (timestamp === null) {
        return Response.json({ error: 'Invalid video timestamp' }, { status: 400 });
      }

      const patch = {
        raceId: race.id,
        refereeId: referee.id,
        refereeName: referee.displayName,
        competitionId: race.competitionId,
        roundId: race.roundId,
        raceNumber: race.raceNumber,
        flagged: true,
        videoTimestamp: timestamp,
        updatedAt: new Date().toISOString(),
      };
      const flag = existing
        ? await base44.asServiceRole.entities.RefereeRaceFlag.update(existing.id, patch)
        : await base44.asServiceRole.entities.RefereeRaceFlag.create({ ...patch, flaggedAt: new Date().toISOString() });
      return Response.json({ flag });
    }

    // "My flagged races": this referee's own review flags, enriched with the race,
    // round and competition labels the list shows.
    if (body.mode === 'flags') {
      const flagQuery = {
        refereeId: referee.id, flagged: true,
        competitionId: body.competitionId && ids.includes(body.competitionId) ? body.competitionId : { $in: ids },
      };
      const flags = await base44.asServiceRole.entities.RefereeRaceFlag.filter(flagQuery, '-flaggedAt', 200);
      if (!flags.length) return Response.json({ myFlags: [] });
      const races = await base44.asServiceRole.entities.Race.filter({
        id: { $in: [...new Set(flags.map((flag) => flag.raceId))] }, competitionId: { $in: ids },
      }, '-created_date', 200);
      const raceById = Object.fromEntries(races.map((race) => [race.id, race]));
      const pairs = flags.map((flag) => ({ flag, race: raceById[flag.raceId] })).filter((pair) => pair.race);
      const roundIds = [...new Set(pairs.map((pair) => pair.race.roundId).filter(Boolean))];
      const compIds = [...new Set(pairs.map((pair) => pair.race.competitionId).filter(Boolean))];
      const [roundList, compList] = await Promise.all([
        roundIds.length ? base44.asServiceRole.entities.Round.filter({ id: { $in: roundIds } }, '-created_date', 200) : [],
        compIds.length ? base44.asServiceRole.entities.Competition.filter({ id: { $in: compIds } }, '-created_date', 200) : [],
      ]);
      const roundById = Object.fromEntries(roundList.map((round) => [round.id, round]));
      const compById = Object.fromEntries(compList.map((competition) => [competition.id, competition]));

      const myFlags = pairs.map(({ flag, race }) => {
        const round = roundById[race.roundId];
        const competition = compById[race.competitionId];
        return {
          flagId: flag.id,
          raceId: race.id,
          roundId: race.roundId,
          competitionId: race.competitionId,
          raceNumber: race.raceNumber ?? flag.raceNumber ?? null,
          roundType: round?.type || '',
          distance: round?.distance || '',
          genderGroup: race.genderGroup || round?.genderGroup || '',
          competitionName: competition?.name || '',
          competitionDate: competition?.startDate || '',
          videoTimestamp: flag.videoTimestamp || '',
          flaggedAt: flag.flaggedAt || flag.created_date || '',
          isClosed: !!race.isClosed,
          hasFinalDecision: !!race.finalDecision,
          finalDecisionRevised: !!race.finalDecisionRevised,
        };
      });

      return Response.json({ myFlags });
    }

    // Which race ORGACube has pushed live right now — the referee workspace
    // polls this so a public page never needs direct entity access.
    if (body.mode === 'live') {
      const [live] = await base44.asServiceRole.entities.LiveRace.list('-setAt', 1);
      return Response.json({ liveRace: live || null });
    }

    let rounds = [];
    let races = [];
    let athletes = [];
    let myCalls = [];
    let myFlags = [];
    if (competitionId && ids.includes(competitionId)) {
      // All fetches are independent of each other — run them concurrently.
      [rounds, races, athletes, myCalls, myFlags] = await Promise.all([
        cachedWorkspaceRead(`rounds:${competitionId}`, () => readWorkspacePages(base44.asServiceRole.entities.Round, { competitionId })),
        // The TC's race note is TCCube-internal — never sent to referees.
        cachedWorkspaceRead(`races:${competitionId}`, () => readWorkspacePages(base44.asServiceRole.entities.Race, { competitionId }))
          .then((rs) => (rs || []).map(({ tcNote, ...race }) => race)),
        cachedWorkspaceRead(`athletes:${competitionId}`, () => readWorkspacePages(base44.asServiceRole.entities.Athlete, { competitionId })),
        base44.asServiceRole.entities.Call.filter({ competitionId, refereeId: referee.id }, '-timestamp', 200),
        base44.asServiceRole.entities.RefereeRaceFlag.filter({ competitionId, refereeId: referee.id, flagged: true }),
      ]);
    }

    return Response.json({
      referee: { id: referee.id, displayName: referee.displayName, function: referee.function || 'NONE' },
      allowedGenderGroups: referee.assignedGenderGroups || ['MEN', 'WOMEN'],
      assignedCompetitionIds: ids,
      competitions, rounds, races, athletes, myCalls, myFlags
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: (error.status || error.response?.status) === 429 ? 429 : 500 });
  }
}