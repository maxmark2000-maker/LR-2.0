/**
 * Server-only ORGACube / TCCube authentication.
 *
 * Secrets (configure in Base44 backend, not in VITE_-prefixed frontend variables):
 *   ORGA_CUBE_PASSWORD_HASH = pbkdf2-sha256$100000$<salt hex>$<hash hex>
 *   TC_CUBE_PASSWORD_HASH   = pbkdf2-sha256$100000$<salt hex>$<hash hex>
 *   CUBE_SESSION_SECRET     = <at least 32 random bytes encoded as hex>
 *
 * The password is sent from the browser to cubeLogin over HTTPS for verification;
 * the password and the server-side secrets are never included in its response.
 * No credentials are hard-coded in the source repository.
 */

import { secrets } from 'base44:runtime';

const GATE_HASH_SECRET = {
  orga: 'ORGA_CUBE_PASSWORD_HASH',
  tc: 'TC_CUBE_PASSWORD_HASH',
} as const;
const SESSION_SECRET_NAME = 'CUBE_SESSION_SECRET';
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const PBKDF2_MIN_ITERATIONS = 100000;
const PBKDF2_MAX_ITERATIONS = 100000; // Base44-Laufzeitlimit, ausschließlich für den Test
const enc = new TextEncoder();

// Base44 Secrets werden pro Aufruf im Backend aus dem Runtime-Kontext gelesen.
// Keinesfalls Werte in den Quellcode oder Browser schreiben.
function secret(name: string): string {
  const value = secrets.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

// WebCrypto requires an ArrayBuffer-backed BufferSource. Copying ensures
// compatibility with TypeScript DOM declarations that distinguish ArrayBuffer
// from SharedArrayBuffer-backed Uint8Array views.
function webCryptoBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(input: string): Uint8Array | null {
  if (input.length % 2 !== 0 || !/^[a-f0-9]+$/i.test(input)) return null;
  return new Uint8Array((input.match(/../g) || []).map((chunk) => Number.parseInt(chunk, 16)));
}

// Comparison without early-exiting on a differing character.
function equalHex(left: string, right: string): boolean {
  if (left.length !== right.length || left.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export function isGate(gate: string): boolean {
  return Object.prototype.hasOwnProperty.call(GATE_HASH_SECRET, gate);
}

function passwordRecord(gate: string): string {
  const variable = GATE_HASH_SECRET[gate as keyof typeof GATE_HASH_SECRET];
  if (!variable) throw new Error('Unknown cube');
  const record = secret(variable);
  if (!record) throw new Error(`Missing secret: ${variable}`);
  return record;
}

async function verifyPbkdf2(password: string, record: string): Promise<boolean> {
  const [algorithm, iterationsText, saltHex, hashHex, ...extras] = record.split('$');
  if (extras.length || algorithm !== 'pbkdf2-sha256') return false;
  const iterations = Number(iterationsText);
  const salt = fromHex(saltHex || '');
  if (!Number.isInteger(iterations) || iterations < PBKDF2_MIN_ITERATIONS || iterations > PBKDF2_MAX_ITERATIONS ||
      !salt || salt.length < 16 || !/^[a-f0-9]{64}$/i.test(hashHex || '')) return false;
  const key = await crypto.subtle.importKey('raw', webCryptoBuffer(enc.encode(password)), 'PBKDF2', false, ['deriveBits']);
  const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: webCryptoBuffer(salt), iterations }, key, 256);
  return equalHex(hex(new Uint8Array(result)), hashHex.toLowerCase());
}

export async function verifyGatePassword(gate: string, password: string): Promise<boolean> {
  if (!isGate(gate) || !password || password.length > 1024) return false;
  return verifyPbkdf2(password, passwordRecord(gate));
}

async function signature(gate: string, payload: string): Promise<string> {
  // The password record is included in the authenticated message (never sent
  // to the browser). A password rotation immediately invalidates old tokens,
  // even if CUBE_SESSION_SECRET is not rotated at the same time.
  const record = passwordRecord(gate);
  const secretBytes = fromHex(secret(SESSION_SECRET_NAME));
  if (!secretBytes || secretBytes.length < 32) throw new Error(`Missing or invalid secret: ${SESSION_SECRET_NAME}`);
  const key = await crypto.subtle.importKey('raw', webCryptoBuffer(secretBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const data = enc.encode(`${payload}\n${record}`);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, webCryptoBuffer(data))));
}

export async function makeGateToken(gate: string): Promise<string | null> {
  if (!isGate(gate)) return null;
  const expiry = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)));
  // Bumping the version string invalidates every token issued before it:
  // all cube users are signed out and must enter the password again.
  const payload = `v2.${gate}.${expiry}.${nonce}`;
  return `${payload}.${await signature(gate, payload)}`;
}

export async function verifyGateToken(gate: string, token: string): Promise<boolean> {
  if (!isGate(gate) || !token || token.length > 300) return false;
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== 'v2' || parts[1] !== gate ||
      !/^\d{10,12}$/.test(parts[2]) || !/^[a-f0-9]{32}$/.test(parts[3]) ||
      !/^[a-f0-9]{64}$/.test(parts[4])) return false;
  const now = Math.floor(Date.now() / 1000);
  const expires = Number(parts[2]);
  if (expires <= now || expires > now + SESSION_LIFETIME_SECONDS) return false;
  const payload = parts.slice(0, 4).join('.');
  // Fail closed if secrets are removed or malformed.
  try {
    return equalHex(parts[4], await signature(gate, payload));
  } catch {
    return false;
  }
}