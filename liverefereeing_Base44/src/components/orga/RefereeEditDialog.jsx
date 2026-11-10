import React, { useState } from 'react';
import { orga } from '@/lib/cubeClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Save } from 'lucide-react';
import CountryFlag from '@/components/tc/CountryFlag';
import RefereeMailActions from '@/components/orga/RefereeMailActions';
import RefereeCompetitionPicker from '@/components/orga/RefereeCompetitionPicker';

export default function RefereeEditDialog({ referee, competitions, onClose, onSaved }) {
  const [form, setForm] = useState({
    displayName: referee.displayName || '',
    username: referee.username || '',
    country: referee.country || '',
    password: '',
    function: referee.function || 'NONE',
    active: referee.active !== false,
    // Drop assignments to competitions that no longer exist, so the picker and
    // its counter only ever show real competitions.
    assignedCompetitionIds: (referee.assignedCompetitionIds || []).filter((id) =>
      (competitions || []).some((c) => c.id === id)
    ),
  });
  const [resetCredentials, setResetCredentials] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const toggleComp = (id) => {
    const ids = form.assignedCompetitionIds;
    set({ assignedCompetitionIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  };

  const save = async () => {
    if (!form.country.trim()) {
      setError('A country of origin is required.');
      return;
    }
    if (form.password && form.password.length !== 6) {
      setError('New password must be exactly 6 characters. Leave empty to keep the current password.');
      return;
    }
    setSaving(true);
    setError('');
    setResetCredentials(null);
    try {
      const res = await orga.invoke('refereeUpdate', {
        refereeId: referee.id,
        displayName: form.displayName,
        username: form.username,
        country: form.country.trim().toUpperCase(),
        password: form.password || undefined,
        function: form.function,
        active: form.active,
        assignedCompetitionIds: form.assignedCompetitionIds,
      });
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      if (form.password) {
        // This stays in browser memory only and is shown after a successful reset.
        setResetCredentials({ displayName: form.displayName, username: form.username, password: form.password });
        setForm((current) => ({ ...current, password: '' }));
        await onSaved?.();
      } else {
        await onSaved?.();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{referee.displayName || 'Referee'}</DialogTitle>
          <DialogDescription>Account details, function and competition assignments.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ref-name" className="text-xs">Display name</Label>
            <Input id="ref-name" value={form.displayName} onChange={(e) => set({ displayName: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ref-user" className="text-xs">Username</Label>
            <Input id="ref-user" value={form.username} onChange={(e) => set({ username: e.target.value })} className="font-mono text-sm" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ref-country" className="text-xs">Country of origin (GER)</Label>
            <div className="flex items-center gap-2">
              <Input id="ref-country" value={form.country} onChange={(e) => set({ country: e.target.value.toUpperCase() })} placeholder="GER" />
              <CountryFlag country={form.country} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ref-pass" className="text-xs">New password (exactly 6 characters; leave empty to keep)</Label>
            <Input id="ref-pass" type="password" value={form.password} onChange={(e) => set({ password: e.target.value })} maxLength={6} placeholder="••••••" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Function</Label>
            <Select value={form.function} onValueChange={(v) => set({ function: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">A-List Referee</SelectItem>
                <SelectItem value="TC">TC-Member (TC)</SelectItem>
                <SelectItem value="APPR">Apprentice (APPR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-muted/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">Existing passwords cannot be viewed. Enter a new password above to reset.</span>
          <label className="flex items-center gap-2 text-sm ml-auto">
            <Checkbox checked={form.active} onCheckedChange={(v) => set({ active: !!v })} /> Active
          </label>
        </div>
        {resetCredentials && (
          <div className="rounded-md border border-isu-blue/40 bg-isu-blue/5 p-3">
            <p className="text-sm font-medium">Password reset successfully — shown once</p>
            <p className="mt-1 text-xs text-muted-foreground">Copy it now or provide it using a secure channel. This password is not saved for later viewing.</p>
            <p className="mt-2 font-mono text-sm break-all">{resetCredentials.password}</p>
            <RefereeMailActions credentials={resetCredentials} className="mt-2" />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs">Competitions</Label>
          <RefereeCompetitionPicker
            competitions={competitions}
            selected={form.assignedCompetitionIds}
            onToggle={toggleComp}
            onSetAll={(ids) => set({ assignedCompetitionIds: ids })}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-isu-blue hover:bg-isu-navy">
            <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}