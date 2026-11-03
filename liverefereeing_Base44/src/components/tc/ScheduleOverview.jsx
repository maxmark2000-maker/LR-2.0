import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { tc } from '@/lib/cubeClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Radio, Lock, ChevronRight } from 'lucide-react';
import TcPanelHeader from '@/components/tc/TcPanelHeader';

const normDist = (d) => String(d || '').toLowerCase().replace(/\s+/g, '');
const normType = (t) => String(t || '').toLowerCase().replace(/[^a-z]/g, '');

const matchRoundType = (roundType, entryType) => {
  if (!entryType) return false;
  const a = normType(roundType);
  const b = normType(entryType);
  if (!a || !b) return false;
  if (a === b) return true;
  if (b === 'finala' && a === 'final') return true;
  return false;
};

const fmtTime = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export default function ScheduleOverview({ competitionId, competitions, races, rounds, onSelectCompetition, onOpenRace }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveRaceId, setLiveRaceId] = useState(null);

  useEffect(() => {
    if (!competitionId) { setEntries([]); setLoading(false); return; }
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const list = await tc.entities.ScheduleEntry.filter({ competitionId });
        // Same order as the schedule table in ORGACube: smallest race number first,
        // rows without a race number last.
        const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : Number.MAX_SAFE_INTEGER);
        list.sort((a, b) => num(a.raceNumber) - num(b.raceNumber));
        if (active) setEntries(list);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [competitionId]);

  // The race pushed live from ORGACube is polled, so the LIVE badge follows
  // ORGACube without a manual refresh. Nothing is polled while the tab is in
  // the background; returning to the tab refreshes immediately.
  useEffect(() => {
    if (!competitionId) return;
    let active = true;
    let busy = false;
    const tick = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const live = await tc.entities.LiveRace.list('-setAt', 1);
        if (active) setLiveRaceId(live[0]?.raceId || null);
      } catch {
        // A throttled poll keeps the last known LIVE badge instead of dropping it.
      } finally {
        busy = false;
      }
    };
    tick();
    // The badge is a convenience only — a slow cadence keeps the shared
    // backend read budget free for the live race lookup in TCCube.
    const timer = setInterval(tick, 20000);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [competitionId]);

  const matchRace = (entry) => {
    const round = rounds.find((r) =>
      r.genderGroup === entry.genderGroup &&
      normDist(r.distance) === normDist(entry.distance) &&
      matchRoundType(r.type, entry.roundType)
    );
    if (!round) return null;
    return races.find((race) => race.roundId === round.id && Number(race.raceNumber) === Number(entry.raceNumber)) || null;
  };

  return (
    <Card className="overflow-hidden border-isu-navy/20 shadow-md">
      <TcPanelHeader
        eyebrow="TCCube · Schedule"
        title="Schedule"
        subtitle="The schedule uploaded in ORGACube, shown here read-only. Open any entry to jump straight to that race in the Race Aggregation. Races are set live or closed in ORGACube only."
      />
      <CardContent className="p-6">

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Select value={competitionId} onValueChange={onSelectCompetition}>
            <SelectTrigger><SelectValue placeholder="Select a competition" /></SelectTrigger>
            <SelectContent>
              {competitions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {!competitionId ? (
          <p className="mt-5 text-sm text-muted-foreground">Select a competition to see its schedule.</p>
        ) : loading ? (
          <p className="mt-5 text-sm text-muted-foreground">Loading schedule…</p>
        ) : entries.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">No schedule uploaded for this competition yet.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-semibold">Time</th>
                  <th className="py-2 pr-3 font-semibold">Race #</th>
                  <th className="py-2 pr-3 font-semibold">Round</th>
                  <th className="py-2 pr-3 font-semibold">Distance</th>
                  <th className="py-2 pr-3 font-semibold">Gender</th>
                  <th className="py-2 pr-3 font-semibold">Label</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const race = matchRace(entry);
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => race && onOpenRace?.(race)}
                      className={`border-b border-border align-middle transition-colors ${race ? 'cursor-pointer hover:bg-accent/50' : 'opacity-70'}`}
                      title={race ? 'Open this race in the Race Aggregation' : 'This race does not exist in the competition yet'}
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3 text-muted-foreground" />{fmtTime(entry.scheduledTime)}</span>
                      </td>
                      <td className="py-2 pr-3 font-mono">{entry.raceNumber ?? '—'}</td>
                      <td className="py-2 pr-3">{entry.roundType || '—'}</td>
                      <td className="py-2 pr-3">{entry.distance || '—'}</td>
                      <td className="py-2 pr-3"><Badge variant="outline" className="uppercase text-[10px] tracking-wider">{entry.genderGroup}</Badge></td>
                      <td className="py-2 pr-3 text-muted-foreground">{entry.label || '—'}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          {race && race.id === liveRaceId && (
                            <span className="text-xs px-2 py-0.5 rounded border border-red-500 text-white bg-red-600 inline-flex items-center gap-1" title="Currently pushed live from ORGACube">
                              <Radio className="w-3 h-3" /> LIVE
                            </span>
                          )}
                          {race?.isClosed && (
                            <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground inline-flex items-center gap-1" title="Closed in ORGACube">
                              <Lock className="w-3 h-3" /> Closed
                            </span>
                          )}
                          {!race && <span className="text-xs text-amber-700">Not created</span>}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {race && (
                          <span className="inline-flex items-center text-xs text-isu-blue font-medium">
                            Open race <ChevronRight className="w-3 h-3" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}