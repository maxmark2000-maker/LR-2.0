import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { orga } from '@/lib/cubeClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Radio, Trash2, Loader2, Clock, RefreshCw, Lock } from 'lucide-react';

const normDist = (d) => String(d || '').toLowerCase().replace(/\s+/g, '');
const normType = (t) => String(t || '').toLowerCase().replace(/[^a-z]/g, '');

const matchRoundType = (roundType, entryType) => {
  if (!entryType) return false;
  const a = normType(roundType);
  const b = normType(entryType);
  if (!a || !b) return false;
  if (a === b) return true;
  // "Final A" on the schedule maps to the "Final" round
  if (b === 'finala' && a === 'final') return true;
  return false;
};

export default function ScheduleManager({ competitionId, races, rounds, onChange, onOpenRace }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [liveBusyId, setLiveBusyId] = useState(null);
  const [livePulseId, setLivePulseId] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [liveRaceId, setLiveRaceId] = useState(null);
  const [closeBusyId, setCloseBusyId] = useState(null);
  const [delBusyId, setDelBusyId] = useState(null);
  const [liveOffBusy, setLiveOffBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let list = await orga.entities.ScheduleEntry.filter({ competitionId });

      // Self-heal: ensure every existing race has a schedule entry, so manually
      // created rounds/races also appear in the schedule (in creation order),
      // even when they were created without one or after a schedule clear.
      // When a race number is overridden, the old entry becomes orphaned (old
      // number) while the race looks unmatched (new number). Instead of creating
      // a duplicate entry, re-link the orphaned entry to the renumbered race.
      if (races && races.length) {
        const findRoundForEntry = (entry) => rounds.find((r) =>
          r.genderGroup === entry.genderGroup &&
          normDist(r.distance) === normDist(entry.distance) &&
          matchRoundType(r.type, entry.roundType)
        );
        const matchedRaceIds = new Set();
        const matchedEntryIds = new Set();
        list.forEach((entry) => {
          const round = findRoundForEntry(entry);
          if (!round) return;
          const race = races.find((rc) => rc.roundId === round.id && Number(rc.raceNumber) === Number(entry.raceNumber));
          if (race) { matchedRaceIds.add(race.id); matchedEntryIds.add(entry.id); }
        });
        const unmatchedRaces = races.filter((r) => !matchedRaceIds.has(r.id));
        if (unmatchedRaces.length) {
          const consumedOrphanIds = new Set();
          const relinkUpdates = [];
          const toCreate = [];
          unmatchedRaces.forEach((race) => {
            const orphan = list.find((e) =>
              !matchedEntryIds.has(e.id) &&
              !consumedOrphanIds.has(e.id) &&
              (() => { const er = findRoundForEntry(e); return er && er.id === race.roundId; })()
            );
            if (orphan) {
              relinkUpdates.push({ id: orphan.id, raceNumber: race.raceNumber });
              consumedOrphanIds.add(orphan.id);
            } else {
              toCreate.push(race);
            }
          });
          if (relinkUpdates.length) {
            await orga.entities.ScheduleEntry.bulkUpdate(relinkUpdates);
          }
          if (toCreate.length) {
            const latest = list.reduce((mx, e) => {
              const t = e.scheduledTime ? new Date(e.scheduledTime).getTime() : 0;
              return t > mx ? t : mx;
            }, Date.now());
            const stepMs = 5 * 60 * 1000;
            await orga.entities.ScheduleEntry.bulkCreate(
              toCreate.map((race, i) => {
                const round = rounds.find((r) => r.id === race.roundId);
                return {
                  competitionId,
                  scheduledTime: new Date(latest + (i + 1) * stepMs).toISOString(),
                  raceNumber: race.raceNumber,
                  roundType: round?.type || '',
                  distance: round?.distance || '',
                  genderGroup: race.genderGroup,
                  label: round ? `${round.type} · ${round.distance} · ${race.genderGroup}` : '',
                };
              })
            );
          }
          if (relinkUpdates.length || toCreate.length) {
            list = await orga.entities.ScheduleEntry.filter({ competitionId });
          }
        }
      }

      // A race owns exactly one schedule row. Uploading the same schedule twice used
      // to leave duplicate rows, which made two rows control the same race. Keep the
      // earliest row per race and drop the extra ones.
      list.sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
      const seenRaceIds = new Set();
      const duplicateIds = [];
      list.forEach((entry) => {
        const race = matchRace(entry);
        if (!race) return;
        if (seenRaceIds.has(race.id)) duplicateIds.push(entry.id);
        else seenRaceIds.add(race.id);
      });
      if (duplicateIds.length) {
        await Promise.all(duplicateIds.map((dupId) => orga.entities.ScheduleEntry.delete(dupId)));
        list = list.filter((entry) => !duplicateIds.includes(entry.id));
      }

      // The table always reads in race order, smallest race number first — the
      // upload order of the file must not decide how the schedule is displayed.
      const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : Number.MAX_SAFE_INTEGER);
      list.sort((a, b) => num(a.raceNumber) - num(b.raceNumber));

      setEntries(list);
    } finally {
      setLoading(false);
    }
  };

  const refreshLive = async () => {
    try {
      const latest = await orga.entities.LiveRace.filter({ competitionId }, '-setAt', 1);
      setLiveRaceId(latest[0]?.raceId || null);
    } catch {
      setLiveRaceId(null);
    }
  };

  useEffect(() => {
    load();
    let busy = false;
    const tick = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try { await refreshLive(); } finally { busy = false; }
    };
    tick();
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, [competitionId]);

  // Ends live mode: clears the pushed race so no LiveRefereeing account is
  // pointed at a live race any more. All records are removed on purpose — the
  // referees always follow the most recently pushed race.
  const endLive = async () => {
    if (!window.confirm('End live mode? Referees will no longer be pointed at a live race.')) return;
    setLiveOffBusy(true);
    try {
      await orga.entities.LiveRace.deleteMany({});
      setLiveRaceId(null);
    } finally {
      setLiveOffBusy(false);
    }
  };

  const matchRace = (entry) => {
    const round = rounds.find((r) =>
      r.genderGroup === entry.genderGroup &&
      normDist(r.distance) === normDist(entry.distance) &&
      matchRoundType(r.type, entry.roundType)
    );
    if (!round) return null;
    return races.find((race) => race.roundId === round.id && Number(race.raceNumber) === Number(entry.raceNumber)) || null;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setParseResult(null);
    setParsing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await orga.invoke('parseSchedule', { competitionId, fileUrl: file_url });
      if (res.data?.error) {
        setError(res.data.error);
      } else {
        setParseResult(res.data);
      }
      await load();
      if (onChange) onChange();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
      if (onChange) await onChange();
    } finally {
      setRefreshing(false);
    }
  };

  const goLive = async (entry) => {
    const race = matchRace(entry);
    if (!race) return;
    setLiveBusyId(entry.id);
    try {
      await orga.entities.LiveRace.create({
        competitionId: race.competitionId,
        raceId: race.id,
        roundId: race.roundId,
        genderGroup: race.genderGroup,
        raceNumber: race.raceNumber,
        setAt: new Date().toISOString(),
      });
      // Show the LIVE badge straight away — waiting for the 15s poll made a
      // successful push look like nothing happened.
      setLiveRaceId(race.id);
      setLivePulseId(entry.id);
      setTimeout(() => setLivePulseId(null), 2500);
    } finally {
      setLiveBusyId(null);
    }
  };

  const toggleClose = async (entry) => {
    const race = matchRace(entry);
    if (!race) return;
    // Closing locks referee calls, so it asks first — reopening never does.
    if (!race.isClosed) {
      const ok = window.confirm(
        `Close race #${entry.raceNumber ?? ''} (${entry.roundType || '—'} ${entry.distance || ''} ${entry.genderGroup || ''})?\n` +
        'Referees can no longer submit calls for this race.'
      );
      if (!ok) return;
    }
    setCloseBusyId(entry.id);
    try {
      await orga.entities.Race.update(race.id, { isClosed: !race.isClosed });
      if (onChange) await onChange();
    } finally {
      setCloseBusyId(null);
    }
  };

  const removeEntry = async (entry) => {
    const race = matchRace(entry);
    const ok = window.confirm(
      `Delete race #${entry.raceNumber ?? ''} (${entry.roundType || '—'} ${entry.distance || ''})?\n` +
      `This removes it from the schedule` +
      `${race ? ', the race and its calls' : ''}` +
      `${race && races.filter((r) => r.roundId === race.roundId && r.id !== race.id).length === 0 ? ', and the round (no other races left)' : ''}.`
    );
    if (!ok) return;
    setDelBusyId(entry.id);
    try {
      await orga.entities.ScheduleEntry.delete(entry.id);
      if (race) {
        try { await orga.entities.Call.deleteMany({ raceId: race.id }); } catch { /* no calls */ }
        await orga.entities.Race.delete(race.id);
        const siblingRaces = races.filter((r) => r.roundId === race.roundId && r.id !== race.id);
        if (!siblingRaces.length) {
          try { await orga.entities.Round.delete(race.roundId); } catch { /* round already gone */ }
        }
      }
      await load();
      if (onChange) await onChange();
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setDelBusyId(null);
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      await orga.entities.ScheduleEntry.deleteMany({ competitionId });
      await load();
      if (onChange) onChange();
    } finally {
      setClearing(false);
    }
  };

  const fmtTime = (iso) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-heading font-bold text-lg">Schedule</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload the official schedule (PDF, Excel or image). The AI extracts every race entry with its planned time.
              Create the matching rounds and races under &ldquo;Rounds &amp; races&rdquo;, then push any race live directly from here.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <label className="inline-flex items-center gap-2 bg-isu-blue hover:bg-isu-navy text-white text-sm font-medium px-4 py-2 rounded-md cursor-pointer">
              {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {parsing ? 'Parsing…' : 'Upload schedule'}
              <input type="file" accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg" className="hidden" onChange={handleFile} disabled={parsing} />
            </label>
            {entries.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearAll} disabled={clearing}>
                <Trash2 className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
            {liveRaceId && (
              <Button
                variant="outline"
                size="sm"
                onClick={endLive}
                disabled={liveOffBusy}
                className="border-red-400 text-red-700 hover:bg-red-50 hover:text-red-700"
              >
                <Radio className="w-4 h-4 mr-1" /> End live mode
              </Button>
            )}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        {parseResult && (
          <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
            Imported {parseResult.created} entries, {parseResult.rounds} rounds and {parseResult.races} races
            {parseResult.skipped?.length ? ` · ${parseResult.skipped.length} skipped (unrecognized round/distance)` : ''}.
          </p>
        )}

        {loading ? (
          <p className="mt-5 text-sm text-muted-foreground">Loading schedule…</p>
        ) : entries.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">No schedule uploaded yet.</p>
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
                  <th className="py-2 pr-3 font-semibold text-center whitespace-nowrap">Live / Close</th>
                  <th className="py-2 pl-3 font-semibold text-center whitespace-nowrap w-px">Delete</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const race = matchRace(entry);
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => onOpenRace?.(race || null)}
                      className="border-b border-border align-middle cursor-pointer hover:bg-accent/50 transition-colors"
                      title={race ? 'Open this race in Rounds & races to assign athletes' : 'Open Rounds & races to create this race'}
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3 text-muted-foreground" />{fmtTime(entry.scheduledTime)}</span>
                      </td>
                      <td className="py-2 pr-3 font-mono">{entry.raceNumber ?? '—'}</td>
                      <td className="py-2 pr-3">{entry.roundType || '—'}</td>
                      <td className="py-2 pr-3">{entry.distance || '—'}</td>
                      <td className="py-2 pr-3"><Badge variant="outline" className="uppercase text-[10px] tracking-wider">{entry.genderGroup}</Badge></td>
                      <td className="py-2 pr-3 text-muted-foreground">{entry.label || '—'}</td>
                      <td className="py-2 pr-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2 justify-center">
                          {race ? (
                            <>
                              {race.id === liveRaceId ? (
                                <span className="text-xs px-2 py-1 rounded border border-red-500 text-white bg-red-600 inline-flex items-center gap-1 animate-pulse" title="This race is currently pushed to all LiveRefereeing accounts">
                                  <Radio className="w-3 h-3" /> LIVE
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => goLive(entry)}
                                  disabled={liveBusyId === entry.id}
                                  className={`text-xs px-2 py-1 rounded border inline-flex items-center gap-1 ${livePulseId === entry.id ? 'border-red-500 text-red-600 bg-red-50 animate-pulse' : 'border-isu-blue text-white bg-isu-blue hover:bg-isu-navy'}`}
                                  title="Push this race to all LiveRefereeing accounts"
                                >
                                  <Radio className="w-3 h-3" /> LIVE
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleClose(entry)}
                                disabled={closeBusyId === entry.id}
                                className={`text-xs px-2 py-1 rounded border inline-flex items-center gap-1 ${race.isClosed ? 'border-border text-muted-foreground hover:bg-secondary' : 'border-amber-400 text-amber-800 hover:bg-amber-50'}`}
                                title={race.isClosed ? 'Reopen this race for referee calls' : 'Close this race and lock referee calls'}
                              >
                                {race.isClosed ? <><Lock className="w-3 h-3" /> Reopen</> : 'Close race'}
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1" title="Create the matching round and race under Rounds & races first">
                              Race not created yet
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pl-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => removeEntry(entry)}
                          disabled={delBusyId === entry.id}
                          className="text-xs px-2 py-1 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"
                          title="Delete this race from schedule, races and round"
                        >
                          {delBusyId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Delete
                        </button>
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