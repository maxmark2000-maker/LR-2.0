import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { orga } from '@/lib/cubeClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { UserPlus, Trash2, KeyRound } from 'lucide-react';
import { generatePassword } from '@/lib/refereeMail';
import RefereeMailActions from '@/components/orga/RefereeMailActions';
import { GENDERS } from '@/lib/isu';

export default function RefereeManager({ competitionId, canEdit }) {
  const [referees, setReferees] = useState([]);
  const [form, setForm] = useState({ displayName: '', username: '', password: '', function: 'NONE' });
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const load = async () => {
    const all = await orga.entities.Referee.list('-created_date');
    setReferees(all);
  };

  useEffect(() => { load(); }, [competitionId]);

  const isAssigned = (r) => (r.assignedCompetitionIds || []).includes(competitionId);

  const toggleAssignment = async (r) => {
    setTogglingId(r.id);
    const assigned = r.assignedCompetitionIds || [];
    const next = isAssigned(r) ? assigned.filter((id) => id !== competitionId) : [...assigned, competitionId];
    await orga.entities.Referee.update(r.id, { assignedCompetitionIds: next });
    setTogglingId(null);
    load();
  };

  const removeReferee = async (r) => {
    if (!window.confirm(`Delete referee "${r.displayName}" (${r.username})? This cannot be undone.`)) return;
    setTogglingId(r.id);
    try {
      await orga.entities.Referee.delete(r.id);
    } catch (e) {
      setError(e.message || 'Could not delete referee.');
    }
    setTogglingId(null);
    load();
  };

  const create = async (e) => {
    e.preventDefault();
    setCreated(null);
    if (!form.displayName.trim() || !form.username.trim() || form.password.length !== 6) {
      setError('Name, username and a password of exactly 6 characters are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await orga.invoke('refereeCreate', {
        ...form,
        assignedCompetitionIds: [competitionId],
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
      setForm({ displayName: '', username: '', password: '', function: 'NONE' });
      await load();
    } catch (err) {
      setError(err.message || 'Could not create referee.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-heading font-bold text-lg">LiveRefereeing Cube provisioning</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Only ORGACube can issue referee credentials. Each referee is provisioned for this competition and the selected gender groups.
        </p>

        {canEdit && (
          <form onSubmit={create} className="mt-6 grid gap-3 sm:grid-cols-4">
            <Input placeholder="Referee name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            <Input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <div className="relative">
              <Input
                type="password"
                placeholder="Password (6 characters)"
                maxLength={6}
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
                <SelectItem value="NONE" className="text-xs">Standard referee</SelectItem>
                <SelectItem value="TC" className="text-xs">TC-Member (TC)</SelectItem>
                <SelectItem value="APPR" className="text-xs">Apprentice (APPR)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground sm:col-span-2 self-center">
              New referees get access to every gender group, including both relay categories. Use the key icon to generate a password.
            </p>
            <Button type="submit" disabled={saving} className="bg-isu-blue hover:bg-isu-navy">
              <UserPlus className="w-4 h-4 mr-1" /> {saving ? 'Creating…' : 'Create credentials'}
            </Button>
            {error && <p className="text-sm text-destructive sm:col-span-3">{error}</p>}
          </form>
        )}

        {canEdit && created && (
          <div className="mt-4 rounded-lg border border-isu-blue/40 bg-isu-blue/5 p-4">
            <p className="text-sm font-medium">Credentials for {created.displayName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Username</span>
              <span className="font-mono">{created.username}</span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Password</span>
              <span className="font-mono">{created.password}</span>
            </div>
            <RefereeMailActions credentials={created} className="mt-3" />
          </div>
        )}

        {canEdit && (
          <div className="mt-8">
            <h4 className="font-heading font-semibold">Enable referees for this competition</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Toggle which provisioned referees participate in this competition. Disabled referees cannot see it in LiveRefereeing.
            </p>
            <div className="mt-4 divide-y">
              {referees.length === 0 && <p className="text-sm text-muted-foreground">No referees provisioned yet.</p>}
              {referees.map((r) => (
                <div key={r.id} className="py-3 flex flex-wrap items-center gap-3 text-sm">
                  <Checkbox
                    checked={isAssigned(r)}
                    disabled={togglingId === r.id}
                    onCheckedChange={() => toggleAssignment(r)}
                  />
                  <span className="font-medium">{r.displayName}</span>
                  <span className="text-muted-foreground font-mono text-xs">{r.username}</span>
                  {r.function && r.function !== 'NONE' && (
                    <Badge className="bg-isu-blue text-white text-[10px] tracking-wider">{r.function}</Badge>
                  )}
                  {(r.assignedGenderGroups || []).map((g) => (
                    <Badge key={g} variant="secondary" className="text-[10px] tracking-wider">{g}</Badge>
                  ))}
                  {isAssigned(r) ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px] tracking-wider">Enabled</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not participating</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeReferee(r)}
                    disabled={togglingId === r.id}
                    title="Delete referee"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <h4 className="font-heading font-semibold">Provisioned for this competition</h4>
          <div className="mt-4 divide-y">
            {referees.filter(isAssigned).length === 0 && <p className="text-sm text-muted-foreground">No referees enabled for this competition yet.</p>}
            {referees.filter(isAssigned).map((r) => (
              <div key={r.id} className="py-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{r.displayName}</span>
                <span className="text-muted-foreground font-mono text-xs">{r.username}</span>
                {(r.assignedGenderGroups || []).map((g) => (
                  <Badge key={g} variant="secondary" className="text-[10px] tracking-wider">{g}</Badge>
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}