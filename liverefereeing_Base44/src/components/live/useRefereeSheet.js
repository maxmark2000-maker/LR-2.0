import { useCallback, useEffect, useRef, useState } from 'react';
import invokeWorkspace from '@/lib/refereeRequest';

export default function useRefereeSheet(session, competitionId, raceId, onExpired) {
  const [entry, setEntry] = useState({ key: '', data: null, error: '' });
  const generation = useRef(0);
  const key = session && competitionId && raceId ? `${session.referee.id}:${competitionId}:${raceId}` : '';
  const load = useCallback(async () => {
    if (!key) return;
    const current = ++generation.current;
    setEntry({ key, data: null, error: '' });
    try {
      const response = await invokeWorkspace({
        refereeId: session.referee.id, token: session.token, competitionId, raceId, mode: 'sheet',
      });
      if (current !== generation.current) return;
      if (response.data?.error) throw new Error(response.data.error);
      setEntry({ key, data: response.data, error: '' });
    } catch (error) {
      if (current !== generation.current) return;
      if ((error?.response?.status || error?.status) === 401) onExpired();
      else setEntry({ key, data: null, error: error?.response?.data?.error || error.message || 'The call sheet could not be loaded.' });
    }
  }, [key, session, competitionId, raceId, onExpired]);
  useEffect(() => {
    load();
    return () => { generation.current += 1; };
  }, [load]);
  const setSheet = useCallback((update) => setEntry((prev) => {
    if (prev.key !== key || !prev.data) return prev;
    return { ...prev, data: typeof update === 'function' ? update(prev.data) : update };
  }), [key]);
  const active = entry.key === key;
  return {
    sheet: active ? entry.data : null,
    loading: !!key && (!active || (!entry.data && !entry.error)),
    error: active ? entry.error : '',
    load, setSheet,
  };
}