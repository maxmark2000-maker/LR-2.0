export const ALL_MARKS = ['MARK1', 'MARK2', 'MARK3', 'MARK4', 'MARK5'];

const markKey = (id, m) => `${id}|${m}`;

// The two agreement views.
// 'lenient'  — the right athlete with a wrong code still counts as correct when
//              the code stays in the same family (S6 instead of S8).
// 'strict'   — athlete and code both have to match exactly.
export const MATCH_MODES = { LENIENT: 'lenient', STRICT: 'strict' };

// Code family used by the lenient view. S1-S9, C1-C5, F1-F6, ST1-ST6, YC-B/YC-LAP,
// RC and EMB each form one family. ADV, DNF, DNS, NT, OFF, ASS, SR, NO CALL and
// every other code belong to no family, so they never match leniently.
export function codeFamily(code) {
  const c = String(code || '').trim().toUpperCase();
  if (/^ST[0-9]+$/.test(c)) return 'ST';
  if (/^S[0-9]+$/.test(c)) return 'S';
  if (/^C[0-9]+$/.test(c)) return 'C';
  if (/^F[0-9]+$/.test(c)) return 'F';
  if (c.startsWith('YC')) return 'YC';
  if (c === 'RC') return 'RC';
  if (c === 'EMB') return 'EMB';
  return null;
}

// Does the referee's code count as matching the official code in the given view?
export function codesMatch(expected, actual, mode) {
  const exp = String(expected || '');
  const act = String(actual || '');
  if (exp === act) return true;
  if (mode !== MATCH_MODES.LENIENT) return false;
  // An official ADV the referee did not award is never a disagreement in the
  // lenient view — the referee simply did not call the advantage.
  if (exp.startsWith('ADV') && (!act || act === 'NO CALL')) return true;
  const family = codeFamily(exp);
  return !!family && family === codeFamily(act);
}

// The Final Call stored on a Race is a JSON blob: { marks: {'athleteId|MARK': code}, notes, tc, noCall }.
export function parseFinalDecision(raw) {
  if (!raw) return { marks: {}, notes: {}, tc: {}, noCall: false };
  try {
    const parsed = JSON.parse(raw);
    return { marks: parsed.marks || {}, notes: parsed.notes || {}, tc: parsed.tc || {}, noCall: !!parsed.noCall };
  } catch {
    return { marks: {}, notes: {}, tc: {}, noCall: false };
  }
}

// Effective scoring marks for a race: race override, else competition default, else all five.
export function effectiveScoringMarks(race, defaultScoringMarks) {
  if (race?.scoringMarks && race.scoringMarks.length) return race.scoringMarks;
  if (defaultScoringMarks && defaultScoringMarks.length) return defaultScoringMarks;
  return ALL_MARKS;
}

// The official Final Call as a list of marks, each holding its components.
// One component = one athlete + the official decision for that mark.
// Only marks that actually contain a Final Call entry are returned — everything
// the referee did beyond the Final Call is deliberately ignored.
export function finalCallMarkGroups(race, athletes, defaultScoringMarks) {
  const decision = parseFinalDecision(race?.finalDecision);
  const eff = effectiveScoringMarks(race, defaultScoringMarks);
  const groups = [];
  eff.forEach((mark) => {
    const components = [];
    const athleteIds = [];
    (athletes || []).forEach((a) => {
      const code = decision.noCall ? 'NO CALL' : (decision.marks[markKey(a.id, mark)] || '');
      if (code) {
        components.push({ athleteId: a.id, code });
        athleteIds.push(a.id);
      }
    });
    if (!components.length) return;
    // If NO CALL is set for every athlete of a mark, the whole mark is a single
    // component — it is not scored once per athlete.
    const collapsedNoCall = components.every((c) => c.code === 'NO CALL');
    groups.push({ mark, components, athleteIds, collapsedNoCall });
  });
  return groups;
}

// Score one referee against a set of official mark groups.
// Mark Score = correctly matched components / all components of that mark.
function scoreAgainstGroups(groups, myCell, myRaceNoCall, myMarkNoCall, athleteById, matchMode) {
  const marks = groups.map(({ mark, components, athleteIds, collapsedNoCall }) => {
    let entries;

    if (collapsedNoCall) {
      // One single component for the whole mark.
      const perAthleteNoCall = athleteIds.length > 0
        && athleteIds.every((id) => myCell[markKey(id, mark)] === 'NO CALL');
      const matched = myRaceNoCall || myMarkNoCall.has(mark) || perAthleteNoCall;
      entries = [{
        athleteId: `__mark__${mark}`,
        athleteName: 'Whole mark',
        helmetNumber: '',
        country: '',
        expected: 'NO CALL',
        actual: matched ? 'NO CALL' : '—',
        correct: matched,
      }];
    } else {
      entries = components.map(({ athleteId, code }) => {
        const athlete = athleteById[athleteId];
        const mine = myCell[markKey(athleteId, mark)]
          || (myRaceNoCall ? 'NO CALL' : '')
          || (myMarkNoCall.has(mark) ? 'NO CALL' : '');
        const correct = codesMatch(code, mine, matchMode);
        return {
          athleteId,
          athleteName: athlete ? `${athlete.firstName} ${athlete.lastName}` : athleteId,
          helmetNumber: athlete?.helmetNumber || '',
          country: athlete?.country || '',
          expected: code,
          actual: mine || '—',
          correct,
          codeDiffers: correct && mine !== code,
          notCalled: correct && !mine,
        };
      });
    }
    const correct = entries.filter((e) => e.correct).length;
    const total = entries.length;
    return { mark, entries, correct, total, score: total ? correct / total : 0 };
  });

  const totalComponents = marks.reduce((s, m) => s + m.total, 0);
  const correctComponents = marks.reduce((s, m) => s + m.correct, 0);
  const markScoreSum = marks.reduce((s, m) => s + m.score, 0);

  return {
    marks,
    marksEvaluated: marks.length,
    marksPerfect: marks.filter((m) => m.score === 1).length,
    marksPartial: marks.filter((m) => m.score > 0 && m.score < 1).length,
    marksMissed: marks.filter((m) => m.score === 0).length,
    totalComponents,
    correctComponents,
    markAgreement: marks.length ? markScoreSum / marks.length : 0,
    componentAgreement: totalComponents ? correctComponents / totalComponents : 0,
  };
}

// How the referees who submitted calls for a single race compare with the
// official Final Call. A referee counts as agreeing only when every scored
// component of the race matches the Final Call.
export function raceRefereeAgreement(race, athletes, raceCalls, defaultScoringMarks, matchMode) {
  const athleteById = {};
  (athletes || []).forEach((a) => { athleteById[a.id] = a; });

  const byReferee = new Map();
  (raceCalls || []).forEach((c) => {
    const key = c.refereeName || c.refereeId;
    if (!key) return;
    if (!byReferee.has(key)) byReferee.set(key, []);
    byReferee.get(key).push(c);
  });

  const referees = byReferee.size;
  const groups = finalCallMarkGroups(race, athletes, defaultScoringMarks);
  if (!groups.length || !referees) {
    return { referees, agreeing: 0, disagreeing: referees, disagreeRatio: referees ? 1 : 0, marks: [] };
  }

  // One counter per mark: how many of the race's referees matched that mark in full.
  const markStats = groups.map((g) => ({ mark: g.mark, referees, agreeing: 0, disagreeing: 0, disagreeRatio: 0 }));
  const markIndex = {};
  markStats.forEach((s, i) => { markIndex[s.mark] = i; });

  let agreeing = 0;
  byReferee.forEach((myCalls) => {
    const myRaceNoCall = myCalls.some((c) => !c.athleteId && !c.mark && c.callCode === 'NO CALL');
    const myMarkNoCall = new Set(
      myCalls.filter((c) => !c.athleteId && c.mark && c.callCode === 'NO CALL').map((c) => c.mark)
    );
    const myCell = {};
    myCalls.forEach((c) => { if (c.athleteId && c.mark) myCell[markKey(c.athleteId, c.mark)] = c.callCode; });
    const scored = scoreAgainstGroups(groups, myCell, myRaceNoCall, myMarkNoCall, athleteById, matchMode);
    if (scored.componentAgreement === 1) agreeing += 1;
    scored.marks.forEach((m) => {
      const stat = markStats[markIndex[m.mark]];
      if (stat && m.score === 1) stat.agreeing += 1;
    });
  });

  markStats.forEach((s) => {
    s.disagreeing = s.referees - s.agreeing;
    s.disagreeRatio = s.referees ? s.disagreeing / s.referees : 0;
  });

  return {
    referees,
    agreeing,
    disagreeing: referees - agreeing,
    disagreeRatio: (referees - agreeing) / referees,
    marks: markStats,
  };
}

// Compute the per-referee statistics for a competition.
// Only Final Call marks/components are scored; additional referee marks or calls
// never lower the score. Race Score = average of its Mark Scores; the overall
// agreement is the average of every evaluated Mark Score.
export function computeRefereeScores({ races, athletes, calls, defaultScoringMarks, refereeFunctions, matchMode }) {
  const athleteById = {};
  (athletes || []).forEach((a) => { athleteById[a.id] = a; });

  const byReferee = {};
  const ensure = (key) => {
    if (!byReferee[key]) byReferee[key] = { key, name: key, function: '', refereeId: '', races: [] };
    return byReferee[key];
  };

  (races || []).forEach((race) => {
    const raceAthletes = (race.athleteIds || []).map((id) => athleteById[id]).filter(Boolean);
    const groups = finalCallMarkGroups(race, raceAthletes, defaultScoringMarks);
    if (!groups.length) return;

    const raceCalls = (calls || []).filter((c) => c.raceId === race.id);
    if (!raceCalls.length) return;

    const revised = !!race.finalDecisionRevised;
    const prevGroups = revised && race.finalDecisionPrevious
      ? finalCallMarkGroups({ ...race, finalDecision: race.finalDecisionPrevious }, raceAthletes, defaultScoringMarks)
      : [];

    const participantKeys = new Map();
    raceCalls.forEach((c) => {
      const key = c.refereeName || c.refereeId;
      if (!key) return;
      if (!participantKeys.has(key) || (!participantKeys.get(key) && c.refereeId)) {
        participantKeys.set(key, c.refereeId || '');
      }
    });

    participantKeys.forEach((refereeId, key) => {
      const ref = ensure(key);
      if (refereeId && !ref.refereeId) ref.refereeId = refereeId;
      if (!ref.function) {
        const fromCall = raceCalls.find((c) => (c.refereeName || c.refereeId) === key && c.refereeFunction)?.refereeFunction;
        ref.function = fromCall || refereeFunctions?.[ref.refereeId] || '';
      }

      const myCalls = raceCalls.filter((c) => (c.refereeName || c.refereeId) === key);
      const myRaceNoCall = myCalls.some((c) => !c.athleteId && !c.mark && c.callCode === 'NO CALL');
      const myMarkNoCall = new Set(
        myCalls.filter((c) => !c.athleteId && c.mark && c.callCode === 'NO CALL').map((c) => c.mark)
      );
      const myCell = {};
      myCalls.forEach((c) => { if (c.athleteId && c.mark) myCell[markKey(c.athleteId, c.mark)] = c.callCode; });

      const scored = scoreAgainstGroups(groups, myCell, myRaceNoCall, myMarkNoCall, athleteById, matchMode);
      const previous = prevGroups.length
        ? scoreAgainstGroups(prevGroups, myCell, myRaceNoCall, myMarkNoCall, athleteById, matchMode)
        : null;

      ref.races.push({
        raceId: race.id,
        raceNumber: race.raceNumber,
        revised,
        revisionReason: race.finalDecisionRevisionReason || '',
        revisedAt: race.finalDecisionRevisedAt || '',
        ...scored,
        previous: previous ? { markAgreement: previous.markAgreement, componentAgreement: previous.componentAgreement } : null,
      });
    });
  });

  return Object.values(byReferee)
    .map((r) => {
      const marksEvaluated = r.races.reduce((s, x) => s + x.marksEvaluated, 0);
      const totalComponents = r.races.reduce((s, x) => s + x.totalComponents, 0);
      const correctComponents = r.races.reduce((s, x) => s + x.correctComponents, 0);
      const markScoreSum = r.races.reduce((s, x) => s + x.markAgreement * x.marksEvaluated, 0);

      const revisedRaces = r.races.filter((x) => x.previous);
      const revisedMarks = revisedRaces.reduce((s, x) => s + x.marksEvaluated, 0);
      const revisedNow = revisedRaces.reduce((s, x) => s + x.markAgreement * x.marksEvaluated, 0);
      const revisedPrev = revisedRaces.reduce((s, x) => s + x.previous.markAgreement * x.marksEvaluated, 0);

      return {
        ...r,
        races: [...r.races].sort((a, b) => a.raceNumber - b.raceNumber),
        raceCount: r.races.length,
        marksEvaluated,
        marksPerfect: r.races.reduce((s, x) => s + x.marksPerfect, 0),
        marksPartial: r.races.reduce((s, x) => s + x.marksPartial, 0),
        marksMissed: r.races.reduce((s, x) => s + x.marksMissed, 0),
        totalComponents,
        correctComponents,
        markAgreement: marksEvaluated ? markScoreSum / marksEvaluated : 0,
        componentAgreement: totalComponents ? correctComponents / totalComponents : 0,
        hasDebriefChange: revisedRaces.length > 0,
        revisedMarkAgreementNow: revisedMarks ? revisedNow / revisedMarks : null,
        revisedMarkAgreementBefore: revisedMarks ? revisedPrev / revisedMarks : null,
      };
    })
    .filter((r) => r.marksEvaluated > 0)
    .sort((a, b) => b.markAgreement - a.markAgreement || b.correctComponents - a.correctComponents || a.name.localeCompare(b.name));
}