import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { verifyGateToken } from '../../shared/cubeAuth.ts';
import { readRefereeList } from '../../shared/refereeAuth.ts';
import { readRefereeSheet, readRefereeStatus } from '../../shared/refereeSheets.ts';
import { forgetWorkspaceReads } from '../../shared/workspaceReads.ts';

// Simulates many referees opening the same call sheet at the same moment. Each
// virtual session runs the real sheet path with its own referee id, so the test
// shows whether a session with 30+ participants can still load its sheet.
const MAX_SESSIONS = 90;
const MAX_ROUNDS = 3;
const GENDERS = ['MEN', 'WOMEN', 'MIXED', 'MEN Relay (5000m)', 'WOMEN Relay (3000m)'];

const median = (sorted) => sorted[Math.floor(sorted.length / 2)] || 0;

const failedResult = (item) => ({
  status: 0,
  ms: 0,
  error: String(item.reason?.message || item.reason || 'Request failed'),
});

const summarizeResults = (results, totalMs, round) => {
  const durations = results.filter((item) => item.status === 200).map((item) => item.ms).sort((a, b) => a - b);
  const failures: Record<string, number> = {};
  results.filter((item) => item.status !== 200).forEach((item) => {
    const key = `${item.status || 'error'} ${item.error || 'Request failed'}`.trim();
    failures[key] = (failures[key] || 0) + 1;
  });
  return {
    round,
    ok: durations.length,
    failed: results.length - durations.length,
    minMs: durations[0] || 0,
    medianMs: median(durations),
    maxMs: durations[durations.length - 1] || 0,
    totalMs,
    failures: Object.entries(failures).map(([reason, count]) => ({ reason, count })),
  };
};

const settle = (settled) => settled.map((item) => (item.status === 'fulfilled' ? item.value : failedResult(item)));
const summarize = (settled, totalMs, round) => summarizeResults(settle(settled), totalMs, round);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    if (!(await verifyGateToken('orga', String(body?.token || '')))) {
      return Response.json({ error: 'ORGACube session expired. Please unlock again.' }, { status: 401 });
    }

    const competitionId = String(body?.competitionId || '');
    const raceId = String(body?.raceId || '');
    // 'sheet' opens the call sheet, 'status' is the refresh a referee workspace
    // sends while a race runs, 'login' is the sign-in wave at the start of the
    // session, when every referee reads the referee table at the same moment.
    const mode = ['status', 'login', 'signin'].includes(body?.mode) ? body.mode : 'sheet';
    if (!competitionId || (mode !== 'login' && !raceId)) {
      return Response.json({ error: 'Choose a competition and a race first.' }, { status: 400 });
    }
    const sessions = Math.min(MAX_SESSIONS, Math.max(1, Number(body?.sessions) || 30));
    const rounds = Math.min(MAX_ROUNDS, Math.max(1, Number(body?.rounds) || 2));
    const cold = body?.cold !== false;
    // Worst case: every referee watches a different race, so no shared read can
    // cover them. 'spread' distributes the sessions over the races of the
    // competition instead of putting them all on the selected race.
    let raceIds = [raceId];
    if (body?.spread === true) {
      const races = await base44.asServiceRole.entities.Race.filter({ competitionId }, '-created_date', 300, 0).catch(() => []);
      if (races.length > 1) raceIds = races.map((race) => race.id);
    }

    const virtualReferees = Array.from({ length: sessions }, (_, index) => ({
      id: `load-test-${index + 1}`,
      username: `load-test-${index + 1}`,
      displayName: `Load test ${index + 1}`,
      assignedCompetitionIds: [competitionId],
      assignedGenderGroups: GENDERS,
      function: 'NONE',
      raceId: raceIds[index % raceIds.length],
    }));

    // One read each for ORGACube (the races of the competition) and TCCube (the
    // calls being aggregated), run right after a wave and again 6 and 12 seconds
    // later: this is what the two Cubes do on their own pages, so a failure here
    // is exactly the "Cube does not open" a real user sees.
    const readOne = async (run) => {
      const beganAt = Date.now();
      try {
        const value = await run();
        return { status: 200, ms: Date.now() - beganAt, count: Array.isArray(value) ? value.length : 0 };
      } catch (error) {
        return { status: error?.status || 0, ms: Date.now() - beganAt, error: String(error?.message || error) };
      }
    };
    const probe = async (waitMs) => {
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
      const [orga, tc] = await Promise.all([
        readOne(() => base44.asServiceRole.entities.Race.filter({ competitionId })),
        readOne(() => base44.asServiceRole.entities.Call.list('-created_date', 20)),
      ]);
      return { afterMs: waitMs, orga, tc };
    };
    const runProbes = async () => [await probe(0), await probe(6000), await probe(6000)];

    // Sign-in wave: the whole wave shares one read of the referee table, exactly
    // like the real sign-in does. This measures that burst, then probes whether
    // ORGACube and TCCube can still read while the budget is under pressure — the
    // failure mode that made both Cubes unusable during a real sign-in wave.
    if (mode === 'login') {
      if (cold) forgetWorkspaceReads();
      const startedAt = Date.now();
      const settled = await Promise.allSettled(virtualReferees.map((referee) => (async () => {
        const beganAt = Date.now();
        try {
          const referees = await readRefereeList(base44);
          // The simulated identities are not in the referee table; the shared read
          // is what this measures, so a missing record is not a failure.
          const known = Array.isArray(referees) && referees.some((entry) => entry.username === referee.username);
          return { status: 200, ms: Date.now() - beganAt, error: '', known };
        } catch (error) {
          return { status: error?.status || 0, ms: Date.now() - beganAt, error: String(error?.message || error) };
        }
      })()));
      const signIns = summarize(settled, Date.now() - startedAt, 1);
      return Response.json({ sessions, mode, rounds: [signIns], probes: await runProbes() });
    }

    // Sign-in and sheet in one go: everybody signs in at the same second and opens
    // their call sheet the instant they are in. The two phases are measured apart,
    // so the report shows which of them the shared budget gives out on.
    if (mode === 'signin') {
      if (cold) forgetWorkspaceReads();
      const startedAt = Date.now();
      const settled = await Promise.allSettled(virtualReferees.map(async (referee) => {
        const beganAt = Date.now();
        try {
          // The signed-in identity is simulated: the sign-in itself is the shared
          // referee read, which is what this phase has to cost and measure.
          await readRefereeList(base44);
          const signedInAt = Date.now();
          const response = await readRefereeSheet(base44, referee, { mode: 'sheet', competitionId, raceId: referee.raceId });
          const payload = await response.json().catch(() => ({}));
          return {
            status: response.status,
            ms: Date.now() - beganAt,
            signInMs: signedInAt - beganAt,
            sheetMs: Date.now() - signedInAt,
            error: payload?.error || '',
          };
        } catch (error) {
          return { status: error?.status || 0, ms: Date.now() - beganAt, signInMs: 0, sheetMs: 0, error: String(error?.message || error) };
        }
      }));
      const totalMs = Date.now() - startedAt;
      const results = settle(settled);
      const phases = {
        signIn: summarizeResults(results.map((result) => ({ ...result, ms: result.signInMs || 0 })), totalMs, 1),
        sheet: summarizeResults(results.map((result) => ({ ...result, ms: result.sheetMs || 0 })), totalMs, 1),
      };
      return Response.json({
        sessions, cold, mode, racesUsed: raceIds.length,
        rounds: [summarizeResults(results, totalMs, 1)], phases, probes: await runProbes(),
      });
    }

    const report = [];
    for (let round = 1; round <= rounds; round += 1) {
      if (cold) forgetWorkspaceReads();
      const startedAt = Date.now();
      const settled = await Promise.allSettled(virtualReferees.map(async (referee) => {
        const beganAt = Date.now();
        const response = mode === 'status'
          ? await readRefereeStatus(base44, referee, { competitionId, raceId: referee.raceId })
          : await readRefereeSheet(base44, referee, { mode: 'sheet', competitionId, raceId: referee.raceId });
        const payload = await response.json().catch(() => ({}));
        return { status: response.status, ms: Date.now() - beganAt, error: payload?.error || '' };
      }));
      report.push(summarize(settled, Date.now() - startedAt, round));
    }

    return Response.json({ sessions, cold, mode, racesUsed: raceIds.length, rounds: report });
  } catch (error) {
    return Response.json({ error: error.message }, { status: (error.status || error.response?.status) === 429 ? 429 : 500 });
  }
}