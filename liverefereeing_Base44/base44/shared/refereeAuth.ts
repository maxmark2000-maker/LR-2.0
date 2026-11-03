// Shared referee credential helpers (hashing + token verification).

import { cachedWorkspaceRead, readWorkspacePages } from './workspaceReads.ts';

// The whole referee list is read at most once per burst of sign-ins instead of
// once per referee: a wave of 80 logins costs 1-2 reads instead of 80. The list
// stays in server memory only and is never sent anywhere; each caller still gets
// just their own record, without password data. The window is deliberately
// short, so a freshly created referee or a changed password applies within
// seconds at the latest.
const REFEREE_FIELDS = [
  'id', 'displayName', 'username', 'country', 'salt', 'passwordHash',
  'active', 'function', 'assignedCompetitionIds', 'assignedGenderGroups',
];
const REFEREE_CACHE_MS = 3000;

export async function readRefereeList(base44) {
  return await cachedWorkspaceRead(
    'referees:auth',
    () => readWorkspacePages(base44.asServiceRole.entities.Referee, {}, REFEREE_FIELDS),
    REFEREE_CACHE_MS
  );
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  return await sha256Hex(salt + ':' + password);
}

export async function makeToken(referee) {
  return await sha256Hex('tok:' + referee.id + ':' + referee.salt + ':' + referee.passwordHash);
}

// Returns the referee record if the token is valid, otherwise null.
export async function verifyToken(base44, refereeId, token) {
  if (!refereeId || !token) return null;
  // Only a deleted referee invalidates the session. Throttling or a temporary
  // connection failure must propagate, not sign every referee out under load.
  const referee = await base44.asServiceRole.entities.Referee.get(refereeId).catch((error) => {
    if ((error.status || error.response?.status) === 404) return null;
    throw error;
  });
  if (!referee || referee.active === false) return null;
  const expected = await makeToken(referee);
  return expected === token ? referee : null;
}