import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifyGateToken } from '../../shared/cubeAuth.ts';

const ROUND_SEQUENCE = {
  'Preliminaries': 1, 'Heats': 2, 'Quarter Finals': 3, 'Semi Finals': 4, 'Final B': 5, 'Final': 6
};
const KNOWN_DISTANCES = new Set(['500M', '1000M', '1500M', 'Relay 5000M', 'Relay 3000M', 'Mixed Relay 2000M']);

function normalizeRoundType(raw) {
  const s = String(raw || '').toLowerCase().replace(/[^a-z]/g, '');
  const map = {
    preliminaries: 'Preliminaries', prelim: 'Preliminaries', prelims: 'Preliminaries',
    heats: 'Heats', heat: 'Heats',
    quarterfinals: 'Quarter Finals', quarterfinal: 'Quarter Finals', quarter: 'Quarter Finals', qf: 'Quarter Finals',
    semifinals: 'Semi Finals', semifinal: 'Semi Finals', semi: 'Semi Finals', sf: 'Semi Finals',
    finalb: 'Final B',
    finala: 'Final', final: 'Final'
  };
  return map[s] || '';
}

function normalizeDistance(raw) {
  const s = String(raw || '').toLowerCase().replace(/\s+/g, '');
  const map = {
    '500m': '500M', '1000m': '1000M', '1500m': '1500M',
    'relay5000m': 'Relay 5000M', '5000mrelay': 'Relay 5000M',
    'relay3000m': 'Relay 3000M', '3000mrelay': 'Relay 3000M',
    'mixedrelay2000m': 'Mixed Relay 2000M', '2000mmixedrelay': 'Mixed Relay 2000M'
  };
  return map[s] || '';
}

export default async function(req) {
  try {
    // ORGACube is protected by its shared password gate (not app-user auth).
    const base44 = createClientFromRequest(req);
    let actorName = 'ORGACube';
    try {
      const user = await base44.auth.me();
      if (user) actorName = user.full_name || user.email;
    } catch { /* anonymous ORGACube session */ }

    const body = await req.json();
    if (!(await verifyGateToken('orga', String(body?.token || '')))) {
      return Response.json({ error: 'ORGACube session expired. Please unlock again.' }, { status: 401 });
    }
    const competitionId = body?.competitionId;
    const fileUrl = body?.fileUrl;
    if (!competitionId) return Response.json({ error: 'competitionId is required' }, { status: 400 });
    if (!fileUrl) return Response.json({ error: 'fileUrl is required' }, { status: 400 });

    const res = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: {
        type: 'object',
        properties: {
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                scheduledTime: { type: 'string' },
                raceNumber: { type: 'number' },
                numbersList: { type: 'string' },
                roundType: { type: 'string' },
                distance: { type: 'string' },
                gender: { type: 'string' },
                label: { type: 'string' }
              }
            }
          }
        }
      }
    });

    const out = res?.status === 'error' ? null : res?.output;
    let list = Array.isArray(out) ? out : out?.entries || [];

    // The tabular extractor rejects some layouts outright ("column mapping…").
    // Same fallback as the athlete import: let the model read the file directly,
    // so any official schedule layout can be imported.
    if (list.length === 0) {
      const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt:
          'This file is an official competition schedule of a short track speed skating event. ' +
          'Read the table literally: exactly one output row per row of the file, in running order, never duplicating a row. ' +
          'For each row return: ' +
          'scheduledTime (planned start as ISO 8601 datetime, using the date given in the file header — never invent one), ' +
          'raceNumber (the race number), raceNumbersText (ALL race numbers the row covers when one line lists several races, e.g. "84-86"), ' +
          'roundType (Preliminaries, Heats, Quarter Finals, Semi Finals, Final B or Final — never "Relay"), ' +
          'distance as written in the file (500M, 1000M, 1500M, Relay 5000M, Relay 3000M or Mixed Relay 2000M), ' +
          'gender (MEN, WOMEN or MIXED) and label (the event wording from the file). ' +
          'Do not change the distance or gender of a row and do not invent races.',
        file_urls: [fileUrl],
        response_json_schema: {
          type: 'object',
          properties: {
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  scheduledTime: { type: 'string' },
                  raceNumber: { type: 'number' },
                  raceNumbersText: { type: 'string' },
                  roundType: { type: 'string' },
                  distance: { type: 'string' },
                  gender: { type: 'string' },
                  label: { type: 'string' },
                },
              },
            },
          },
        },
      });
      list = llm?.entries || [];
    }

    if (list.length === 0) {
      return Response.json({ error: 'No race entries found in this file.' }, { status: 400 });
    }

    // ORGACube sessions are not app-user sessions (the gate token above is the
    // authorisation), so entity access must run with the service role — with the
    // caller's token the admin-only RLS rejected every read/write with a 500.
    const existingRounds = await base44.asServiceRole.entities.Round.filter({ competitionId });
    const existingRaces = await base44.asServiceRole.entities.Race.filter({ competitionId });
    const existingEntries = await base44.asServiceRole.entities.ScheduleEntry.filter({ competitionId });

    const normDist = (d) => String(d || '').toLowerCase().replace(/\s+/g, '');
    const normType = (t) => String(t || '').toLowerCase().replace(/[^a-z]/g, '');
    // A race owns exactly one schedule row, so re-uploading the same schedule must
    // not add a second row for a race that is already scheduled.
    const hasEntry = (roundType, distance, gender, raceNumber) =>
      existingEntries.some((e) =>
        e.genderGroup === gender &&
        Number(e.raceNumber) === Number(raceNumber) &&
        normDist(e.distance) === normDist(distance) &&
        normType(e.roundType) === normType(roundType)
      );

    const findRound = (type, distance, gender) =>
      existingRounds.find((r) => r.type === type && r.distance === distance && r.genderGroup === gender) || null;
    const findRace = (roundId, raceNumber) =>
      existingRaces.find((r) => r.roundId === roundId && Number(r.raceNumber) === Number(raceNumber)) || null;

    let entriesCreated = 0;
    let roundsCreated = 0;
    let racesCreated = 0;
    const skipped = [];

    const touchedRounds = new Set();

    for (const item of list) {
      if (!item) continue;
      const rawGender = String(item.gender || '').toUpperCase();
      let genderGroup = rawGender.includes('WOM') ? 'WOMEN' : rawGender.includes('MIX') ? 'MIXED' : 'MEN';
      const time = item.scheduledTime ? new Date(item.scheduledTime) : null;
      if (!time || isNaN(time.getTime())) continue;
      const roundType = normalizeRoundType(item.roundType);
      const distance = normalizeDistance(item.distance);

      // Relay events are their own categories (MEN Relay 5000m / WOMEN Relay
      // 3000m), each holding one team per country — filing them under the
      // individual MEN/WOMEN category made them show single skaters instead.
      if (distance === 'Relay 5000M') genderGroup = 'MEN Relay (5000m)';
      else if (distance === 'Relay 3000M') genderGroup = 'WOMEN Relay (3000m)';
      else if (distance === 'Mixed Relay 2000M') genderGroup = 'MIXED';
      const legacyGender = genderGroup === 'MEN Relay (5000m)' ? 'MEN'
        : genderGroup === 'WOMEN Relay (3000m)' ? 'WOMEN' : null;

      // One schedule row can cover several races of the same round
      // (e.g. "Semi Finals, races 84-86") — collect ALL of its race numbers.
      const raceNumbers = [];
      const numberParts = String(item.numbersList || item.raceNumbersText || item.raceNumber || '').split(/[,;\s]+/).filter(Boolean);
      for (const part of numberParts) {
        const range = part.match(/^(\d+)\s*[-\u2013]\s*(\d+)$/);
        if (range) {
          const from = Number(range[1]);
          const to = Number(range[2]);
          if (to >= from && to - from < 50) {
            for (let n = from; n <= to; n++) raceNumbers.push(n);
          }
        } else {
          const n = Number(part);
          if (Number.isFinite(n) && n > 0) raceNumbers.push(n);
        }
      }
      const allRaceNumbers = [...new Set(raceNumbers)];
      if (!allRaceNumbers.length) continue;

      const recognized = !!(roundType && distance && ROUND_SEQUENCE[roundType] && KNOWN_DISTANCES.has(distance));
      let round = null;
      if (recognized) {
        round = findRound(roundType, distance, genderGroup);
        if (!round && legacyGender) {
          // A relay round imported before this fix sits in the individual
          // category: move it (and its races) instead of creating a duplicate.
          const legacy = findRound(roundType, distance, legacyGender);
          if (legacy) {
            await base44.asServiceRole.entities.Round.update(legacy.id, { genderGroup });
            legacy.genderGroup = genderGroup;
            for (const r of existingRaces.filter((rc) => rc.roundId === legacy.id)) {
              await base44.asServiceRole.entities.Race.update(r.id, { genderGroup });
              r.genderGroup = genderGroup;
            }
            round = legacy;
          }
        }
        if (!round) {
          round = await base44.asServiceRole.entities.Round.create({
            competitionId,
            genderGroup,
            type: roundType,
            distance,
            sequence: ROUND_SEQUENCE[roundType],
            racesCount: 1,
            isComplete: false
          });
          existingRounds.push(round);
          roundsCreated += 1;
        }
        touchedRounds.add(round.id);
      } else if (item.roundType || item.distance) {
        skipped.push(`#${allRaceNumbers.join('/')} ${item.roundType || ''} ${item.distance || ''} (unrecognized round/distance)`);
      }

      // Every race number gets its own schedule entry and race, so all races
      // of a round are inserted — not just the first one on the row.
      for (const raceNumber of allRaceNumbers) {
        const entryRoundType = roundType || String(item.roundType || '').trim();
        const entryDistance = distance || String(item.distance || '').trim();
        if (!hasEntry(entryRoundType, entryDistance, genderGroup, raceNumber)) {
          // Same repair for the schedule row itself: relabel a relay entry that
          // still sits in the individual category instead of adding a copy.
          const legacyEntry = legacyGender
            ? existingEntries.find((e) =>
                e.genderGroup === legacyGender &&
                Number(e.raceNumber) === Number(raceNumber) &&
                normDist(e.distance) === normDist(entryDistance) &&
                normType(e.roundType) === normType(entryRoundType)) || null
            : null;
          if (legacyEntry) {
            const patch = { genderGroup, scheduledTime: time.toISOString(), label: String(item.label || '').trim() };
            await base44.asServiceRole.entities.ScheduleEntry.update(legacyEntry.id, patch);
            Object.assign(legacyEntry, patch);
          } else {
            const entry = await base44.asServiceRole.entities.ScheduleEntry.create({
              competitionId,
              scheduledTime: time.toISOString(),
              raceNumber,
              roundType: entryRoundType,
              distance: entryDistance,
              genderGroup,
              label: String(item.label || '').trim()
            });
            if (entry) existingEntries.push(entry);
            entriesCreated += 1;
          }
        }

        if (!round || findRace(round.id, raceNumber)) continue;
        try {
          const race = await base44.asServiceRole.entities.Race.create({
            competitionId,
            roundId: round.id,
            genderGroup,
            raceNumber,
            athleteIds: []
          });
          existingRaces.push(race);
          racesCreated += 1;
        } catch (err) {
          skipped.push(`#${raceNumber} ${roundType} ${distance}: ${err.message}`);
        }
      }
    }

    // Keep the racesCount of touched rounds in sync with the imported races
    for (const rid of touchedRounds) {
      const count = existingRaces.filter((r) => r.roundId === rid).length;
      const rd = existingRounds.find((x) => x.id === rid);
      if (rd && rd.racesCount !== count) {
        await base44.asServiceRole.entities.Round.update(rid, { racesCount: count });
        rd.racesCount = count;
      }
    }

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'SCHEDULE_PARSED',
      actorName,
      actorRole: 'ORG_ADMIN',
      details: `${entriesCreated} entries, ${roundsCreated} rounds, ${racesCreated} races${skipped.length ? `, ${skipped.length} skipped` : ''}`,
      timestamp: new Date().toISOString()
    });

    return Response.json({ created: entriesCreated, rounds: roundsCreated, races: racesCreated, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}