export const MEN_RELAY = 'MEN Relay (5000m)';
export const WOMEN_RELAY = 'WOMEN Relay (3000m)';

export const GENDERS = ['MEN', 'WOMEN', 'MIXED', MEN_RELAY, WOMEN_RELAY];

// The relay categories hold one team per country, exactly like MIXED.
export const RELAY_GENDERS = [MEN_RELAY, WOMEN_RELAY];
export const isRelayGender = (gender) => RELAY_GENDERS.includes(gender);
export const isTeamGender = (gender) => gender === 'MIXED' || isRelayGender(gender);

export const DISTANCES = ['500M', '1000M', '1500M', 'Relay 5000M', 'Relay 3000M', 'Mixed Relay 2000M'];

export function distancesFor(gender) {
  // Relay rounds live in their own relay categories, never in MEN/WOMEN.
  if (gender === 'MEN') return ['500M', '1000M', '1500M'];
  if (gender === 'WOMEN') return ['500M', '1000M', '1500M'];
  if (gender === 'MIXED') return ['Mixed Relay 2000M'];
  if (gender === MEN_RELAY) return ['Relay 5000M'];
  if (gender === WOMEN_RELAY) return ['Relay 3000M'];
  return DISTANCES;
}

export const ROUND_TYPES = [
  'Preliminaries',
  'Heats',
  'Quarter Finals',
  'Semi Finals',
  'Final B',
  'Final',
];

export const ROUND_SEQUENCE = ROUND_TYPES.reduce((acc, type, index) => {
  acc[type] = index + 1;
  return acc;
}, {});

export const CALL_CODES = [
  'S1','S2','S3','S4','S5','S6','S7','S8','S9',
  'C1','C2','C3','C4','C5',
  'F1','F2','F3','F4','F5','F6',
  'R1','R2','R3','R4','R5','R6',
  'ST1','ST2','ST3','ST4','ST5','ST6',
  'SR','YC-B','YC-LAP','RC','ADV','ADV Final','ADV Final-B','DNF','NT','NO CALL','OFF','ASS','EMB',
];

// How a change to an already saved Final Decision is classified. The reason has
// to be chosen before the new version is stored, so every revision carries one.
export const REVISION_REASONS = [
  {
    value: 'DEBRIEF',
    label: 'Debrief',
    badge: 'DEBRIEF',
    badgeClass: 'bg-amber-500 text-white',
    buttonClass: 'bg-amber-500 text-white hover:bg-amber-600',
  },
  {
    value: 'TC_MEETING',
    label: 'TC Meeting',
    badge: 'TC MEETING',
    badgeClass: 'bg-isu-navy text-white',
    buttonClass: 'bg-isu-navy text-white hover:bg-isu-navy/90',
  },
  {
    value: 'ERROR_CORRECTION',
    label: 'Error correction',
    badge: 'ERROR CORRECTION',
    badgeClass: 'bg-muted-foreground text-white',
    buttonClass: 'bg-muted-foreground text-white hover:bg-muted-foreground/90',
  },
];

export const revisionReason = (value) =>
  REVISION_REASONS.find((r) => r.value === value) || REVISION_REASONS[0];

export const HERO_IMAGES = {
  main: 'https://media.base44.com/images/public/6a7e05447779e40dc9f5f36a/d2f9eb03f_generated_image.png',
  ice: 'https://media.base44.com/images/public/6a7e05447779e40dc9f5f36a/d347138bc_generated_image.png',
};

export const athleteLabel = (a) =>
  !a ? '' : isTeamGender(a.genderGroup) ? (a.country || '') : `${a.firstName || ''} ${a.lastName || ''}`.trim();

// Team entries (MIXED and both relay categories) carry the country as their name,
// so their country is not repeated next to it.
export const isMixedAthlete = (a) => isTeamGender(a?.genderGroup);

// Tailwind chip colors for a call code, used across TCCube aggregation views.
// S/C/F/ST -> light red, YC -> yellow, RC -> dark red, ADV -> green, rest -> navy.
export function callTone(code) {
  const c = String(code || '');
  if (c === 'ADV' || c.startsWith('ADV')) return 'bg-emerald-600 text-white';
  if (c === 'SR') return 'bg-purple-600 text-white';
  if (c === 'RC') return 'bg-red-800 text-white';
  if (c.startsWith('YC')) return 'bg-yellow-400 text-yellow-950';
  if (['S', 'C', 'F', 'ST'].some((p) => c.startsWith(p))) return 'bg-red-200 text-red-900';
  return 'bg-isu-navy text-white';
}

// Solid fill color for a call code, mirroring callTone for chart bars.
export function callToneColor(code) {
  const c = String(code || '');
  if (c === 'ADV') return '#059669';       // emerald-600
  if (c === 'SR') return '#9333ea';        // purple-600
  if (c === 'RC') return '#991b1b';        // red-800
  if (c.startsWith('YC')) return '#facc15'; // yellow-400
  if (['S', 'C', 'F', 'ST'].some((p) => c.startsWith(p))) return '#dc2626'; // red-600
  return 'hsl(215 72% 18%)';               // isu-navy
}

// Two penalty calls (S/C/F, excluding ST) for the same athlete across two
// different marks in the same race result in a YC-2 (Yellow Card).
// Only the S/C/F penalty codes count — ST and every other code (SR, YC, RC, ADV,
// OFF, ASS, EMB, …) are not penalties and never contribute to a Yellow Card.
export function findYc2Athletes(calls) {
  const marksByAthlete = {};
  (calls || []).forEach((c) => {
    if (!c.athleteId || !c.mark) return;
    const code = String(c.callCode || '');
    if (!/^[SCF][0-9]+$/.test(code)) return;
    (marksByAthlete[c.athleteId] = marksByAthlete[c.athleteId] || new Set()).add(c.mark);
  });
  return Object.keys(marksByAthlete).filter((id) => marksByAthlete[id].size >= 2);
}

export function youtubeEmbedUrl(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|v=|embed\/|live\/)([A-Za-z0-9_-]{6,})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}