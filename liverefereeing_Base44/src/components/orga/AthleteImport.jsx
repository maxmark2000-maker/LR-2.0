import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { orga } from '@/lib/cubeClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, CheckCircle2, X } from 'lucide-react';
import CountryFlag from '@/components/tc/CountryFlag';
import { athleteLabel, isTeamGender } from '@/lib/isu';

// Normalize extracted rows into athlete records for this gender group.
function normalizeRows(rows, gender) {
  const team = isTeamGender(gender);
  return (Array.isArray(rows) ? rows : [])
    .map((r) => {
      const raw = r || {};
      const get = (...keys) => {
        for (const k of keys) {
          if (raw[k] != null && String(raw[k]).trim()) return String(raw[k]).trim();
        }
        return '';
      };
      let country = (get('country', 'Country', 'nation', 'NAT', 'code') || '').toUpperCase();
      let firstName = get('firstName', 'first name', 'firstname', 'givenName', 'First Name');
      let lastName = get('lastName', 'last name', 'lastname', 'surname', 'familyName', 'Last Name');
      const helmetNumber = String(get('helmetNumber', 'helmet', 'number', 'no', 'nr', 'bib', 'startNumber', 'Helmet No', 'Helmet no.') || '').trim();

      // Fallback: a single "name" field split into first/last
      if (!firstName && !lastName) {
        const name = get('name', 'Name', 'athlete', 'Athlete');
        if (name) {
          const parts = name.split(/\s+/);
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || '';
        }
      }

      if (team) {
        firstName = country || firstName;
        lastName = '';
      }

      return { firstName, lastName, country, helmetNumber };
    })
    .filter((a) => a.helmetNumber && (a.firstName || a.lastName || a.country));
}

export default function AthleteImport({ competitionId, gender, existingHelmetNumbers, onDone }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(0);
  const [skipped, setSkipped] = useState([]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setRows([]); setDone(0); setSkipped([]); setBusy(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await orga.invoke('extractAthletes', { fileUrl: file_url });
      const list = res?.data?.athletes || [];
      const normalized = normalizeRows(list, gender).sort((a, b) => {
        const na = parseInt(a.helmetNumber, 10); const nb = parseInt(b.helmetNumber, 10);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return String(a.helmetNumber).localeCompare(String(b.helmetNumber));
      });
      if (normalized.length === 0) {
        setError('No athletes found in the file. Expected columns: firstName, lastName, country, helmetNumber.');
        setBusy(false);
        return;
      }
      setRows(normalized);
    } catch (err) {
      setError(err.message || 'Could not read the file.');
    }
    setBusy(false);
  };

  const confirm = async () => {
    setBusy(true);
    const used = new Set(existingHelmetNumbers);
    const toCreate = [];
    const skip = [];
    for (const a of rows) {
      if (used.has(a.helmetNumber)) { skip.push(a); continue; }
      used.add(a.helmetNumber);
      toCreate.push({ ...a, competitionId, genderGroup: gender });
    }
    try {
      if (toCreate.length) await orga.entities.Athlete.bulkCreate(toCreate);
      setDone(toCreate.length);
      setSkipped(skip);
      setRows([]);
      onDone();
    } catch (err) {
      setError(err.message || 'Could not import athletes.');
    }
    setBusy(false);
  };

  return (
    <div className="mt-5 rounded-lg border border-dashed border-border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Upload className="w-4 h-4 text-isu-blue" /> Import athletes from a list
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload a CSV, Excel, JSON or PDF file (including ISU "List of Competitors" PDFs). Columns recognised: firstName, lastName, country, helmetNumber.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Input type="file" accept=".csv,.xlsx,.xls,.json,.tsv,.pdf" onChange={onFile} disabled={busy} className="max-w-xs text-xs" />
        {rows.length > 0 && (
          <Button size="sm" onClick={confirm} disabled={busy} className="bg-isu-blue hover:bg-isu-navy">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Import {rows.length} athletes
          </Button>
        )}
        {rows.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setRows([])} disabled={busy}>Cancel</Button>
        )}
      </div>

      {busy && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-isu-blue rounded-full animate-spin" />
          Reading file and extracting athletes…
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {done > 0 && <p className="mt-2 text-sm text-emerald-700">{done} athletes imported.</p>}
      {skipped.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{skipped.length} skipped — helmet number already exists.</p>}

      {rows.length > 0 && (
        <div className="mt-4 max-h-64 overflow-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left p-2">No.</th>
                <th className="text-left p-2">Country</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Helmet</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2"><div className="flex items-center gap-1.5"><CountryFlag country={a.country} /><span>{a.country}</span></div></td>
                  <td className="p-2 font-medium">{athleteLabel(a)}</td>
                  <td className="p-2">{a.helmetNumber}</td>
                  <td className="p-2 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}