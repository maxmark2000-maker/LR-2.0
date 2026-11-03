import React, { useState } from 'react';
import { orga } from '@/lib/cubeClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Eye, EyeOff, Save } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const mailPassword = referee.passwordPlain || form.password;
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
    setSaving(true);
    setError('');
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
      onSaved();
      onClose();
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
            <Label htmlFor="ref-pass" className="text-xs">New password (leave empty to keep)</Label>
            <Input id="ref-pass" type="password" value={form.password} onChange={(e) => set({ password: e.target.value })} placeholder="••••••••" />
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
          <span className="text-xs text-muted-foreground">Current password</span>
          {referee.passwordPlain ? (
            <span className="inline-flex items-center gap-1">
              <span className="font-mono text-xs">{showPassword ? referee.passwordPlain : '••••••••'}</span>
              <button
                type="button"
                title={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">not stored — set a new one</span>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.active} onCheckedChange={(v) => set({ active: !!v })} /> Active
          </label>
          <RefereeMailActions
            credentials={{ displayName: form.displayName, username: form.username, password: mailPassword }}
            disabled={!mailPassword}
            className="ml-auto"
          />
        </div>

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