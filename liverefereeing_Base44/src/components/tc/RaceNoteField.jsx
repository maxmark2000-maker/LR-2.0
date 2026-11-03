import React, { useEffect, useState } from 'react';
import { tc } from '@/lib/cubeClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Loader2 } from 'lucide-react';
import TcPanelHeader from '@/components/tc/TcPanelHeader';

// One free-text note per race — about the race as a whole, not a mark or an
// athlete. Always visible in the race view so the TC can write at any time.
export default function RaceNoteField({ race, onSaved }) {
  const [note, setNote] = useState(race?.tcNote || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNote(race?.tcNote || '');
    setSaved(false);
  }, [race?.id, race?.tcNote]);

  const dirty = note !== (race?.tcNote || '');

  const save = async () => {
    setSaving(true);
    try {
      const patch = { tcNote: note };
      await tc.entities.Race.update(race.id, patch);
      onSaved?.(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-isu-navy/20 shadow-sm">
      <TcPanelHeader
        compact
        eyebrow="TCCube"
        title="Race note"
        subtitle="General note on this race for the TC — not per mark, not per athlete."
        actions={(
          <div className="flex items-center gap-2">
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <Button
              size="sm"
              onClick={save}
              disabled={saving || !dirty}
              className="bg-white text-isu-navy hover:bg-white/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Save note
            </Button>
          </div>
        )}
      />
      <div className="p-4">
        <Textarea
          value={note}
          onChange={(e) => { setNote(e.target.value); setSaved(false); }}
          rows={3}
          placeholder="Anything the TC wants to record about this race…"
          className="text-sm resize-y"
        />
      </div>
    </div>
  );
}