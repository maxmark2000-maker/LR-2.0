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

// Versioned password storage. New/refreshed passwords use PBKDF2-SHA256.
// Base44 currently imposes a 100,000-iteration limit. This is a transitional
// compatibility measure, NOT the target for a future independent backend.
const REFEREE_PBKDF2_ITERATIONS = 100000;
const textEncoder = new TextEncoder();

function toArrayBuffer(bytes) {
  const output = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(output).set(bytes);
  return output;
}

function fromHex(value) {
  if (typeof value !== 'string' || value.length % 2 || !/^[0-9a-f]+$/i.test(value)) return null;
  return new Uint8Array((value.match(/../g) || []).map((piece) => parseInt(piece, 16)));
}

function equalHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export async function hashPassword(password, salt) {
  const saltBytes = fromHex(salt);
  if (!saltBytes || saltBytes.length < 16) throw new Error('Invalid referee salt');
  const baseKey = await crypto.subtle.importKey('raw', toArrayBuffer(textEncoder.encode(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: toArrayBuffer(saltBytes), iterations: REFEREE_PBKDF2_ITERATIONS, hash: 'SHA-256' }, baseKey, 256);
  const hashHex = Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2-sha256$${REFEREE_PBKDF2_ITERATIONS}$${salt}$${hashHex}`;
}

export async function verifyPassword(password, referee) {
  if (!password || !referee || typeof referee.passwordHash !== 'string') return false;
  const stored = referee.passwordHash;
  if (stored.startsWith('pbkdf2-sha256$')) {
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[1] !== String(REFEREE_PBKDF2_ITERATIONS) ||
      !/^[a-f0-9]{32}$/i.test(parts[2]) || !/^[a-f0-9]{64}$/i.test(parts[3])) return false;
    return equalHex(await hashPassword(password, parts[2]), stored.toLowerCase());
  }
  // Existing accounts remain usable until their password is deliberately reset.
  // A successful reset replaces this legacy salted-SHA256 hash with PBKDF2.
  if (!/^[0-9a-f]{64}$/i.test(stored) || !referee.salt) return false;
  return equalHex(await sha256Hex(referee.salt + ':' + password), stored.toLowerCase());
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