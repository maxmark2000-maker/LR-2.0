import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Plus, X } from 'lucide-react';
import { normalizeVideoTimestamp } from '@/lib/refereeFlags';

// Optional video position attached to a referee's personal review flag. Saving an
// empty value removes the timestamp without touching the flag itself.
export default function VideoTimestampEditor({ value, onSave, busy = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [error, setError] = useState('');

  useEffect(() => { setDraft(value || ''); }, [value]);

  const save = async () => {
    const normalized = normalizeVideoTimestamp(draft);
    if (normalized === null) {
      setError('Use MM:SS or HH:MM:SS — e.g. 12:43 or 1:02:18.');
      return;
    }
    setError('');
    const ok = await onSave(normalized);
    if (ok) setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {value ? (
          <>
            <span className="text-muted-foreground">
              Video: <span className="font-mono text-foreground">{value}</span>
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={busy}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button
              type="button"
              onClick={() => onSave('')}
              disabled={busy}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
            >
              <X className="w-3 h-3" /> Remove
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-3 h-3" /> Video timestamp (optional)
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-foreground">Video timestamp (optional)</span>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. 12:43 or 1:02:18"
          className="h-8 w-40 text-xs"
        />
        <Button type="button" size="sm" onClick={save} disabled={busy}>Save</Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => { setEditing(false); setError(''); setDraft(value || ''); }}
        >
          Cancel
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Save the approximate video position so you can return to this situation later.
      </p>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}