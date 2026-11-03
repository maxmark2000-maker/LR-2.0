import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Check, X, ChevronDown, AlertTriangle } from 'lucide-react';
import { revisionReason } from '@/lib/isu';

const fmtPct = (v) => `${(v * 100).toFixed(1)}%`;

const scoreTone = (score) =>
  score >= 1
    ? 'bg-emerald-100 text-emerald-800'
    : score > 0
      ? 'bg-amber-100 text-amber-800'
      : 'bg-red-100 text-red-800';

function ComponentTable({ entries }) {
  return (
    <table className="w-full text-xs border-collapse mt-1">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
          <th className="py-1 pr-2 font-semibold">Athlete</th>
          <th className="py-1 pr-2 font-semibold">Final Call</th>
          <th className="py-1 pr-2 font-semibold">Referee Call</th>
          <th className="py-1 pr-2 font-semibold text-center w-10">OK</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.athleteId} className="border-b border-border last:border-0">
            <td className="py-1 pr-2 whitespace-nowrap">
              {e.helmetNumber ? <span className="font-mono font-semibold mr-1">{e.helmetNumber}</span> : null}
              {e.athleteName}
            </td>
            <td className="py-1 pr-2">
              <span className="inline-flex items-center font-mono px-1.5 py-0.5 rounded bg-isu-navy text-white">{e.expected}</span>
            </td>
            <td className={`py-1 pr-2 ${e.correct ? '' : 'font-semibold text-destructive'}`}>
              <span className="font-mono">{e.actual}</span>
              {e.codeDiffers && (
                <span className="ml-1.5 text-[10px] font-semibold text-amber-700">
                  {e.notCalled ? 'not called' : 'code differs'}
                </span>
              )}
            </td>
            <td className="py-1 pr-2 text-center">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${e.correct ? 'bg-emerald-500' : 'bg-destructive'} text-white`}>
                {e.correct ? <Check className="w-3 h-3" strokeWidth={3} /> : <X className="w-3 h-3" strokeWidth={3} />}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RaceCard({ race }) {
  const [openMark, setOpenMark] = useState(null);
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-heading font-bold text-sm">Race {race.raceNumber}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {race.marksPerfect}/{race.marksEvaluated} marks complete · {race.correctComponents}/{race.totalComponents} components
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tabular-nums ${scoreTone(race.markAgreement)}`}>
            {fmtPct(race.markAgreement)}
          </span>
        </span>
      </div>

      {race.revised && (
        <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 flex flex-wrap items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          <Badge className={`text-[10px] tracking-wider ${revisionReason(race.revisionReason).badgeClass}`}>
            {revisionReason(race.revisionReason).badge}
          </Badge>
          <span className="font-medium">Final Decision was changed — score recalculated.</span>
          {race.previous && (
            <span className="tabular-nums">
              Before: <span className="font-semibold">{fmtPct(race.previous.markAgreement)}</span> → Now:{' '}
              <span className="font-semibold">{fmtPct(race.markAgreement)}</span>
            </span>
          )}
          {race.revisedAt && <span className="text-amber-700">· {new Date(race.revisedAt).toLocaleString()}</span>}
        </div>
      )}

      <div className="mt-2 space-y-1">
        {race.marks.map((m) => (
          <div key={m.mark} className="rounded border border-border">
            <button
              type="button"
              onClick={() => setOpenMark((prev) => (prev === m.mark ? null : m.mark))}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-accent/40 transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${openMark === m.mark ? 'rotate-180' : ''}`} />
              <span className="text-xs font-semibold w-14">{m.mark}</span>
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${m.score >= 1 ? 'bg-emerald-100 text-emerald-700' : m.score > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {m.score >= 1 ? <Check className="w-3 h-3" strokeWidth={3} /> : <X className="w-3 h-3" strokeWidth={3} />}
              </span>
              <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                {m.correct}/{m.total} components
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tabular-nums ${scoreTone(m.score)}`}>
                {fmtPct(m.score)}
              </span>
            </button>
            {openMark === m.mark && (
              <div className="px-2 pb-2">
                <ComponentTable entries={m.entries} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RefereeRaceDetail({ referee }) {
  if (!referee.races.length) {
    return <p className="text-sm text-muted-foreground">No scored races for this referee.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Competition → Race → Mark → Decision · {referee.races.length} race{referee.races.length !== 1 ? 's' : ''}
      </p>
      {referee.races.map((race) => <RaceCard key={race.raceId} race={race} />)}
    </div>
  );
}