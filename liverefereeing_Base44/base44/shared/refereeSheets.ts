import { cachedWorkspaceRead, readWorkspacePages } from './workspaceReads.ts';

// Every referee call runs with the service role, so all referees share ONE
// per-minute read budget. With 30+ referees online, each request must therefore
// read as little as possible: shared competition data is cached and reused, and
// a call sheet reads only its own race.
const competitionFields = ['id', 'name', 'location', 'startDate', 'endDate', 'youtubeUrl', 'status'];
const roundFields = ['id', 'competitionId', 'genderGroup', 'type', 'distance', 'sequence', 'isComplete'];
const raceFields = [
  'id', 'competitionId', 'roundId', 'genderGroup', 'raceNumber', 'athleteIds', 'youtubeUrl',
  'isClosed', 'flagged', 'markCountries', 'finalDecision', 'finalDecisionPrevious', 'finalDecisionRevised',
  'finalDecisionRevisionReason', 'finalDecisionRevisedAt', 'scoringMarks',
];
const athleteFields = ['id', 'competitionId', 'genderGroup', 'firstName', 'lastName', 'country', 'helmetNumber'];

const NAV_TTL = 60000;
const ROSTER_TTL = 180000;
const LIVE_TTL = 15000;
// All referees share ONE read budget of 140 reads per minute. So a status poll
// must not cost one read per referee: the races of a competition are read once
// for everybody and each referee picks their own race out of that snapshot.
const STATUS_TTL = 10000;
// Calls are read for the whole race and shared by everyone on it: at a race start
// every referee opens the same sheet, and one shared read replaces one read per
// referee. Submitting calls clears this key, so a referee always reads back what
// they just sent.
const RACE_CALLS_TTL = 15000;

export const raceCallKey = (raceId: string) => `calls:${raceId}`;

// One extra attempt when the shared read budget is momentarily exhausted, so a
// referee opening a sheet during a burst does not have to retry by hand. The
// announced wait is honoured: retrying too early only burns another read.
const retryThrottled = async (run) => {
  try {
    return await run();
  } catch (error) {
    const status = error?.status || error?.response?.status;
    if (status !== 429) throw error;
    const message = String(error.response?.data?.error || error.message || '');
    const seconds = Math.min(13, Number(message.match(/Retry after (\d+)s/i)?.[1]) || 2);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000 + 250));
    return run();
  }
};

const publicRace = (race) => {
  if (!race) return null;
  const { tcNote, ...visible } = race;
  return visible;
};
const liveRace = (base44) => cachedWorkspaceRead(
  'live',
  () => base44.asServiceRole.entities.LiveRace.list('-setAt', 1),
  LIVE_TTL
);
const cachedRaces = (base44, competitionId) => cachedWorkspaceRead(
  `races:${competitionId}`,
  () => readWorkspacePages(base44.asServiceRole.entities.Race, { competitionId }, raceFields),
  NAV_TTL
);
const cachedRounds = (base44, competitionId) => cachedWorkspaceRead(
  `rounds:${competitionId}`,
  () => readWorkspacePages(base44.asServiceRole.entities.Round, { competitionId }, roundFields),
  NAV_TTL
);
const cachedAthletes = (base44, competitionId) => cachedWorkspaceRead(
  `athletes:${competitionId}`,
  () => readWorkspacePages(base44.asServiceRole.entities.Athlete, { competitionId }, athleteFields),
  ROSTER_TTL
);
const cachedRaceCalls = (base44, raceId) => cachedWorkspaceRead(
  raceCallKey(raceId),
  () => readWorkspacePages(base44.asServiceRole.entities.Call, { raceId }),
  RACE_CALLS_TTL
);

export async function readRefereeSheet(base44, referee, body) {
  const repo = base44.asServiceRole.entities;
  const assigned = referee.assignedCompetitionIds || [];
  const metadata = {
    referee: { id: referee.id, displayName: referee.displayName, function: referee.function || 'NONE' },
    allowedGenderGroups: referee.assignedGenderGroups || ['MEN', 'WOMEN'],
    assignedCompetitionIds: assigned,
  };
  if (body.mode === 'catalog') {
    const [competitions, live] = await Promise.all([
      assigned.length ? readWorkspacePages(repo.Competition, { id: { $in: assigned } }, competitionFields) : [],
      liveRace(base44),
    ]);
    return Response.json({ ...metadata, competitions, liveRace: live[0] || null });
  }
  const competitionId = body.competitionId;
  if (!assigned.includes(competitionId)) {
    return Response.json({ error: 'Competition not assigned to this referee' }, { status: 403 });
  }
  // Navigation: rounds and races only. Rosters and call history must never block it.
  if (body.mode === 'selection') {
    const [rounds, races] = await Promise.all([cachedRounds(base44, competitionId), cachedRaces(base44, competitionId)]);
    return Response.json({ ...metadata, rounds, races: races.map(publicRace) });
  }
  // A call sheet reads its own race, its round, the roster of the competition and
  // this referee's own calls — nothing else.
  const [races, rounds, athletes, raceCalls] = await retryThrottled(() => Promise.all([
    cachedRaces(base44, competitionId),
    cachedRounds(base44, competitionId),
    cachedAthletes(base44, competitionId),
    cachedRaceCalls(base44, body.raceId),
  ]));
  const race = races.find((item) => item.id === body.raceId) || null;
  if (!race) {
    return Response.json({ error: 'This race is not part of the selected competition.' }, { status: 404 });
  }
  const roster = new Set(race.athleteIds || []);
  return Response.json({
    ...metadata,
    race: publicRace(race),
    round: rounds.find((item) => item.id === race.roundId) || null,
    athletes: athletes.filter((athlete) => roster.has(athlete.id)),
    myCalls: (raceCalls || []).filter((call) => call.raceId === race.id && call.refereeId === referee.id),
  });
}

export async function readRefereeStatus(base44, referee, body) {
  const repo = base44.asServiceRole.entities;
  const assigned = referee.assignedCompetitionIds || [];
  const competitionId = body.competitionId;
  // One shared snapshot of the competition's races covers every referee polling
  // at the same moment, whatever race each of them has open. Closing a race is
  // visible within a few seconds, which is all a call sheet needs to lock.
  const [live, selected] = await Promise.all([
    liveRace(base44),
    assigned.includes(competitionId)
      ? cachedWorkspaceRead(
        `race-status:${competitionId}`,
        () => readWorkspacePages(repo.Race, { competitionId }, raceFields),
        STATUS_TTL
      )
      : [],
  ]);
  const race = publicRace((selected || []).find((item) => item.id === body.raceId) || null);
  return Response.json({
    assignedCompetitionIds: assigned,
    raceStatus: race ? [race] : [],
    roundStatus: [],
    liveRace: live[0] || null,
  });
}