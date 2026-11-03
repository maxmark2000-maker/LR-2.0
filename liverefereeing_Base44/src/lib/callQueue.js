import { base44 } from '@/api/base44Client';

const KEY = 'liveRefereeingCallQueue';
const BATCH_SIZE = 50;

const keyOf = (c) => `${c.raceId}|${c.athleteId || ''}|${c.mark || ''}`;

export function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function writeQueue(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Queue a call. A newer entry for the same race + athlete + mark replaces the
// older one, so a repeated submit or a correction never stacks up duplicates
// that would later be sent twice.
export function enqueue(call) {
  const items = readQueue().filter((c) => keyOf(c) !== keyOf(call));
  items.push(call);
  writeQueue(items);
  return items;
}

// Sends queued calls in batches; keeps anything unsent locally when a request
// fails. Only the batches that actually went through are cleared, so a queue
// larger than the per-request limit can never be silently truncated.
export async function flushQueue(session) {
  const empty = { closed: 0, notAssigned: 0, unknownRace: 0 };
  if (readQueue().length === 0) return { sent: 0, remaining: 0, rejected: empty };
  let sent = 0;
  const rejected = { ...empty };
  try {
    while (true) {
      const current = readQueue();
      if (current.length === 0) break;
      const batch = current.slice(0, BATCH_SIZE);
      const res = await base44.functions.invoke('refereeSubmitCalls', {
        refereeId: session.referee.id,
        token: session.token,
        calls: batch,
      });
      if (res.data?.error) return { sent, remaining: readQueue().length, rejected, error: res.data.error };
      // The batch is cleared either way: a call the server refused (closed race,
      // no longer assigned, race deleted) can never be accepted later, so keeping
      // it would block the queue forever. The reason is passed on to the referee.
      const r = res.data.rejected || {};
      rejected.closed += r.closed || 0;
      rejected.notAssigned += r.notAssigned || 0;
      rejected.unknownRace += r.unknownRace || 0;
      writeQueue(current.slice(batch.length));
      sent += res.data.processed ?? batch.length;
    }
    return { sent, remaining: 0, rejected };
  } catch (e) {
    // A 401 means the referee session is gone, not a network problem: report it
    // so the page can return to the sign-in card instead of retrying forever.
    const expired = e?.response?.status === 401 || e?.status === 401;
    return { sent, remaining: readQueue().length, rejected, error: expired ? 'session_expired' : 'Offline — calls kept locally.' };
  }
}