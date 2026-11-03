import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WorkspaceLoadNotice({ loading, error, onRetry, label = 'Loading call sheet…' }) {
  if (!loading && !error) return null;
  return (
    <div role={error ? 'alert' : 'status'} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-4 text-sm">
      {loading ? <><Loader2 className="h-4 w-4 animate-spin text-primary" /><span>{label}</span></> :
        <><span className="text-destructive">{error}</span><Button size="sm" variant="outline" onClick={onRetry}>Try again</Button></>}
    </div>
  );
}