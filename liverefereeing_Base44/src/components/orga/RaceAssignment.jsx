import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { orga } from '@/lib/cubeClient';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, Radio } from 'lucide-react';
import { athleteLabel, isMixedAthlete } from '@/lib/isu';
import { Input } from '@/components/ui/input';
import MarkCountriesEditor from '@/components/orga/MarkCountriesEditor';

export default function RaceAssignment({ race, athletes, locked, canEdit, onChange, highlight = false }) {
  const isClosed = !!race.isClosed;
  const disabled = locked || isClosed;
  const [liveBusy, setLiveBusy] = useState(false);
  const [livePulse, setLivePulse] = useState(false);
  const [numDraft, setNumDraft] = useState(String(race.raceNumber ?? ''));
  const [numBusy, setNumBusy] = useState(false);

  // Optimistic local copy of assigned athlete ids, so rapid clicks don't race
  // against stale closures and lose selections.
  const [assigned, setAssigned] = useState(race.athleteIds || []);
  const assignedRef = React.useRef(assigned);
  assignedRef.current = assigned;
  useEffect(() => {
    setAssigned(race.athleteIds || []);
  }, [race.id, race.athleteIds]);

  const saveNumber = async () => {
    const n = parseInt(numDraft, 10);
    if (Number.isNaN(n) || n === race.raceNumber) { setNumDraft(String(race.raceNumber ?? '')); return; }
    setNumBusy(true);
    try {
      await orga.entities.Race.update(race.id, { raceNumber: n });
      // Keep the linked schedule entry in sync so the Schedule tab reflects
      // the new number instead of reverting to the old one.
      try {
        await orga.entities.ScheduleEntry.updateMany(
          { competitionId: race.competitionId, raceNumber: race.raceNumber, genderGroup: race.genderGroup },
          { $set: { raceNumber: n } }
        );
      } catch { /* best-effort sync */ }
      onChange();
    } finally {
      setNumBusy(false);
    }
  };
  const sorted = [...athletes].sort((a, b) => {
    const na = parseInt(a.helmetNumber, 10); const nb = parseInt(b.helmetNumber, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.helmetNumber).localeCompare(String(b.helmetNumber));
  });

  const toggle = async (athleteId) => {
    if (disabled) return;
    const current = assignedRef.current;
    const next = current.includes(athleteId) ? current.filter((id) => id !== athleteId) : [...current, athleteId];
    assignedRef.current = next;
    setAssigned(next); // optimistic, so the checkbox reflects the click immediately
    try {
      await orga.entities.Race.update(race.id, { athleteIds: next });
      onChange();
    } catch (e) {
      // revert on failure and let the parent reload the truth
      assignedRef.current = race.athleteIds || [];
      setAssigned(race.athleteIds || []);
      throw e;
    }
  };

  const toggleClose = async () => {
    // Closing locks referee calls, so it asks first — reopening never does.
    if (!isClosed) {
      const ok = window.confirm(
        `Close race #${race.raceNumber}?\nReferees can no longer submit calls for this race.`
      );
      if (!ok) return;
    }
    await orga.entities.Race.update(race.id, { isClosed: !isClosed });
    onChange();
  };

  const goLive = async () => {
    setLiveBusy(true);
    try {
      await orga.entities.LiveRace.create({
        competitionId: race.competitionId,
        raceId: race.id,
        roundId: race.roundId,
        genderGroup: race.genderGroup,
        raceNumber: race.raceNumber,
        setAt: new Date().toISOString(),
      });
      setLivePulse(true);
      setTimeout(() => setLivePulse(false), 2500);
    } finally {
      setLiveBusy(false);
    }
  };

  return (
    <div className={`rounded border p-4 transition-all ${highlight ? 'border-isu-blue ring-2 ring-isu-blue/60 bg-accent/40' : 'border-border'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Race</span>
          {canEdit && !locked ? (
            <Input
              type="number"
              min="1"
              value={numDraft}
              disabled={numBusy}
              onChange={(e) => setNumDraft(e.target.value)}
              onBlur={saveNumber}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="h-7 w-20 font-mono"
            />
          ) : (
            <span className="font-semibold text-sm">{race.raceNumber}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isClosed && (
            <span className="inline-flex items-center text-xs text-amber-800 bg-amber-100 rounded px-2 py-0.5">
              <Lock className="w-3 h-3 mr-1" /> Closed
            </span>
          )}
          <span className="text-xs text-muted-foreground">{assigned.length} athlete(s)</span>
          {canEdit && !locked && (
            <>
              <button
                type="button"
                onClick={goLive}
                disabled={liveBusy}
                className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${livePulse ? 'border-red-500 text-red-600 bg-red-50 animate-pulse' : 'border-isu-blue text-white bg-isu-blue hover:bg-isu-navy'}`}
                title="Push this race to all LiveRefereeing accounts"
              >
                <Radio className="w-3 h-3" /> LIVE
              </button>
              <button
                type="button"
                onClick={toggleClose}
                className={`text-xs px-2 py-1 rounded border ${isClosed ? 'border-border hover:bg-secondary' : 'border-amber-400 text-amber-800 hover:bg-amber-50'}`}
              >
                {isClosed ? 'Reopen race' : 'Close race'}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {athletes.length === 0 && <p className="text-xs text-muted-foreground">No athletes in this gender group yet.</p>}
        {sorted.map((a) => (
          <label key={a.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={assigned.includes(a.id)} disabled={disabled} onCheckedChange={() => toggle(a.id)} />
            {a.helmetNumber && <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">{a.helmetNumber}</span>}
            {athleteLabel(a)} {!isMixedAthlete(a) && <span className="text-muted-foreground">{a.country}</span>}
          </label>
        ))}
      </div>
      {canEdit && !locked && (
        <MarkCountriesEditor
          race={race}
          onChange={onChange}
          assignedAthletes={assigned.map((id) => athletes.find((a) => a.id === id)).filter(Boolean)}
        />
      )}
      {isClosed && (
        <p className="mt-3 text-xs text-muted-foreground">Race is closed — athlete assignments and referee calls are locked.</p>
      )}
    </div>
  );
}