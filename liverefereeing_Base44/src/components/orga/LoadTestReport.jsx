import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const stat = (label, value) => (
  <div key={label}>
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="font-heading text-xl font-extrabold text-isu-navy">{value}</p>
  </div>
);

const probeState = (probe) => (probe.status === 200
  ? { label: `OK · ${probe.ms} ms`, className: 'bg-emerald-600' }
  : { label: probe.status ? `${probe.status} · ${probe.error || 'Failed'}` : 'Failed', className: 'bg-destructive' });

export default function LoadTestReport({ report }) {
  if (!report) return null;
  return (
    <div className="space-y-4">
      {report.rounds.map((round) => (
        <Card key={round.round}>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-heading text-lg font-bold text-isu-navy">
                {report.mode === 'login'
                  ? `${report.sessions} simultaneous sign-ins`
                  : report.mode === 'signin'
                    ? `${report.sessions} sign-ins, sheet opened right after`
                    : `Run ${round.round} · ${report.sessions} simultaneous sessions`}
              </h3>
              <Badge className={round.failed ? 'bg-destructive' : 'bg-emerald-600'}>
                {round.failed ? `${round.failed} failed` : report.mode === 'signin' ? 'All in, all sheets loaded' : 'All sheets loaded'}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
              {stat('Loaded', `${round.ok} / ${report.sessions}`)}
              {stat('Median', `${round.medianMs} ms`)}
              {stat('Fastest', `${round.minMs} ms`)}
              {stat('Slowest', `${round.maxMs} ms`)}
              {stat('Total', `${(round.totalMs / 1000).toFixed(1)} s`)}
            </div>
            {round.failures.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm text-destructive">
                {round.failures.map((failure) => (
                  <li key={failure.reason}>{failure.count}× {failure.reason}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
      {report.phases && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-heading text-lg font-bold text-isu-navy">Where the time went</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Every referee signed in and opened the call sheet the moment they were in. The two phases are measured apart.
            </p>
            <div className="mt-4 space-y-5">
              {[['Sign-in', report.phases.signIn], ['Call sheet', report.phases.sheet]].map(([label, phase]) => (
                <div key={label}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-heading text-sm font-bold uppercase tracking-wide text-isu-navy">{label}</p>
                    <Badge className={phase.failed ? 'bg-destructive' : 'bg-emerald-600'}>
                      {phase.failed ? `${phase.failed} failed` : `${phase.ok} / ${report.sessions} ok`}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-4">
                    {stat('Median', `${phase.medianMs} ms`)}
                    {stat('Fastest', `${phase.minMs} ms`)}
                    {stat('Slowest', `${phase.maxMs} ms`)}
                  </div>
                  {phase.failures.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-destructive">
                      {phase.failures.map((failure) => (
                        <li key={failure.reason}>{failure.count}× {failure.reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {report.probes?.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-heading text-lg font-bold text-isu-navy">Could the Cubes still be opened?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Read probes run right after the sign-in wave and again 6 and 12 seconds later.
            </p>
            <div className="mt-4 space-y-3">
              {report.probes.map((probe, index) => {
                const orga = probeState(probe.orga);
                const tc = probeState(probe.tc);
                return (
                  <div key={index} className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="w-28 text-muted-foreground">
                      {probe.afterMs === 0 ? 'Immediately' : `After ${probe.afterMs / 1000} s`}
                    </span>
                    <Badge className={orga.className}>ORGACube: {orga.label}</Badge>
                    <Badge className={tc.className}>TCCube: {tc.label}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}