import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { orga } from '@/lib/cubeClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import AthleteCopyFrom from '@/components/orga/AthleteCopyFrom';
import AthleteImport from '@/components/orga/AthleteImport';
import CountryFlag from '@/components/tc/CountryFlag';
import { athleteLabel, isMixedAthlete, isTeamGender } from '@/lib/isu';

const EMPTY = { firstName: '', lastName: '', country: '', helmetNumber: '' };

export default function AthleteManager({ competitionId, gender, athletes, canEdit, onChange }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const team = isTeamGender(gender);

  const add = async (e) => {
    e.preventDefault();
    if (team) {
      // Relay / mixed teams are identified by their country only — they have no helmet number.
      if (!form.country.trim()) {
        setError('Country is required for a relay team.');
        return;
      }
    } else {
      const missing = Object.keys(EMPTY).filter((k) => !form[k].trim());
      if (missing.length) {
        setError('All fields are required: first name, last name, country, helmet number.');
        return;
      }
    }
    if (!team && athletes.some((a) => a.helmetNumber === form.helmetNumber.trim())) {
      setError('Helmet number is already used in this gender group.');
      return;
    }
    if (team && athletes.some((a) => a.country === form.country.trim().toUpperCase())) {
      setError('This country already has a team in this category.');
      return;
    }
    setError('');
    setSaving(true);
    await orga.entities.Athlete.create({
      competitionId,
      genderGroup: gender,
      firstName: team ? form.country.trim().toUpperCase() : form.firstName.trim(),
      lastName: team ? '' : form.lastName.trim(),
      country: form.country.trim().toUpperCase(),
      helmetNumber: team ? '' : form.helmetNumber.trim(),
    });
    setForm(EMPTY);
    setSaving(false);
    onChange();
  };

  const remove = async (id) => {
    await orga.entities.Athlete.delete(id);
    onChange();
  };

  const byHelmet = (a, b) => {
    const na = parseInt(a.helmetNumber, 10);
    const nb = parseInt(b.helmetNumber, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.helmetNumber).localeCompare(String(b.helmetNumber));
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-heading font-bold text-lg">{gender} athletes ({athletes.length})</h3>

        {canEdit && (
          <form onSubmit={add} className={`mt-5 grid gap-3 sm:grid-cols-2 ${team ? 'lg:grid-cols-3' : 'lg:grid-cols-5'}`}>
            {!team && (
              <Input placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            )}
            {!team && (
              <Input placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            )}
            <Input placeholder="Country (GER)" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            {!team && (
              <Input placeholder="Helmet no." value={form.helmetNumber} onChange={(e) => setForm({ ...form, helmetNumber: e.target.value })} />
            )}
            <Button type="submit" disabled={saving} className="bg-isu-blue hover:bg-isu-navy">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
            {error && <p className="text-sm text-destructive sm:col-span-2 lg:col-span-5">{error}</p>}
          </form>
        )}

        {canEdit && (
          <AthleteImport
            competitionId={competitionId}
            gender={gender}
            existingHelmetNumbers={athletes.map((a) => a.helmetNumber)}
            onDone={onChange}
          />
        )}

        {canEdit && (
          <AthleteCopyFrom
            competitionId={competitionId}
            gender={gender}
            existingHelmetNumbers={athletes.map((a) => a.helmetNumber)}
            existingCountries={athletes.map((a) => a.country)}
            onDone={onChange}
          />
        )}

        <div className="mt-6 divide-y">
          {athletes.length === 0 && <p className="text-sm text-muted-foreground">No {gender.toLowerCase()} athletes registered yet.</p>}
          {[...athletes].sort(byHelmet).map((a) => (
            <div key={a.id} className="grid items-center py-2.5 text-sm" style={{ gridTemplateColumns: '2.5rem 1.75rem 1fr 3.5rem 2.25rem', columnGap: '0.75rem' }}>
              <span className="h-8 rounded bg-isu-navy text-white flex items-center justify-center font-semibold text-xs">{a.helmetNumber || a.country}</span>
              <CountryFlag country={a.country} />
              <span className="font-medium truncate">{athleteLabel(a)}</span>
              <span className="text-muted-foreground">{!isMixedAthlete(a) ? a.country : ''}</span>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => remove(a.id)} className="h-7 w-7 text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}