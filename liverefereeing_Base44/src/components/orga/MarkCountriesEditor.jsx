import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { orga } from '@/lib/cubeClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CountryFlag from '@/components/tc/CountryFlag';
import { parseMarkCountries, countryTint } from '@/components/MarkCountries';

const MARKS = ['MARK1', 'MARK2', 'MARK3', 'MARK4', 'MARK5'];
const NONE = 'none';

export default function MarkCountriesEditor({ race, assignedAthletes, onChange }) {
  const [focus, setFocus] = useState(() => parseMarkCountries(race.markCountries));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFocus(parseMarkCountries(race.markCountries));
  }, [race.id, race.markCountries]);

  const countries = [...new Set((assignedAthletes || []).map((a) => a.country).filter(Boolean))];

  const setPair = async (mark, index, value) => {
    const current = Array.isArray(focus[mark]) ? [...focus[mark]] : [];
    current[index] = value === NONE || !value ? undefined : value;
    const next = { ...focus };
    if (current.filter(Boolean).length === 0) delete next[mark];
    else next[mark] = current;
    setFocus(next);
    setBusy(true);
    try {
      await orga.entities.Race.update(race.id, { markCountries: JSON.stringify(next) });
      if (onChange) onChange();
    } finally {
      setBusy(false);
    }
  };

  const renderSelect = (mark, index) => {
    const pair = Array.isArray(focus[mark]) ? focus[mark] : [];
    const selected = pair[index];
    const tint = selected ? countryTint(selected) : null;
    return (
      <Select value={selected || NONE} onValueChange={(v) => setPair(mark, index, v)} disabled={busy || countries.length === 0}>
        <SelectTrigger
          className="h-7 text-xs w-full"
          style={tint ? { backgroundColor: tint, borderColor: tint } : undefined}
        >
          {selected && <CountryFlag country={selected} />}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE} className="text-xs">—</SelectItem>
          {countries.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="mt-4 rounded border border-border bg-secondary/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Mark focus — between which two countries does each mark concentrate? (optional)
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MARKS.map((m) => (
          <div key={m} className="flex items-center gap-1.5">
            <span className="text-xs font-mono font-semibold w-14 shrink-0">{m}</span>
            {renderSelect(m, 0)}
            <span className="text-xs text-muted-foreground shrink-0">vs</span>
            {renderSelect(m, 1)}
          </div>
        ))}
      </div>
    </div>
  );
}