import React from 'react';
import { Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

// How many of the referees registered for the competition have already sent a
// call for this race — lets the TC see who is still missing.
export default function RefereeParticipation({ registered = [], called = 0 }) {
  const total = registered.length;
  if (total === 0) return null;

  const pct = Math.round((called / total) * 100);
  const missing = total - called;

  return (
    <div className="mb-3 rounded-lg border border-isu-navy/15 bg-secondary/50 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Users className="w-3.5 h-3.5 text-isu-blue" /> Referee participation
        </span>
        <span className="text-sm text-muted-foreground">
          {called} of {total} registered referees have submitted a call for this race.
        </span>
        <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
        {missing > 0 && <span className="text-xs text-amber-700">· {missing} still missing</span>}
      </div>
      <Progress value={pct} className="mt-2 h-1.5 bg-isu-navy/15" />
    </div>
  );
}