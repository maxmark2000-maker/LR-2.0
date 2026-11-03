import { base44 } from '@/api/base44Client';

// A throttled workspace read waits the announced time and tries once more, so a
// referee never has to reload the page just because colleagues opened their
// sheets at the same moment.
const waitSeconds = (error) => {
  const data = error?.response?.data || {};
  const direct = Number(data.retryAfterSeconds || error?.response?.headers?.['retry-after']);
  if (direct > 0) return Math.min(15, direct);
  const message = String(data.error || error?.message || '');
  return Math.min(15, Number(message.match(/Retry after (\d+)s/i)?.[1]) || 2);
};

export default async function invokeWorkspace(payload) {
  try {
    return await base44.functions.invoke('refereeWorkspace', payload);
  } catch (error) {
    const status = error?.response?.status || error?.status;
    if (status !== 429) throw error;
    await new Promise((resolve) => setTimeout(resolve, waitSeconds(error) * 1000 + 300));
    return base44.functions.invoke('refereeWorkspace', payload);
  }
}