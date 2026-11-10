import React, { useMemo, useState } from 'react';
import { orga } from '@/lib/cubeClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Pencil, Trash2 } from 'lucide-react';
import RefereeEditDialog from '@/components/orga/RefereeEditDialog';
import CountryFlag from '@/components/tc/CountryFlag';
import IsuLogo from '@/components/orga/IsuLogo';

const FUNCTION_LABELS = { TC: 'TC-Member', APPR: 'Apprentice', NONE: 'A-List Referee' };

export default function RefereeAccountsTable({ referees, competitions, onChanged }) {
  const [query, setQuery] = useState('');
  const [functionFilter, setFunctionFilter] = useState('ALL');
  const [compFilter, setCompFilter] = useState('ALL');
  const [editing, setEditing] = useState(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return referees.filter((r) => {
      const matchesQuery = !q || (r.displayName || '').toLowerCase().includes(q) || (r.username || '').toLowerCase().includes(q);
      const matchesFunction = functionFilter === 'ALL' || (r.function || 'NONE') === functionFilter;
      const matchesComp = compFilter === 'ALL' || (r.assignedCompetitionIds || []).includes(compFilter);
      return matchesQuery && matchesFunction && matchesComp;
    });
  }, [referees, query, functionFilter, compFilter]);

  const toggleConfirmed = async (r) => {
    await orga.entities.Referee.update(r.id, { loginConfirmed: !r.loginConfirmed });
    onChanged();
  };

  const toggleActive = async (r) => {
    await orga.entities.Referee.update(r.id, { active: !r.active });
    onChanged();
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete referee "${r.displayName}" (${r.username})? This cannot be undone.`)) return;
    await orga.entities.Referee.delete(r.id);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or username"
            className="h-8 w-[240px] pl-7 text-xs"
          />
        </div>
        <Select value={functionFilter} onValueChange={setFunctionFilter}>
          <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All functions</SelectItem>
            <SelectItem value="TC" className="text-xs">TC-Member</SelectItem>
            <SelectItem value="APPR" className="text-xs">Apprentice (APPR)</SelectItem>
            <SelectItem value="NONE" className="text-xs">A-List Referee</SelectItem>
          </SelectContent>
        </Select>
        <Select value={compFilter} onValueChange={setCompFilter}>
          <SelectTrigger className="h-8 w-[240px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL" className="text-xs">All competitions</SelectItem>
            {(competitions || []).map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} of {referees.length} referees
        </span>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[24%]">Referee</TableHead>
              <TableHead className="w-[14%]">Function</TableHead>
              <TableHead className="w-[16%]">Country</TableHead>
              <TableHead className="w-[16%]">Password security</TableHead>
              <TableHead className="w-[12%]">Login confirmed</TableHead>
              <TableHead className="w-[10%]">Status</TableHead>
              <TableHead className="w-[8%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  No referees match the current filters.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.displayName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.username}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.function && r.function !== 'NONE' ? 'default' : 'secondary'} className={r.function === 'TC' ? 'bg-isu-blue text-[10px]' : 'text-[10px]'}>
                      {FUNCTION_LABELS[r.function || 'NONE']}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      {r.function === 'TC' ? (
                        <IsuLogo height={18} />
                      ) : (
                        <>
                          {r.country ? (
                            <CountryFlag country={r.country} width={32} height={22} />
                          ) : null}
                          <span className="text-xs text-muted-foreground">{r.country || '—'}</span>
                        </>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">Hidden · reset in Edit</span>
                  </TableCell>
                  <TableCell>
                    <label className="flex items-center gap-2 cursor-pointer" title="Tick when the referee confirmed the login">
                      <Checkbox
                        checked={!!r.loginConfirmed}
                        onCheckedChange={() => toggleConfirmed(r)}
                      />
                      <span className="text-xs text-muted-foreground">{r.loginConfirmed ? 'confirmed' : 'pending'}</span>
                    </label>
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => toggleActive(r)} title="Toggle active">
                      <Badge
                        className={r.active ? 'bg-emerald-600 hover:bg-emerald-600 text-[10px] tracking-wider' : 'bg-muted text-muted-foreground text-[10px] tracking-wider'}
                      >
                        {r.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(r)} title="Edit referee">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(r)} title="Delete referee">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <RefereeEditDialog
          referee={editing}
          competitions={competitions}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}