import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { computeRefereeScores } from '@/lib/refereeScore';
import { ChevronDown } from 'lucide-react';
import TcPanelHeader from '@/components/tc/TcPanelHeader';
import RefereeRaceDetail from '@/components/tc/RefereeRaceDetail';

const fmtPct = (v) => `${(v * 100).toFixed(1)}%`;
const agreementTone = (v) =>
  v >= 0.75 ? 'bg-emerald-100 text-emerald-800' : v >= 0.5 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';

export default function RefereeScoreBoard({ competition, races, athletes, calls, refereeFunctions, matchMode }) {
  const ranking = useMemo(
    () => computeRefereeScores({
      races,
      athletes,
      calls,
      defaultScoringMarks: competition?.defaultScoringMarks,
      refereeFunctions,
      matchMode,
    }),
    [races, athletes, calls, competition?.defaultScoringMarks, refereeFunctions, matchMode]
  );

  const ranked = ranking.map((r, i) => ({ ...r, rank: i + 1 }));
  const [expandedKey, setExpandedKey] = useState(null);
  const toggle = (key) => setExpandedKey((prev) => (prev === key ? null : key));

  return (
    <Card className="overflow-hidden border-isu-navy/20 shadow-md">
      <TcPanelHeader
        eyebrow="TCCube · Referee statistics"
        title="TC Referee Statistics"
        chips={[competition?.name || 'competition']}
      />
      <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Only the official Final Call is scored. A Mark is one point: Mark Score = correct components ÷ all components of that Mark.
              A Mark where NO CALL is set for every athlete counts as a single component. Extra marks or calls a referee
              submitted that are not part of the Final Call never lower the score. The agreement view above
              decides whether a right athlete with a wrong code in the same category counts as correct (Lenient)
              or only an exactly matching code does (Strict).
            </p>

        {ranked.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No scored races yet. Once final decisions are entered and referees have submitted calls, the statistics appear here.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[860px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-semibold w-12">#</th>
                  <th className="py-2 pr-3 font-semibold w-56">Referee</th>
                  <th className="py-2 pr-3 font-semibold text-right">Races</th>
                  <th className="py-2 pr-3 font-semibold text-right">Final Marks</th>
                  <th className="py-2 pr-3 font-semibold text-right">Complete</th>
                  <th className="py-2 pr-3 font-semibold text-right">Partial</th>
                  <th className="py-2 pr-3 font-semibold text-right">Missed</th>
                  <th className="py-2 pr-3 font-semibold text-right">Components</th>
                  <th className="py-2 pr-3 font-semibold text-right">Agreement</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => (
                  <React.Fragment key={r.key}>
                    <tr
                      className="border-b border-border align-middle cursor-pointer hover:bg-accent/40 transition-colors"
                      onClick={() => toggle(r.key)}
                    >
                      <td className="py-2 pr-3">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${r.rank <= 3 ? 'bg-isu-blue text-white' : 'bg-secondary text-secondary-foreground'}`}>
                          {r.rank}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-medium w-56">
                        <span className="inline-flex items-center gap-1.5">
                          <ChevronDown className={`w-4 h-4 transition-transform ${expandedKey === r.key ? 'rotate-180' : ''} text-muted-foreground`} />
                          {r.name}
                          {r.function && <Badge className="ml-1 bg-isu-blue text-white text-[10px] tracking-wider align-middle">{r.function}</Badge>}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.raceCount}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.marksEvaluated}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 font-semibold">{r.marksPerfect}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-amber-700 font-semibold">{r.marksPartial}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-destructive font-semibold">{r.marksMissed}</td>
                      <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                        <div>{r.correctComponents}/{r.totalComponents}</div>
                        <div className="text-[10px] text-muted-foreground">{fmtPct(r.componentAgreement)}</div>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold tabular-nums ${agreementTone(r.markAgreement)}`}>
                          {fmtPct(r.markAgreement)}
                        </span>
                      </td>
                    </tr>
                    {expandedKey === r.key && (
                      <tr className="bg-secondary/30">
                        <td colSpan={9} className="p-4">
                          <RefereeRaceDetail referee={r} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}