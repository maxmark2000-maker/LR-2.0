import { base44 } from '@/api/base44Client';

// Gated data client for ORGACube and TCCube.
//
// Every read and write goes through a backend function that checks the gate
// session token server-side, so the entities themselves stay closed to direct
// access and no data reaches the browser without the gate password.

const DATA_FUNCTION = { orga: 'orgaData', tc: 'tcData' };

const tokenKey = (gate) => `cube_token_${gate}`;

export function cubeToken(gate) {
  try { return sessionStorage.getItem(tokenKey(gate)) || null; } catch { return null; }
}

function storeToken(gate, token) {
  try { sessionStorage.setItem(tokenKey(gate), token); } catch { /* ignore */ }
}

export function clearCubeToken(gate) {
  try { sessionStorage.removeItem(tokenKey(gate)); } catch { /* ignore */ }
}

// Pages subscribe here so an expired gate session drops them back to the unlock
// screen instead of surfacing a raw gateway error.
const lockListeners = { orga: new Set(), tc: new Set() };

export function onGateLocked(gate, listener) {
  lockListeners[gate].add(listener);
  return () => lockListeners[gate].delete(listener);
}

function lockGate(gate) {
  clearCubeToken(gate);
  lockListeners[gate].forEach((listener) => listener());
}

// A 401 from the gateway means the session token is gone or no longer valid:
// clear it and tell the page to show the unlock screen again.
function gateError(gate, error) {
  if (error?.response?.status === 401) {
    lockGate(gate);
    const err = new Error(error.response?.data?.error || 'Session expired. Please unlock again.');
    err.code = 'GATE_LOCKED';
    return err;
  }
  return error;
}

async function login(gate, password) {
  const res = await base44.functions.invoke('cubeLogin', { gate, password });
  if (res.data?.error) throw new Error(res.data.error);
  storeToken(gate, res.data.token);
  return res.data.token;
}

// Every cube read runs with the service role and therefore shares one backend
// read budget with all referees and both cubes. When that budget is momentarily
// used up the gateway answers "Rate limit exceeded ... Retry after 1s" — a
// short wait clears it, so waiting and asking again beats showing an empty page.
const isRateLimit = (error) =>
  error?.response?.status === 500 &&
  /rate limit/i.test(String(error?.response?.data?.error || error?.message || ''));

async function withRateLimitRetry(run, attempts = 4) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await run();
    } catch (error) {
      if (!isRateLimit(error)) throw error;
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 1200 * (i + 1)));
    }
  }
  throw last;
}

async function call(gate, entity, op, args, fresh = false) {
  let res;
  try {
    res = await withRateLimitRetry(() => base44.functions.invoke(DATA_FUNCTION[gate], {
      token: cubeToken(gate),
      entity,
      op,
      args,
      fresh,
    }));
  } catch (error) {
    throw gateError(gate, error);
  }
  if (res.data?.error) throw new Error(res.data.error);
  return res.data.result;
}

async function invoke(gate, name, payload) {
  let res;
  try {
    res = await withRateLimitRetry(() => base44.functions.invoke(name, { ...payload, token: cubeToken(gate) }));
  } catch (error) {
    throw gateError(gate, error);
  }
  if (res.data?.error) throw new Error(res.data.error);
  // Callers read the payload as res.data (like base44.functions.invoke does), so
  // the whole response is handed back — returning res.data here left every caller
  // reading res.data.data, which came back empty.
  return res;
}

// `fresh` skips the gateway's short-lived cache, so an explicit Refresh always
// shows what referees have submitted a moment ago.
function makeEntities(gate, fresh = false) {
  return new Proxy({}, {
    get: (_target, entity) => ({
      list: (...args) => call(gate, entity, 'list', args, fresh),
      filter: (...args) => call(gate, entity, 'filter', args, fresh),
      get: (...args) => call(gate, entity, 'get', args, fresh),
      create: (...args) => call(gate, entity, 'create', args),
      update: (...args) => call(gate, entity, 'update', args),
      updateMany: (...args) => call(gate, entity, 'updateMany', args),
      delete: (...args) => call(gate, entity, 'delete', args),
      bulkCreate: (...args) => call(gate, entity, 'bulkCreate', args),
      bulkUpdate: (...args) => call(gate, entity, 'bulkUpdate', args),
      deleteMany: (...args) => call(gate, entity, 'deleteMany', args),
      count: (...args) => call(gate, entity, 'count', args, fresh),
    }),
  });
}

function makeGate(gate) {
  return {
    login: (password) => login(gate, password),
    logout: () => clearCubeToken(gate),
    hasSession: () => !!cubeToken(gate),
    invoke: (name, payload) => invoke(gate, name, payload),
    entities: makeEntities(gate),
    freshEntities: makeEntities(gate, true),
  };
}

export const orga = makeGate('orga');
export const tc = makeGate('tc');