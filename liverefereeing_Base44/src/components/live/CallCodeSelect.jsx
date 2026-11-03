import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CALL_CODES } from '@/lib/isu';

export default function CallCodeSelect({ value, onValueChange, disabled, label }) {
  const [open, setOpen] = useState(false);
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled} open={open} onOpenChange={setOpen}>
      <SelectTrigger aria-label={label} className="h-9 w-full"><SelectValue>{value || '—'}</SelectValue></SelectTrigger>
      {open && <SelectContent className="max-h-[420px]">
        {CALL_CODES.map((code) => <SelectItem key={code} value={code} className="text-xs">{code}</SelectItem>)}
      </SelectContent>}
    </Select>
  );
}