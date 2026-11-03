import React, { useCallback, useEffect, useState } from 'react';
import { orga } from '@/lib/cubeClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { exportRefereeParticipationPdf } from '@/lib/refereeStatsPdf';
import StatisticsPdfOptions from '@/components/orga/StatisticsPdfOptions';

const when = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

function Summary({ totals }) {
  const items = [
    { label: 'Registered', value: totals.registered ?? 0 },
    { label: 'With calls', value: totals.participants ?? 0 },
    { label: 'Without calls', value: totals.withoutCalls ?? 0 },
    { label: 'Calls submitted', value: totals.totalCalls ?? 0 },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-secondary/40 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{item.label}</p>
          <p className="mt-1 font-heading text-2xl font-extrabold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function RefereeStatistics({ competitionId, competition }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [pdfColumns, setPdfColumns] = useState(['name', 'country', 'races']);
  const [pdfSort, setPdfSort] = useState('name');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orga.invoke('refereeStats', { competitionId });
      setStats(res.data);
      setError('');
    } catch (cause) {
      setError(cause.message || 'Could not load the referee statistics.');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => { load(); }, [load]);

  const rows = stats?.rows || [];
  const visible = onlyMissing ? rows.filter((row) => row.assigned && row.calls === 0) : rows;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-heading font-bold text-lg">Referee participation</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Calls submitted per referee in this competition — the basis for the participant list.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Refresh
            </Button>
            <Button
              size="sm"
              className="bg-isu-blue hover:bg-isu-navy"
              disabled={!rows.length || !pdfColumns.length}
              onClick={() => exportRefereeParticipationPdf({ competition, rows, columns: pdfColumns, sort: pdfSort })}
            >
              <Download className="w-4 h-4 mr-1" /> Participant list (PDF)
            </Button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {loading && !stats && (
          <p className="mt-6 text-sm text-muted-foreground">Counting calls…</p>
        )}

        {stats && (
          <>
            <div className="mt-5"><Summary totals={stats.totals || {}} /></div>

            <StatisticsPdfOptions
              columns={pdfColumns}
              onColumnsChange={setPdfColumns}
              sort={pdfSort}
              onSortChange={setPdfSort}
            />

            <label className="mt-5 flex items-center gap-3 text-sm text-muted-foreground">
              <Checkbox checked={onlyMissing} onCheckedChange={(value) => setOnlyMissing(!!value)} />
              <span>Show only registered referees without calls</span>
            </label>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Referee</th>
                    <th className="py-2 pr-3 font-semibold">Function</th>
                    <th className="py-2 pr-3 text-right font-semibold">Calls</th>
                    <th className="py-2 pr-3 text-right font-semibold">Races</th>
                    <th className="py-2 font-semibold">Last call</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        {rows.length ? 'Every registered referee has submitted calls.' : 'No referees registered for this competition yet.'}
                      </td>
                    </tr>
                  )}
                  {visible.map((row) => (
                    <tr key={row.refereeId || row.name} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <span className="font-medium">{row.name}</span>
                        {row.username && <span className="ml-2 font-mono text-xs text-muted-foreground">{row.username}</span>}
                        {!row.assigned && (
                          <Badge variant="secondary" className="ml-2 text-[10px] tracking-wider">not registered</Badge>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-xs uppercase tracking-wider text-muted-foreground">
                        {row.function && row.function !== 'NONE' ? row.function : 'Referee'}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {row.calls > 0 ? (
                          <span className="font-semibold">{row.calls}</span>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] tracking-wider">no calls</Badge>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-muted-foreground">{row.races}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{when(row.lastCall)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}