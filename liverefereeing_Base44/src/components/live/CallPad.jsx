import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import CallCodeSelect from '@/components/live/CallCodeSelect';
import { athleteLabel, isMixedAthlete, findYc2Athletes, callTone } from '@/lib/isu';
import MarkZoneIndicator from '@/components/live/MarkZoneIndicator';
import { trackZoneFromCode } from '@/lib/trackZones';
import { Send, Eraser, Ban, Lock, Info, Tv, ListOrdered, X } from 'lucide-react';
import CountryFlag from '@/components/tc/CountryFlag';
import { parseMarkCountries, MarkCountryFocus } from '@/components/MarkCountries';

const MARKS = ['MARK1', 'MARK2', 'MARK3', 'MARK4', 'MARK5'];
const SHORT_MARKS = { MARK1: 'M1', MARK2: 'M2', MARK3: 'M3', MARK4: 'M4', MARK5: 'M5' };
const emptyDraft = () => ({ marks: { MARK1: '', MARK2: '', MARK3: '', MARK4: '', MARK5: '' } });

export default function CallPad({ athletes, onSubmit, submitting, submittedCalls = [], pending = [], locked = false, roundType = '', distance = '', genderGroup = '', raceNumber = '', raceId = '', markCountries = '' }) {
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');
  const [activeMark, setActiveMark] = useState(null);
  const markFocus = parseMarkCountries(markCountries);
  const markHeaderRefs = useRef({});
  // The track zone is metadata of the MARK: once a mark is known to have happened
  // in a zone, a later decision without a location (SR, ADV, …) keeps the marker
  // where it is. This cache is per race and only used for rendering.
  const zoneMemory = useRef({ raceId: null, zones: {} });
  if (zoneMemory.current.raceId !== raceId) zoneMemory.current = { raceId, zones: {} };

  const draftOf = (id) => drafts[id] || emptyDraft();
  const setMark = (id, mark, value) =>
    setDrafts((d) => ({ ...d, [id]: { ...draftOf(id), marks: { ...draftOf(id).marks, [mark]: value } } }));

  const submittedMap = {};
  submittedCalls.forEach((c) => { if (c.athleteId && c.mark) submittedMap[`${c.athleteId}|${c.mark}`] = c; });
  const pendingMap = {};
  pending.forEach((c) => { if (c.athleteId && c.mark) pendingMap[`${c.athleteId}|${c.mark}`] = c; });

  // One summary per MARK for the shared track overview: the codes entered for that
  // mark and the physical zone they belong to. A code without a zone never
  // overrides a zone the mark already had.
  const markInfo = MARKS.map((mark) => {
    const entries = [];
    submittedCalls.forEach((c) => { if (c.mark === mark && c.callCode) entries.push({ ...c, source: 'submitted' }); });
    pending.forEach((c) => { if (c.mark === mark && c.callCode) entries.push({ ...c, source: 'pending' }); });
    athletes.forEach((a) => {
      const code = draftOf(a.id).marks[mark];
      if (code) entries.push({ callCode: code, athleteId: a.id, helmetNumber: a.helmetNumber, source: 'draft' });
    });

    const located = entries.find((e) => trackZoneFromCode(e.callCode)) || null;
    const primary = located || entries[0] || null;
    if (located) zoneMemory.current.zones[mark] = trackZoneFromCode(located.callCode);
    const athlete = primary?.athleteId ? athletes.find((a) => a.id === primary.athleteId) : null;

    return {
      mark,
      short: SHORT_MARKS[mark],
      zone: zoneMemory.current.zones[mark] || null,
      code: primary?.callCode || null,
      helmetNumber: primary?.helmetNumber || athlete?.helmetNumber || null,
      athleteName: athlete ? athleteLabel(athlete) : null,
      submitted: entries.some((e) => e.source === 'submitted'),
    };
  });

  // Linking the track and the sheet: selecting a MARK from either side highlights
  // the same mark in the other one and scrolls its column into view.
  const selectMark = (mark) => {
    setActiveMark((prev) => (prev === mark ? null : mark));
    const el = markHeaderRefs.current[mark];
    if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const raceLevelCall = submittedCalls.find((c) => !c.athleteId && !c.mark);
  const raceLevelPending = pending.find((c) => !c.athleteId && !c.mark);

  const collect = () => {
    const calls = [];
    for (const a of athletes) {
      const draft = draftOf(a.id);
      for (const mark of MARKS) {
        const code = draft.marks[mark];
        if (code) {
          calls.push({
            athleteId: a.id,
            helmetNumber: a.helmetNumber,
            callCode: code,
            mark,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    return calls;
  };

  const reportResult = (result) => {
    if (result && result.queued) {
      setError('Offline — your calls are queued locally and will be sent when you reconnect.');
      return;
    }
    if (!result || result.sent > 0) {
      setDrafts({});
      setError('');
      return;
    }
    // sent === 0 — distinguish a connection/session issue (calls still held
    // locally) from calls the backend refused, and report the actual reason the
    // backend gave instead of blaming a closed race for every case.
    if (result.remaining > 0) {
      setError('Your calls could not be sent right now due to a connection or session issue. They are kept locally — press "Send all calls" again in a moment.');
      return;
    }
    const rejected = result.rejected || {};
    if (rejected.unknownRace > 0 || rejected.notAssigned > 0) {
      setError('These calls could not be saved: the race is no longer available to you in ORGACube (it may have been deleted, or your assignment for this competition changed). Please select the race again.');
      return;
    }
    if (rejected.closed > 0) {
      setError('This race is closed. Your calls could not be submitted — you were too late. The race was already closed by ORGACube.');
      return;
    }
    setError('Nothing was submitted. Please enter your calls again.');
  };

  const submitAll = async () => {
    const calls = collect();
    const hasQueued = pending.some((c) => c.athleteId);
    if (calls.length === 0 && !hasQueued) {
      setError('Enter at least one call before sending.');
      return;
    }
    setError('');
    // When there are no new drafts but queued (yellow) calls exist, re-send the
    // queue instead of erroring — otherwise a flaky connection leaves the referee
    // unable to retry stuck calls.
    const result = await onSubmit(calls);
    reportResult(result);
  };

  const submitRaceNoCall = async () => {
    setError('');
    const result = await onSubmit([{ callCode: 'NO CALL', mark: '', athleteId: null, helmetNumber: '', notes: '', timestamp: new Date().toISOString() }]);
    reportResult(result);
  };

  const clearAll = () => { setDrafts({}); setError(''); };

  const hasDrafts = Object.values(drafts).some((d) => Object.values(d.marks).some(Boolean));
  const raceNoCallExists = !!raceLevelCall || !!raceLevelPending;

  return (
    <div>
      <div className="relative overflow-hidden bg-gradient-to-r from-isu-navy via-isu-navy to-isu-blue px-6 py-5 text-white">
        <div className="pointer-events-none absolute -right-10 -top-20 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-24 h-40 w-40 rounded-full bg-isu-light/25 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <div className="mr-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-isu-light">Referee call sheet</p>
              <h3 className="mt-2 font-heading text-2xl font-bold leading-none">Call sheet</h3>
            </div>
            {raceNumber && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Race {raceNumber}</span>}
            {roundType && <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">{roundType}</span>}
            {distance && <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">{distance}</span>}
            {genderGroup && <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">{genderGroup}</span>}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={submitting || locked || !hasDrafts}
            className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            <Eraser className="w-4 h-4 mr-1" /> Clear
          </Button>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-isu-blue" />
            <span>Enter a call code per athlete and mark, then send everything at once. Already submitted calls are shown inline.</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-amber-800">
            <Tv className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
            <span><span className="font-semibold">Each MARK = one Yellow Box</span> in the livestream.</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ListOrdered className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Athlete order here does <span className="font-medium text-foreground">not</span> reflect the official Start List order.</span>
          </div>
        </div>

        {locked && (
          <div className="mt-3 flex items-center gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <Lock className="w-4 h-4" /> This race is closed. Calls can no longer be submitted or changed.
          </div>
        )}

        {raceNoCallExists && (
          <div className="mt-3 flex items-center gap-2 rounded border border-border bg-secondary/40 p-3 text-sm">
            <Ban className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">NO CALL for this race</span>
            {raceLevelPending && <span className="text-xs text-amber-700">— queued</span>}
            {raceLevelCall && <span className="text-xs text-muted-foreground">— submitted</span>}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        {athletes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No athletes assigned to this race.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[760px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-2 font-semibold w-[6%]">#</th>
                  <th className="py-2 pr-2 font-semibold w-[29%]">Athlete</th>

                  {MARKS.map((m) => {
                    const isActive = activeMark === m;
                    const info = markInfo.find((i) => i.mark === m);
                    return (
                      <th
                        key={m}
                        ref={(el) => { markHeaderRefs.current[m] = el; }}
                        className={`py-2 px-1 font-semibold text-center w-[13%] transition-colors ${isActive ? 'border-x border-isu-blue/30 bg-accent/60' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => selectMark(m)}
                          title={`Show ${m} on the track`}
                          className={`mx-auto flex w-full flex-col items-center gap-0.5 rounded border px-1 py-1 transition-colors ${isActive ? 'border-isu-blue/60 bg-accent text-foreground' : 'border-border bg-secondary/40 text-muted-foreground hover:border-isu-blue/40 hover:bg-accent/60 hover:text-foreground'}`}
                        >
                          <span>{m}</span>
                          <MarkZoneIndicator zone={info?.zone || null} />
                          <MarkCountryFocus markCountries={markFocus} mark={m} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {athletes.map((a) => {
                  const draft = draftOf(a.id);
                  return (
                    <tr key={a.id} className="border-b border-border align-middle">
                      <td className="py-2 pr-2">
                        <span className="w-9 h-9 rounded bg-isu-navy text-white flex items-center justify-center text-xs font-semibold">
                          {a.helmetNumber || a.country}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <CountryFlag country={a.country} />
                          <div>
                            <div className="font-medium whitespace-nowrap">{athleteLabel(a)}</div>
                            {!isMixedAthlete(a) && <div className="text-xs text-muted-foreground">{a.country}</div>}
                          </div>
                        </div>
                      </td>

                      {MARKS.map((m) => {
                        const key = `${a.id}|${m}`;
                        const submitted = submittedMap[key];
                        const queued = pendingMap[key];
                        if (submitted || queued) {
                          const c = submitted || queued;
                          return (
                            <td key={m} className={`py-2 pr-2 text-center ${activeMark === m ? 'bg-accent/40' : ''}`}>
                              <span className={`inline-flex items-center justify-center min-w-[44px] px-2 py-1 rounded text-xs font-semibold ${queued ? 'border border-dashed border-amber-500 bg-amber-100 text-amber-900' : callTone(c.callCode)}`}>
                                {c.callCode}
                              </span>
                              {queued && <div className="mt-0.5 text-[10px] text-amber-700">queued</div>}
                            </td>
                          );
                        }
                        return (
                          <td key={m} className={`py-2 pr-2 text-center ${activeMark === m ? 'bg-accent/40' : ''}`}>
                            <div className="flex items-center justify-center gap-1">
                              <CallCodeSelect value={draft.marks[m]} onValueChange={(v) => setMark(a.id, m, v)} disabled={locked} label={`Call code for mark ${SHORT_MARKS[m]}`} />
                              {draft.marks[m] && !locked && (
                                <button type="button" onClick={() => setMark(a.id, m, '')} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Clear call">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(() => {
          const yc2 = findYc2Athletes([...submittedCalls, ...pending]);
          if (yc2.length === 0) return null;
          return (
            <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">YC-2 — two penalties in this race:</p>
              {yc2.map((id) => {
                const athlete = athletes.find((a) => a.id === id);
                if (!athlete) return null;
                return (
                  <p key={id} className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center min-w-[2rem] rounded bg-isu-navy px-1.5 py-0.5 text-xs font-semibold text-white">{athlete.helmetNumber || athlete.country}</span>
                    <span className="font-medium">{athleteLabel(athlete)}</span>
                    <span className="inline-flex items-center rounded bg-yellow-400 px-2 py-0.5 text-xs font-semibold text-yellow-950">YC-2</span>
                    <span className="text-xs text-amber-700">two S/C/F calls across two marks → Yellow Card</span>
                  </p>
                );
              })}
            </div>
          );
        })()}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button onClick={submitAll} disabled={submitting || locked || athletes.length === 0}>
            <Send className="w-4 h-4 mr-1" /> {submitting ? 'Sending…' : 'Send all calls'}
          </Button>
          <Button variant="outline" onClick={submitRaceNoCall} disabled={submitting || locked || athletes.length === 0 || raceNoCallExists}>
            <Ban className="w-4 h-4 mr-1" /> NO CALL — nothing happened in this race
          </Button>
        </div>
      </div>
    </div>
  );
}