import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Flag } from 'lucide-react';
import { refereeFlagSummary } from '@/lib/refereeFlags';

// Shown only once the majority threshold is reached. Informational: it never
// creates a TC flag, changes the Final Decision or affects scoring.
export default function RefereeAttentionStrip({ flags = [], eligible = [] }) {
  const [open, setOpen] = useState(false);
  const summary = refereeFlagSummary(flags, eligible);
  if (!summary.reached) return null;

  const pct = Math.round(summary.ratio * 100);
  const rows = eligible
    .map((referee) => ({ referee, flag: flags.find((f) => f.refereeId === referee.id) || null }))
    .sort((a, b) => (b.flag ? 1 : 0) - (a.flag ? 1 : 0)
      || String(a.referee.displayName || '').localeCompare(String(b.referee.displayName || '')));

  return (
    <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50/70 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
          <Flag className="w-3 h-3" /> Referee Attention
        </span>
        <span className="text-sm text-orange-900">
          {summary.count} of {summary.total} referees who called this race flagged it for review.
        </span>
        <span className="text-xs text-orange-800/80">{summary.count} / {summary.total} referees · {pct}%</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-orange-800 underline underline-offset-2 hover:text-orange-900"
        >
          {open ? 'Hide flag details' : 'View flag details'}
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>
      {open && (
        <ul className="mt-3 space-y-1 border-t border-orange-200 pt-3 text-xs text-orange-900">
          {rows.map(({ referee, flag }) => (
            <li key={referee.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{referee.displayName}</span>
              <span className="text-orange-800/60">—</span>
              <span>{flag ? 'Flagged' : 'Not flagged'}</span>
              {flag?.videoTimestamp && <span className="font-mono text-orange-800/80">— {flag.videoTimestamp}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-orange-800/70">
        Informational only — this does not create a TC flag, change the Final Decision or affect scoring.
      </p>
    </div>
  );
}