import React, { useState } from 'react';
import { orga } from '@/lib/cubeClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { UserPlus, KeyRound } from 'lucide-react';
import { generatePassword } from '@/lib/refereeMail';
import RefereeMailActions from '@/components/orga/RefereeMailActions';
import { GENDERS } from '@/lib/isu';

export default function RefereeCreateForm({ onCreated }) {
  const [form, setForm] = useState({ displayName: '', username: '', country: '', password: '', function: 'NONE' });
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const create = async (e) => {
    e.preventDefault();
    setCreated(null);
    if (!form.displayName.trim() || !form.username.trim() || !form.country.trim() || form.password.length < 6) {
      setError('Name, username, country and a password of at least 6 characters are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await orga.invoke('refereeCreate', {
        displayName: form.displayName,
        username: form.username,
        country: form.country.trim().toUpperCase(),
        password: form.password,
        function: form.function,
        assignedCompetitionIds: [],
        assignedGenderGroups: GENDERS,
      });
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      setCreated({
        displayName: res.data?.referee?.displayName || form.displayName,
        username: res.data?.referee?.username || form.username,
        password: form.password,
      });
      setForm({ displayName: '', username: '', country: '', password: '', function: 'NONE' });
      await onCreated?.();
    } catch (err) {
      setError(err.message || 'Could not create referee.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-4">
      <h3 className="font-heading font-bold">Create a new referee account</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        The account is created without competition access — tick the competitions on the account below afterwards.
      </p>

      <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-4">
        <Input placeholder="Referee name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <Input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="font-mono text-xs" />
        <Input placeholder="Country (GER)" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
        <div className="relative">
          <Input
            type="password"
            placeholder="Password (min. 6 chars)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="pr-9"
          />
          <button
            type="button"
            title="Generate a password"
            onClick={() => setForm({ ...form, password: generatePassword() })}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <KeyRound className="w-4 h-4" />
          </button>
        </div>
        <Select value={form.function} onValueChange={(v) => setForm({ ...form, function: v })}>
          <SelectTrigger className="text-xs"><SelectValue placeholder="Function" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE" className="text-xs">A-List Referee</SelectItem>
            <SelectItem value="TC" className="text-xs">TC-Member (TC)</SelectItem>
            <SelectItem value="APPR" className="text-xs">Apprentice (APPR)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground sm:col-span-2 self-center">
          New accounts get access to all three Cubes (MEN, WOMEN, MIXED). Use the key icon to generate a password.
        </p>
        <Button type="submit" disabled={saving} className="bg-isu-blue hover:bg-isu-navy">
          <UserPlus className="w-4 h-4 mr-1" /> {saving ? 'Creating…' : 'Create account'}
        </Button>
        {error && <p className="text-sm text-destructive sm:col-span-3">{error}</p>}
      </form>

      {created && (
        <div className="mt-4 rounded-lg border border-isu-blue/40 bg-isu-blue/5 p-4">
          <p className="text-sm font-medium">Credentials for {created.displayName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Username</span>
            <span className="font-mono">{created.username}</span>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Password</span>
            <span className="font-mono">{created.password}</span>
          </div>
          <div className="mt-3">
            <RefereeMailActions credentials={created} />
          </div>
        </div>
      )}
    </div>
  );
}