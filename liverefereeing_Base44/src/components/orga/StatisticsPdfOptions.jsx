import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'country', label: 'Country' },
  { key: 'races', label: 'Races with call' },
];

const SORTS = [
  { value: 'name', label: 'Alphabetical (A–Z)' },
  { value: 'country', label: 'By country' },
  { value: 'calls', label: 'Most calls first' },
];

export default function StatisticsPdfOptions({ columns, onColumnsChange, sort, onSortChange }) {
  const toggle = (key) =>
    onColumnsChange(COLUMNS.map((c) => c.key).filter((k) => (k === key ? !columns.includes(k) : columns.includes(k))));

  return (
    <div className="mt-5 rounded-lg border bg-secondary/30 p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Content of the PDF</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        {COLUMNS.map((column) => (
          <label key={column.key} className="flex items-center gap-2 text-sm">
            <Checkbox checked={columns.includes(column.key)} onCheckedChange={() => toggle(column.key)} />
            <span>{column.label}</span>
          </label>
        ))}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by</span>
          <Select value={sort} onValueChange={onSortChange}>
            <SelectTrigger className="h-8 w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORTS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {!columns.length && <p className="mt-2 text-xs text-destructive">Select at least one column.</p>}
    </div>
  );
}