import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import VideoTimestampEditor from '@/components/live/VideoTimestampEditor';
import { genderLabel } from '@/lib/refereeFlags';
import { isRelayGender } from '@/lib/isu';

const statusClass = (isClosed) => (isClosed
  ? 'border-border bg-secondary text-muted-foreground'
  : 'border-emerald-200 bg-emerald-50 text-emerald-700');

// Only the signed-in referee's own review flags — never another referee's.
export default function MyFlaggedRaces({ entries = [], onOpen, onSaveTimestamp, onRemove, busyRaceId = null }) {
  return (
    <Card className="overflow-hidden border-isu-navy/20 shadow-md">
      <div className="relative overflow-hidden bg-gradient-to-r from-isu-navy via-isu-navy to-isu-blue px-6 py-4 text-white">
        <div className="pointer-events-none absolute -right-10 -top-20 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-isu-light">Personal review</p>
            <h3 className="mt-1 font-heading text-lg font-bold leading-none">My flagged races</h3>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">My Flagged Races · {entries.length}</span>
        </div>
      </div>
      <CardContent className="p-6">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No races flagged for review yet. Use “Flag for Review” on a race to keep it here.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((entry) => {
              const busy = busyRaceId === entry.raceId;
              // The relay categories already carry their distance in their name.
              const category = [
                genderLabel(entry.genderGroup),
                isRelayGender(entry.genderGroup) ? '' : entry.distance,
              ].filter(Boolean).join(' ');
              return (
                <div key={entry.raceId} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="font-medium">
                      Race {entry.raceNumber}{category ? ` · ${category}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.competitionName}{entry.competitionDate ? ` · ${entry.competitionDate}` : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className={`rounded border px-2 py-0.5 ${statusClass(entry.isClosed)}`}>
                        {entry.isClosed ? 'Race closed' : 'Race open'}
                      </span>
                      {entry.hasFinalDecision && (
                        <span className="rounded border border-isu-blue/30 bg-accent px-2 py-0.5 text-isu-navy">
                          Final Decision available
                        </span>
                      )}
                      {entry.finalDecisionRevised && (
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                          Final Decision revised
                        </span>
                      )}
                    </div>
                    <VideoTimestampEditor
                      value={entry.videoTimestamp || ''}
                      busy={busy}
                      onSave={(videoTimestamp) => onSaveTimestamp(entry.raceId, videoTimestamp)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button size="sm" variant="outline" onClick={() => onOpen(entry)}>Open Race</Button>
                    <button
                      type="button"
                      onClick={() => onRemove(entry.raceId)}
                      disabled={busy}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Unflag
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}