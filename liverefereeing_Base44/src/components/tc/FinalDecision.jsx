import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CALL_CODES, athleteLabel, isMixedAthlete, callTone, REVISION_REASONS, revisionReason } from '@/lib/isu';
import { Save, Ban, Eraser, Pencil, RefreshCw, AlertTriangle, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import CountryFlag from '@/components/tc/CountryFlag';
import { parseMarkCountries, MarkCountryFocus } from '@/components/MarkCountries';
import TcPanelHeader from '@/components/tc/TcPanelHeader';
import { base44 } from '@/api/base44Client';
import { tc } from '@/lib/cubeClient';

const MARKS = ['MARK1', 'MARK2', 'MARK3', 'MARK4', 'MARK5'];

const emptyMarks = () => ({ MARK1: '', MARK2: '', MARK3: '', MARK4: '', MARK5: '' });

const parseDecision = (raw) => {
  if (!raw) return { marks: {}, notes: {}, noCall: false, tc: {} };
  try {
    const parsed = JSON.parse(raw);
    return { marks: parsed.marks || {}, notes: parsed.notes || {}, noCall: !!parsed.noCall, tc: parsed.tc || {} };
  } catch {
    return { marks: {}, notes: {}, noCall: false, tc: {} };
  }
};

const markKey = (id, m) => `${id}|${m}`;

const TC_SAME = '__SAME';

const hasExistingDecision = (raw) => {
  const d = parseDecision(raw);
  return d.noCall || Object.values(d.marks).some(Boolean) || Object.values(d.notes).some((n) => n && n.trim()) || Object.values(d.tc).some(Boolean);
};

export default function FinalDecision({ race, athletes, onSaved }) {
  const [marks, setMarks] = useState({});
  const [notes, setNotes] = useState({});
  const [tcMarks, setTcMarks] = useState({});
  const [noCall, setNoCall] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(() => !hasExistingDecision(race?.finalDecision));
  const [showReason, setShowReason] = useState(false);
  const [revising, setRevising] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const markFocus = parseMarkCountries(race?.markCountries);

  const pendingRevision = !!(race?.finalDecisionPrevious && !race.finalDecisionRevised);
  const revised = !!race?.finalDecisionRevised;

  // The decision that was in place before the revision — kept viewable after a change.
  const prevDecision = useMemo(() => parseDecision(race?.finalDecisionPrevious), [race?.finalDecisionPrevious]);
  const hasPreviousDecision = !!race?.finalDecisionPrevious && hasExistingDecision(race.finalDecisionPrevious);
  const [viewOriginal, setViewOriginal] = useState(false);

  useEffect(() => {
    const d = parseDecision(race?.finalDecision);
    setMarks(d.marks);
    setNotes(d.notes);
    setTcMarks(d.tc);
    setNoCall(d.noCall);
    setEditing(!hasExistingDecision(race?.finalDecision));
    setPendingSave(false);
    setViewOriginal(false);
  }, [race?.id, race?.finalDecision]);

  const setMark = (id, mark, value) =>
    setMarks((s) => ({ ...s, [markKey(id, mark)]: value }));
  const setTcMark = (id, mark, value) =>
    setTcMarks((s) => ({ ...s, [markKey(id, mark)]: value }));
  const setNote = (id, value) =>
    setNotes((s) => ({ ...s, [id]: value }));

  const hasEntries = noCall || Object.values(marks).some(Boolean);

  const clearAll = () => { setMarks({}); setNotes({}); setTcMarks({}); setNoCall(false); };

  // Changing an already saved Final Decision requires its reason up front —
  // nothing is written until Debrief, TC Meeting or Error correction is picked.
  const save = async (reason) => {
    const payload = JSON.stringify({ marks, notes, noCall, tc: tcMarks });
    const prev = race?.finalDecision || '';
    const isRevision = !!prev && payload !== prev;
    if (isRevision && !reason) {
      setPendingSave(true);
      return;
    }
    setSaving(true);
    try {
      const patch = { finalDecision: payload };
      if (isRevision) {
        patch.finalDecisionPrevious = prev;
        patch.finalDecisionRevised = true;
        patch.finalDecisionRevisionReason = reason;
        patch.finalDecisionRevisedAt = new Date().toISOString();
      }
      await tc.entities.Race.update(race.id, patch);
      if (isRevision) {
        // Keep an immutable history of the change so the original Final Call and
        // its recalculated referee scores stay traceable.
        await tc.entities.DecisionRevision.create({
          raceId: race.id,
          competitionId: race.competitionId,
          roundId: race.roundId,
          raceNumber: race.raceNumber,
          genderGroup: race.genderGroup,
          originalDecision: prev,
          newDecision: payload,
          reason,
          revisedAt: patch.finalDecisionRevisedAt,
        });
      }
      onSaved?.(patch);
      setSaved(true);
      setEditing(false);
      setPendingSave(false);
      setShowReason(false);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const applyRevision = async (reason) => {
    setRevising(true);
    try {
      const patch = {
        finalDecisionRevised: true,
        finalDecisionRevisionReason: reason,
        finalDecisionRevisedAt: new Date().toISOString(),
      };
      await tc.entities.Race.update(race.id, patch);
      // Keep an immutable history of the change so the original Final Call and
      // its recalculated referee scores stay traceable.
      await tc.entities.DecisionRevision.create({
        raceId: race.id,
        competitionId: race.competitionId,
        roundId: race.roundId,
        raceNumber: race.raceNumber,
        genderGroup: race.genderGroup,
        originalDecision: race.finalDecisionPrevious || '',
        newDecision: race.finalDecision || '',
        reason,
        revisedAt: patch.finalDecisionRevisedAt,
      });
      onSaved?.(patch);
      setShowReason(false);
    } finally {
      setRevising(false);
    }
  };

  // When the original decision is on screen, every read-only cell comes from it.
  const showOriginal = !editing && viewOriginal && hasPreviousDecision;
  const displayMarks = showOriginal ? prevDecision.marks : marks;
  const displayNotes = showOriginal ? prevDecision.notes : notes;
  const displayTc = showOriginal ? prevDecision.tc : tcMarks;
  const displayNoCall = showOriginal ? prevDecision.noCall : noCall;

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-isu-navy/20 shadow-sm">
      <TcPanelHeader
        compact
        eyebrow="TCCube"
        title="Final decision"
        subtitle={`${editing ? 'Enter the jury\'s final call per athlete and mark, then save.' : 'Saved final decision for this race.'} TC decision — your personal call per entry: Same as final or a different code. Only visible inside TCCube, never shown to referees.`}
        actions={(
          <div className="flex items-center gap-2">
          {!editing && hasPreviousDecision && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewOriginal((v) => !v)}
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <History className="w-4 h-4 mr-1" /> {viewOriginal ? 'Show current decision' : 'Show original decision'}
            </Button>
          )}
          {!editing && (
            <Button
              size="sm"
              onClick={() => setEditing(true)}
              className="bg-amber-500 text-white hover:bg-amber-600 font-semibold shadow-sm"
            >
              <Pencil className="w-4 h-4 mr-1" /> Change the Final decision after Debrief or for correction
            </Button>
          )}
          {editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={!hasEntries}
              className="text-white hover:bg-white/20 hover:text-white"
            >
              <Eraser className="w-4 h-4 mr-1" /> Clear
            </Button>
          )}
          </div>
        )}
      />

      <div className="p-4">
      {showOriginal && (
        <div className="mb-3 rounded border border-border bg-secondary p-3 flex items-center gap-2 text-sm">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">Original final decision — the version before the revision.</span>
        </div>
      )}

      {displayNoCall && (
        <div className="mb-3 rounded border border-border bg-secondary p-3 flex items-center gap-2 text-sm">
          <Ban className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">NO CALL for this race</span>
        </div>
      )}

      {athletes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No athletes assigned to this race.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[780px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-isu-navy/20">
                <th className="py-2 pr-2 font-semibold">#</th>
                <th className="py-2 pr-2 font-semibold">Athlete</th>
                {MARKS.map((m) => (
                  <th key={m} className="py-2 pr-2 font-semibold text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{m}</span>
                      <MarkCountryFocus markCountries={markFocus} mark={m} />
                    </div>
                  </th>
                ))}
                <th className="py-2 pr-2 font-semibold">Notes - TC Comment</th>
              </tr>
            </thead>
            <tbody>
              {athletes.map((a) => (
                <tr key={a.id} className="border-b border-border/60 align-middle last:border-b-0">
                  <td className="py-2 pr-2">
                    <span className="w-9 h-9 rounded bg-isu-navy text-white flex items-center justify-center text-xs font-semibold">
                      {a.helmetNumber}
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
                    const key = markKey(a.id, m);
                    const val = displayMarks[key] || '';
                    const tcVal = displayTc[key] || '';
                    if (editing) {
                      return (
                        <td key={m} className="py-1.5 pr-2">
                          <Select value={val} onValueChange={(v) => setMark(a.id, m, v)}>
                            <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {CALL_CODES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">TC</span>
                            <Select value={tcVal || TC_SAME} onValueChange={(v) => setTcMark(a.id, m, v)}>
                              <SelectTrigger className="h-7 w-[68px] text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={TC_SAME} className="text-xs">Same as final</SelectItem>
                                {CALL_CODES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={m} className="py-2 pr-2 text-center">
                        {val ? (
                          <span className={`inline-flex items-center font-mono text-xs px-2 py-1 rounded ${callTone(val)}`}>
                            {val}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {tcVal && (
                          <div className="mt-1">
                            {tcVal === TC_SAME ? (
                              <span className="text-[10px] text-muted-foreground">TC ✓ same</span>
                            ) : (
                              <span className="inline-flex items-center font-mono text-[11px] px-1.5 py-0.5 rounded bg-black text-white">
                                TC {tcVal}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 pr-2">
                    {editing ? (
                      <Input
                        value={displayNotes[a.id] || ''}
                        onChange={(e) => setNote(a.id, e.target.value)}
                        placeholder="optional"
                        className="h-8 text-xs"
                      />
                    ) : (
                      <span className="text-xs text-foreground whitespace-pre-wrap">{displayNotes[a.id] || '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && pendingSave && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span className="text-sm font-medium text-amber-900">
              You are changing an already saved final decision. Why?
            </span>
            {REVISION_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => save(r.value)}
                disabled={saving}
                className={`inline-flex items-center rounded-md text-sm font-medium h-8 px-4 disabled:opacity-50 ${r.buttonClass}`}
              >
                {r.label}
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setPendingSave(false)} disabled={saving}>
              Cancel
            </Button>
            {saving && <span className="text-xs text-amber-700">Saving…</span>}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {editing && !pendingSave ? (
          <>
            <Button onClick={() => save()} disabled={saving || athletes.length === 0} className="bg-isu-blue hover:bg-isu-navy">
              <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving…' : 'Save final decision'}
            </Button>
            <Button variant="outline" onClick={() => setNoCall((v) => !v)} disabled={athletes.length === 0}>
              <Ban className="w-4 h-4 mr-1" /> {noCall ? 'Remove NO CALL' : 'NO CALL — nothing happened'}
            </Button>
          </>
        ) : null}
        {saved && <span className="text-xs text-muted-foreground">Saved.</span>}
      </div>
      </div>

      {!editing && (pendingRevision || revised || showReason) && (
        <div className="mx-4 mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          {revised ? (
            <div className="flex items-center gap-2 text-sm text-amber-900">
              <Badge className="bg-amber-500 text-white text-[10px] tracking-wider">REVISED</Badge>
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Final decision was revised via {revisionReason(race.finalDecisionRevisionReason).label}</span>
              {race.finalDecisionRevisedAt && (
                <span className="text-xs text-amber-700">· {new Date(race.finalDecisionRevisedAt).toLocaleString()}</span>
              )}
            </div>
          ) : showReason ? (
            <div className="flex flex-wrap items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-700" />
              <span className="text-sm font-medium text-amber-900">Why was the final decision changed?</span>
              {REVISION_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => applyRevision(r.value)}
                  disabled={revising}
                  className={`inline-flex items-center rounded-md text-sm font-medium h-8 px-4 disabled:opacity-50 ${r.buttonClass}`}
                >
                  {r.label}
                </button>
              ))}
              <button type="button" onClick={() => setShowReason(false)} className="text-sm text-muted-foreground h-8 px-2">
                Cancel
              </button>
              {revising && <span className="text-xs text-amber-700">Saving…</span>}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-amber-900">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">This final decision differs from the previously saved version.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowReason(true)}
                className="inline-flex items-center rounded-md bg-amber-500 text-white text-sm font-medium h-8 px-4 hover:bg-amber-600"
              >
                <RefreshCw className="w-4 h-4 mr-1" /> Neue Final Decision
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}