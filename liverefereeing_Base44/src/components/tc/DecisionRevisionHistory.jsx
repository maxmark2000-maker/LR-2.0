import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { parseFinalDecision } from '@/lib/refereeScore';
import { revisionReason } from '@/lib/isu';

const markKey = (id, m) => `${id}|${m}`;

// Lists the changed Final Call components between two stored decision versions.
function changedComponents(original, next, athleteById) {
  const a = parseFinalDecision(original);
  const b = parseFinalDecision(next);
  const keys = new Set([...Object.keys(a.marks || {}), ...Object.keys(b.marks || {})]);
  const changes = [];
  keys.forEach((key) => {
    const from = a.marks[key] || '';
    const to = b.marks[key] || '';
    if (from === to) return;
    const [athleteId, mark] = key.split('|');
    const athlete = athleteById[athleteId];
    changes.push({
      label: athlete
        ? `${athlete.helmetNumber ? `${athlete.helmetNumber} ` : ''}${athlete.firstName} ${athlete.lastName}`
        : athleteId,
      mark,
      from: from || '—',
      to: to || '—',
    });
  });
  return changes;
}

export default function DecisionRevisionHistory({ revisions, athletes }) {
  if (!revisions || revisions.length === 0) return null;

  const athleteById = {};
  (athletes || []).forEach((a) => { athleteById[a.id] = a; });

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-10 h-10 rounded bg-amber-500 text-white flex items-center justify-center">
            <History className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-heading font-bold text-lg">Final Decision revision history</h3>
            <p className="text-sm text-muted-foreground">
              Every change to a Final Call is kept — the original version is never overwritten.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {revisions.map((rev) => {
            const changes = changedComponents(rev.originalDecision, rev.newDecision, athleteById);
            return (
              <div key={rev.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading font-bold text-sm">Race {rev.raceNumber}</span>
                  <Badge className={`text-[10px] tracking-wider ${revisionReason(rev.reason).badgeClass}`}>
                    {revisionReason(rev.reason).badge}
                  </Badge>
                  {rev.revisedAt && (
                    <span className="text-xs text-muted-foreground">{new Date(rev.revisedAt).toLocaleString()}</span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">{changes.length} changed component{changes.length !== 1 ? 's' : ''}</span>
                </div>
                {changes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {changes.map((c) => (
                      <span key={`${c.label}-${c.mark}`} className="text-xs">
                        <span className="font-semibold mr-1">{c.mark}</span>
                        {c.label}:
                        <span className="font-mono ml-1 text-muted-foreground">{c.from}</span>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className="font-mono font-semibold">{c.to}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}