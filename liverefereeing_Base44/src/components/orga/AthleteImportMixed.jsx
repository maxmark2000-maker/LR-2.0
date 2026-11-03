import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { orga } from '@/lib/cubeClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle2, X } from 'lucide-react';
import CountryFlag from '@/components/tc/CountryFlag';

const GENDER_KEYS = {
  M: 'MEN', MALE: 'MEN', MEN: 'MEN', MENNEN: 'MEN', HERREN: 'MEN', JUN: 'MEN',
  W: 'WOMEN', F: 'WOMEN', FEMALE: 'WOMEN', WOMEN: 'WOMEN', DAMEN: 'WOMEN', LADIES: 'WOMEN', WOM: 'WOMEN',
};

function detectGender(value) {
  const v = String(value || '').trim().toUpperCase();
  if (!v) return '';
  if (GENDER_KEYS[v]) return GENDER_KEYS[v];
  if (v.startsWith('M')) return 'MEN';
  if (v.startsWith('W') || v.startsWith('F') || v.startsWith('D') || v.startsWith('L')) return 'WOMEN';
  return '';
}

function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => {
      const raw = r || {};
      const get = (...keys) => {
        for (const k of keys) {
          if (raw[k] != null && String(raw[k]).trim()) return String(raw[k]).trim();
        }
        return '';
      };
      const firstName = get('firstName', 'first name', 'firstname', 'givenName', 'First Name');
      const lastName = get('lastName', 'last name', 'lastname', 'surname', 'familyName', 'Last Name');
      const country = (get('country', 'Country', 'nation', 'NAT', 'code') || '').toUpperCase();
      const helmetNumber = String(get('helmetNumber', 'helmet', 'number', 'no', 'nr', 'bib', 'startNumber', 'Helmet No', 'Helmet no.') || '').trim();
      const genderRaw = get('gender', 'sex', 'Gender', 'Sex', 'category', 'Category', 'class', 'division');

      let fn = firstName;
      let ln = lastName;
      if (!fn && !ln) {
        const name = get('name', 'Name', 'athlete', 'Athlete');
        if (name) {
          const parts = name.split(/\s+/);
          fn = parts[0] || '';
          ln = parts.slice(1).join(' ') || '';
        }
      }
      return { firstName: fn, lastName: ln, country, helmetNumber, gender: detectGender(genderRaw) };
    })
    .filter((a) => a.helmetNumber && (a.firstName || a.lastName || a.country));
}

export default function AthleteImportMixed({ competitionId, existingByGender, onDone }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setRows([]); setResult(null); setBusy(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await orga.invoke('extractAthletes', { fileUrl: file_url });
      const list = res?.data?.athletes || [];
      const normalized = normalizeRows(list).sort((a, b) => {
        const na = parseInt(a.helmetNumber, 10); const nb = parseInt(b.helmetNumber, 10);
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return String(a.helmetNumber).localeCompare(String(b.helmetNumber));
      });
      if (normalized.length === 0) {
        setError('No athletes found. Expected columns: firstName, lastName, country, helmetNumber, gender.');
        setBusy(false);
        return;
      }
      setRows(normalized);
    } catch (err) {
      setError(err.message || 'Could not read the file.');
    }
    setBusy(false);
  };

  const setRowGender = (i, g) => setRows(rows.map((r, idx) => (idx === i ? { ...r, gender: g } : r)));
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const confirm = async () => {
    setBusy(true);
    setError(''); setResult(null);
    const used = {};
    for (const g of Object.keys(existingByGender || {})) used[g] = new Set(existingByGender[g]);
    const toCreate = [];
    const skip = [];
    for (const a of rows) {
      if (a.gender !== 'MEN' && a.gender !== 'WOMEN') { skip.push({ ...a, reason: 'gender not set' }); continue; }
      const set = used[a.gender];
      if (set.has(a.helmetNumber)) { skip.push({ ...a, reason: 'helmet exists' }); continue; }
      set.add(a.helmetNumber);
      toCreate.push({ competitionId, genderGroup: a.gender, firstName: a.firstName, lastName: a.lastName, country: a.country, helmetNumber: a.helmetNumber });
    }
    try {
      if (toCreate.length) await orga.entities.Athlete.bulkCreate(toCreate);
      setResult({ imported: toCreate.length, skipped: skip.length, men: toCreate.filter((a) => a.genderGroup === 'MEN').length, women: toCreate.filter((a) => a.genderGroup === 'WOMEN').length });
      setRows([]);
      onDone();
    } catch (err) {
      setError(err.message || 'Could not import athletes.');
    }
    setBusy(false);
  };

  const unresolved = rows.filter((r) => r.gender !== 'MEN' && r.gender !== 'WOMEN').length;

  return (
    <div className="mb-6 rounded-lg border border-dashed border-border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Upload className="w-4 h-4 text-isu-blue" /> Import helmet number list (MEN + WOMEN)
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload a CSV, Excel, JSON or PDF file with both men and women. Expected columns: firstName, lastName, country, helmetNumber, gender. Athletes are split into the right group automatically.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Input type="file" accept=".csv,.xlsx,.xls,.json,.tsv,.pdf" onChange={onFile} disabled={busy} className="max-w-xs text-xs" />
        {rows.length > 0 && (
          <Button size="sm" onClick={confirm} disabled={busy || unresolved > 0} className="bg-isu-blue hover:bg-isu-navy">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Import {rows.length} athletes
          </Button>
        )}
        {rows.length > 0 && <Button size="sm" variant="ghost" onClick={() => setRows([])} disabled={busy}>Cancel</Button>}
      </div>

      {busy && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-isu-blue rounded-full animate-spin" />
          Reading file and extracting athletes…
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {result && (
        <p className="mt-2 text-sm text-emerald-700">
          {result.imported} imported ({result.men} MEN, {result.women} WOMEN){result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.
        </p>
      )}
      {unresolved > 0 && <p className="mt-2 text-sm text-amber-700">{unresolved} athlete(s) need a gender assigned before importing.</p>}

      {rows.length > 0 && (
        <div className="mt-4 max-h-80 overflow-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left p-2">No.</th>
                <th className="text-left p-2">Country</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Helmet</th>
                <th className="text-left p-2">Gender</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2"><div className="flex items-center gap-1.5"><CountryFlag country={a.country} /><span>{a.country}</span></div></td>
                  <td className="p-2 font-medium">{[a.firstName, a.lastName].filter(Boolean).join(' ') || a.country}</td>
                  <td className="p-2">{a.helmetNumber}</td>
                  <td className="p-2">
                    <Select value={a.gender} onValueChange={(v) => setRowGender(i, v)}>
                      <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEN">MEN</SelectItem>
                        <SelectItem value="WOMEN">WOMEN</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeRow(i)}>
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