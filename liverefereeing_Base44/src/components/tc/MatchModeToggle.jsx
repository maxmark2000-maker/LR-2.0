import React from 'react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  {
    value: 'lenient',
    label: 'Lenient',
    hint: 'Right athlete, wrong code in the same category counts as correct — and so does a missing ADV',
  },
  {
    value: 'strict',
    label: 'Strict',
    hint: 'Athlete and code must both match exactly',
  },
];

export default function MatchModeToggle({ value, onChange }) {
  const active = OPTIONS.find((o) => o.value === value) || OPTIONS[0];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">Agreement view</span>
      <div className="inline-flex overflow-hidden rounded-md border border-border">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold transition-colors',
              value === o.value
                ? 'bg-isu-navy text-white'
                : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{active.hint}</span>
    </div>
  );
}