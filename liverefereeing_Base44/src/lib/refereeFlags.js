// Personal referee review flags ("flag for review") are completely separate from
// the official TC race flag: they only mark a race for a referee's own follow-up
// and never touch calls, scoring or the Final Decision.

import { MEN_RELAY, WOMEN_RELAY } from '@/lib/isu';

export const REFEREE_ATTENTION_THRESHOLD = 0.5;

// Accepts MM:SS and HH:MM:SS. Returns the cleaned value, '' for empty input and
// null when the input cannot be read as a video position.
export function normalizeVideoTimestamp(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const mmss = /^\d{1,3}:[0-5]\d$/;
  const hhmmss = /^\d{1,2}:[0-5]\d:[0-5]\d$/;
  if (!mmss.test(raw) && !hhmmss.test(raw)) return null;
  const parts = raw.split(':').map((p) => Number(p));
  if (parts.length === 2) return `${parts[0]}:${String(parts[1]).padStart(2, '0')}`;
  return `${parts[0]}:${String(parts[1]).padStart(2, '0')}:${String(parts[2]).padStart(2, '0')}`;
}

// The referees registered for a competition: active, assigned to it and to its
// gender group.
export function registeredReferees(referees, competitionId, genderGroup) {
  return (referees || []).filter((r) => {
    if (r.active === false) return false;
    const competitions = r.assignedCompetitionIds || [];
    if (!competitions.length || (competitionId && !competitions.includes(competitionId))) return false;
    const groups = r.assignedGenderGroups || [];
    if (genderGroup && groups.length && !groups.includes(genderGroup)) return false;
    return true;
  });
}

// How many of these referees already sent at least one call.
export function countRefereesWithCalls(referees, calls) {
  const keys = new Set((calls || []).map((c) => c.refereeId || c.refereeName).filter(Boolean));
  return (referees || []).filter((r) => keys.has(r.id) || keys.has(r.displayName)).length;
}

// The referees who actually judged a race: those who submitted at least one call
// for it. This is the base for the majority count.
export function refereesWithCalls(calls, referees) {
  const byId = new Map((referees || []).map((r) => [r.id, r]));
  const base = new Map();
  (calls || []).forEach((c) => {
    const key = c.refereeId || c.refereeName;
    if (!key || base.has(key)) return;
    base.set(key, byId.get(c.refereeId) || { id: key, displayName: c.refereeName || 'Unknown referee' });
  });
  return [...base.values()];
}

// Every referee counts once, however many flag records exist for the race, and
// only flags from referees who called the race are counted.
export function refereeFlagSummary(flags, base) {
  const ids = new Set((base || []).map((r) => r.id));
  const names = new Set((base || []).map((r) => r.displayName));
  const flagged = new Set();
  (flags || []).forEach((f) => {
    if (f.refereeId ? ids.has(f.refereeId) : names.has(f.refereeName)) flagged.add(f.refereeId || f.refereeName);
  });
  const count = flagged.size;
  const total = (base || []).length;
  const ratio = total > 0 ? count / total : 0;
  return { count, total, ratio, reached: total > 0 && ratio >= REFEREE_ATTENTION_THRESHOLD };
}

export function genderLabel(group) {
  if (group === 'MEN') return 'Men';
  if (group === 'WOMEN') return 'Women';
  if (group === 'MIXED') return 'Mixed';
  if (group === MEN_RELAY) return 'Men Relay';
  if (group === WOMEN_RELAY) return 'Women Relay';
  return group || '';
}