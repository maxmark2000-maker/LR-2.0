import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';

export default function RefereeCompetitionPicker({ competitions, selected, onToggle, onSetAll }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = (competitions || []).filter((c) => !q || (c.name || '').toLowerCase().includes(q));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search competitions"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onSetAll((competitions || []).map((c) => c.id))}>
          Select all
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onSetAll([])}>
          Clear
        </Button>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
        {list.length === 0 && <p className="p-3 text-xs text-muted-foreground">No competitions found.</p>}
        {list.map((c) => (
          <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 cursor-pointer">
            <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => onToggle(c.id)} />
            <span className="truncate">{c.name}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{selected.length} competition(s) assigned</p>
    </div>
  );
}