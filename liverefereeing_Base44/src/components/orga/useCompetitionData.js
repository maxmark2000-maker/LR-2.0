import { useCallback, useEffect, useRef, useState } from 'react';
import { orga } from '@/lib/cubeClient';

const EMPTY = { competition: null, athletes: [], rounds: [], races: [] };

export default function useCompetitionData(id, enabled, pollRaces) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (!enabled) return;
    const current = generation.current;
    try {
      const [competition, athletes, rounds, races] = await Promise.all([
        orga.entities.Competition.get(id), orga.entities.Athlete.filter({ competitionId: id }),
        orga.entities.Round.filter({ competitionId: id }), orga.entities.Race.filter({ competitionId: id }),
      ]);
      if (current !== generation.current) return;
      setData({ competition, athletes, rounds, races }); setError(null);
    } catch (cause) {
      if (current === generation.current) setError(cause?.response?.data?.error || cause?.message || 'Could not load this competition.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [id, enabled]);
  useEffect(() => {
    setData(EMPTY); setLoading(true); setError(null);
    if (enabled) load();
    return () => { generation.current += 1; };
  }, [load, enabled]);
  useEffect(() => {
    if (!enabled || loading || error || !pollRaces) return;
    let active = true; let busy = false;
    const tick = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const fresh = await orga.entities.Race.filter({ competitionId: id });
        const states = new Map(fresh.map((race) => [race.id, !!race.isClosed]));
        if (active) setData((prev) => ({ ...prev, races: prev.races.map((race) => states.has(race.id) ? { ...race, isClosed: states.get(race.id) } : race) }));
      } catch { /* Preserve the last confirmed race state on a dropped refresh. */ }
      finally { busy = false; }
    };
    const timer = setInterval(tick, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [id, enabled, loading, error, pollRaces]);
  return { ...data, loading, error, load, retry: () => { setLoading(true); return load(); } };
}