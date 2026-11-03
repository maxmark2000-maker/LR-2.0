import React, { useMemo, useState } from 'react';
import { CALL_CODES, athleteLabel, isMixedAthlete, callTone } from '@/lib/isu';
import { Check, X, AlertTriangle, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CountryFlag from '@/components/tc/CountryFlag';
import { Badge } from '@/components/ui/badge';
import { parseMarkCountries, MarkCountryFocus } from '@/components/MarkCountries';

const MARKS = ['MARK1', 'MARK2', 'MARK3', 'MARK4', 'MARK5'];
const markKey = (id, m) => `${id}|${m}`;

const parseDecision = (raw) => {
  if (!raw) return { marks: {}, notes: {}, noCall: false };
  try {
    const parsed = JSON.parse(raw);
    return { marks: parsed.marks || {}, notes: parsed.notes || {}, noCall: !!parsed.noCall };
  } catch {
    return { marks: {}, notes: {}, noCall: false };
  }
};

export default function FinalDecisionView({ race, athletes, myCalls = [], hideDebrief = false }) {
  const [viewOriginal, setViewOriginal] = useState(false);
  const currentDecision = useMemo(() => parseDecision(race?.finalDecision), [race?.id, race?.finalDecision]);
  const prevDecision = useMemo(() => parseDecision(race?.finalDecisionPrevious), [race?.finalDecisionPrevious]);
  const prevMarks = prevDecision.marks;
  const hadPreviousDecision = Object.values(prevMarks).some(Boolean);
  // Apprentices are not shown a debrief revision: they see the decision as it stood before it.
  const debriefHidden =
    hideDebrief && !!race?.finalDecisionRevised && race?.finalDecisionRevisionReason === 'DEBRIEF' && hadPreviousDecision;
  const decision = debriefHidden ? prevDecision : currentDecision;
  const { marks, notes, noCall } = decision;
  const markFocus = useMemo(() => parseMarkCountries(race?.markCountries), [race?.id, race?.markCountries]);
  const myCallMap = {};
  myCalls.forEach((c) => { if (c.athleteId && c.mark) myCallMap[markKey(c.athleteId, c.mark)] = c.callCode; });
  // A per-mark "No Call" from the Call sheet applies to every athlete of that mark.
  const myMarkNoCall = new Set(
    myCalls.filter((c) => !c.athleteId && c.mark && c.callCode === 'NO CALL').map((c) => c.mark)
  );
  const noCallMarks = MARKS.filter((m) => athletes.length > 0 && athletes.every((a) => marks[markKey(a.id, m)] === 'NO CALL'));
  const showNoCallHint = noCall || noCallMarks.length > 0;
  const revisedViaDebrief = !debriefHidden && !!race?.finalDecisionRevised && race?.finalDecisionRevisionReason === 'DEBRIEF';
  const hasPreviousDecision = revisedViaDebrief && hadPreviousDecision;
  const showOriginal = hasPreviousDecision && viewOriginal;
  const displayMarks = showOriginal ? prevMarks : marks;
  const hasMarkEntries = Object.values(displayMarks).some(Boolean);
  const changedCell = (id, m) => {
    const curr = marks[markKey(id, m)];
    return revisedViaDebrief && !!curr && curr !== (prevMarks[markKey(id, m)] || '');
  };

  return (
    <div>
      <div className="relative overflow-hidden bg-gradient-to-r from-isu-navy via-isu-navy to-isu-blue px-6 py-5 text-white">
        <div className="pointer-events-none absolute -right-10 -top-20 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-24 h-40 w-40 rounded-full bg-isu-light/25 blur-2xl" />
        <div className="relative flex flex-wrap items-baseline gap-2">
          <div className="mr-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-isu-light">Read-only · TCCube</p>
            <h3 className="mt-2 font-heading text-2xl font-bold leading-none">Final decision</h3>
          </div>
          {race?.raceNumber && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Race {race.raceNumber}</span>}
          {race?.genderGroup && <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">{race.genderGroup}</span>}
        </div>
      </div>
      <div className="p-6">
      <p className="text-xs text-muted-foreground">
        {showOriginal ? (
          <span className="font-medium text-amber-800">Showing the previous final decision — as it stood before the debrief revision.</span>
        ) : (
          <>
            <Check className="w-3.5 h-3.5 inline text-emerald-600" /> your call matches the final decision · <X className="w-3.5 h-3.5 inline text-destructive" /> your call differs or is missing
          </>
        )}
      </p>

      {revisedViaDebrief && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 flex flex-wrap items-center gap-2 text-sm text-amber-900">
          <Badge className="bg-amber-500 text-white text-[10px] tracking-wider">REVISED</Badge>
          <AlertTriangle className="w-4 h-4" />
          <span className="font-medium">Final decision was revised via Debrief</span>
          {race.finalDecisionRevisedAt && (
            <span className="text-xs text-amber-700">· {new Date(race.finalDecisionRevisedAt).toLocaleString()}</span>
          )}
          {hasPreviousDecision && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewOriginal((v) => !v)}
              className="ml-auto h-8 border-amber-400 bg-white/70 text-xs text-amber-900 hover:bg-white hover:text-amber-900"
            >
              <History className="w-4 h-4 mr-1" /> {showOriginal ? 'Show current decision' : 'Show previous decision'}
            </Button>
          )}
        </div>
      )}

      {!hasMarkEntries && !noCall ? (
        <p className="mt-3 text-sm text-muted-foreground">No final decision has been entered in the TCCube yet.</p>
      ) : hasMarkEntries && athletes.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No athletes assigned to this race.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[560px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
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
              </tr>
            </thead>
            <tbody>
              {athletes.map((a) => (
                <tr key={a.id} className="border-b border-border align-middle">
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
                    const code = displayMarks[markKey(a.id, m)] || '';
                    const changed = changedCell(a.id, m);
                    return (
                      <td key={m} className={`py-2 pr-2 text-center ${changed ? 'bg-amber-50 border border-amber-300 rounded' : ''}`}>
                        {code ? (
                          <span className="inline-flex items-center justify-center gap-1.5">
                            <span className={`inline-flex items-center justify-center min-w-[44px] px-2 py-1 rounded text-xs font-semibold ${callTone(code)}`}>
                              {code}
                            </span>
                            {!showOriginal && (() => {
                              const mine = myCallMap[markKey(a.id, m)] || (myMarkNoCall.has(m) ? 'NO CALL' : undefined);
                              if (mine === code)
                                return (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white shadow-sm" aria-label="Your call matches">
                                    <Check className="w-4 h-4" strokeWidth={3} />
                                  </span>
                                );
                              return (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-destructive text-white shadow-sm" aria-label={mine ? 'Your call differs' : 'No call entered'}>
                                  <X className="w-4 h-4" strokeWidth={3} />
                                </span>
                              );
                            })()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}