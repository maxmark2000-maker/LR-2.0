import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { orga } from '@/lib/cubeClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy } from 'lucide-react';

export default function AthleteCopyFrom({ competitionId, gender, existingHelmetNumbers, existingCountries = [], onDone }) {
  const [open, setOpen] = useState(false);
  const [competitions, setCompetitions] = useState([]);
  const [sourceId, setSourceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const toggle = async () => {
    if (!open) {
      const list = await orga.entities.Competition.list('-created_date', 100);
      setCompetitions(list.filter((c) => c.id !== competitionId));
      setMsg('');
    }
    setOpen((o) => !o);
  };

  const copy = async () => {
    if (!sourceId) {
      setMsg('Select a competition to copy from.');
      return;
    }
    setBusy(true);
    setMsg('');
    const source = await orga.entities.Athlete.filter({ competitionId: sourceId, genderGroup: gender });
    const toCreate = source
      // Relay teams carry no helmet number, so they are matched by country instead.
      .filter((a) => (a.helmetNumber ? !existingHelmetNumbers.includes(a.helmetNumber) : !existingCountries.includes(a.country)))
      .map((a) => ({
        competitionId,
        genderGroup: gender,
        firstName: a.firstName,
        lastName: a.lastName,
        country: a.country,
        helmetNumber: a.helmetNumber,
      }));
    if (toCreate.length === 0) {
      setMsg('Nothing to copy — all ' + gender.toLowerCase() + ' athletes already exist here.');
      setBusy(false);
      return;
    }
    await orga.entities.Athlete.bulkCreate(toCreate);
    setMsg(`Copied ${toCreate.length} ${gender.toLowerCase()} athlete(s). You can now edit them here.`);
    setBusy(false);
    onDone();
  };

  return (
    <div className="mt-5">
      <Button type="button" variant="outline" size="sm" onClick={toggle}>
        <Copy className="w-4 h-4 mr-1" /> Copy from another competition
      </Button>
      {open && (
        <div className="mt-3">
          {competitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other competitions available to copy from yet.</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger className="sm:w-72"><SelectValue placeholder="Source competition" /></SelectTrigger>
                <SelectContent>
                  {competitions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" onClick={copy} disabled={busy} className="bg-isu-blue hover:bg-isu-navy">
                {busy ? 'Copying…' : `Copy ${gender} athletes`}
              </Button>
              {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}