// Server-side gate credentials for the ORGACube and TCCube access gates.
// Only salted hashes live here — the plaintext passwords never reach the
// browser bundle or this file, so they cannot be read in the browser dev tools.

import { sha256Hex } from './refereeAuth.ts';

const GATES: Record<string, { salt: string; hash: string }> = {
  orga: {
    salt: 'a3f1c9d24b7e5068',
    hash: '7d0b9dfaa2d9be8b7e382ac0949954ae3ec51a18a559bb45de55cb6712bfd4e3',
  },
  tc: {
    salt: '7d2b8e14f9c3065a',
    hash: '6c14cf2acee84cafef36b146d0e0011a13ba7f2473b9104e9266ca63f0829505',
  },
};

export function isGate(gate: string): boolean {
  return !!GATES[gate];
}

// The session token handed to the browser after a correct password. It is
// derived from the password hash, so it can only be produced server-side.
export async function makeGateToken(gate: string): Promise<string | null> {
  const g = GATES[gate];
  if (!g) return null;
  return await sha256Hex('cube:' + gate + ':' + g.hash);
}

export async function verifyGatePassword(gate: string, password: string): Promise<boolean> {
  const g = GATES[gate];
  if (!g || !password) return false;
  const hash = await sha256Hex(g.salt + ':' + password);
  return hash === g.hash;
}

export async function verifyGateToken(gate: string, token: string): Promise<boolean> {
  if (!gate || !token) return false;
  const expected = await makeGateToken(gate);
  return !!expected && expected === token;
}