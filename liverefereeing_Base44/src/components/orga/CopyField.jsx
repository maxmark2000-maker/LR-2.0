import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

const FIELD = 'w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm font-mono';

export default function CopyField({ label, value, multiline = false }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    ref.current.select();
    document.execCommand('copy');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {multiline ? (
        <textarea ref={ref} readOnly value={value} rows={14} className={`${FIELD} resize-none`} />
      ) : (
        <input ref={ref} readOnly value={value} className={FIELD} />
      )}
    </div>
  );
}