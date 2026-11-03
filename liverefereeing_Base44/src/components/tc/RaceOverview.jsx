import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Flag, Printer } from 'lucide-react';
import { revisionReason } from '@/lib/isu';
import { ALL_MARKS, raceRefereeAgreement, finalCallMarkGroups } from '@/lib/refereeScore';
import { refereesWithCalls, refereeFlagSummary } from '@/lib/refereeFlags';
import { exportDebriefPdf } from '@/lib/racePdf';
import TcPanelHeader from '@/components/tc/TcPanelHeader';

// A mark or race is highlighted once at least this share of its referees does
// not match the Final Call.
export const DISAGREE_THRESHOLD = 0.6;

const pct = (v) => `${Math.round(v * 100)}%`;
const markLabel = (m) => m.replace('MARK', 'Mark ');

function agreementTone(ratio, referees) {
  if (!referees) return 'text-muted-foreground';
  if (ratio >= DISAGREE_THRESHOLD) return 'text-red-700 font-bold';
  if (ratio >= 0.3) return 'text-amber-700 font-semibold';
  return 'text-emerald-700 font-semibold';
}

// Fill colour of the small bar under a mark's disagreement share.
function disagreeBarTone(ratio) {
  if (ratio >= DISAGREE_THRESHOLD) return 'bg-red-500';
  if (ratio >= 0.3) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export default function RaceOverview({ competition, races, rounds, athletes, calls, revisions, onOpenRace, matchMode, refereeFlags = [], referees = [] }) {
  const athleteById = {};
  (athletes || []).forEach((a) => { athleteById[a.id] = a; });

  // Personal referee review flags, grouped per race.
  const flagsByRace = {};
  (refereeFlags || []).forEach((f) => {
    if (!f.raceId) return;
    (flagsByRace[f.raceId] = flagsByRace[f.raceId] || []).push(f);
  });
  const roundById = {};
  (rounds || []).forEach((r) => { roundById[r.id] = r; });

  const callsByRace = {};
  (calls || []).forEach((c) => {
    if (!c.raceId) return;
    (callsByRace[c.raceId] = callsByRace[c.raceId] || []).push(c);
  });

  const rows = [...(races || [])]
    .sort((a, b) => a.raceNumber - b.raceNumber)
    .map((race) => {
      const raceAthletes = (race.athleteIds || []).map((id) => athleteById[id]).filter(Boolean);
      const raceCalls = callsByRace[race.id] || [];
      return {
        race,
        round: roundById[race.roundId],
        hasFinalDecision: finalCallMarkGroups(race, raceAthletes, competition?.defaultScoringMarks).length > 0,
        agreement: raceRefereeAgreement(race, raceAthletes, raceCalls, competition?.defaultScoringMarks, matchMode),
        refereeAttention: refereeFlagSummary(flagsByRace[race.id] || [], refereesWithCalls(raceCalls, referees)),
      };
    });

  const flaggedCount = rows.filter((r) => r.race.flagged).length;
  const revisedCount = rows.filter((r) => r.race.finalDecisionRevised).length;
  const debriefCount = (revisions || []).filter((r) => r.reason === 'DEBRIEF').length;
  const criticalCount = rows.filter(
    (r) => r.hasFinalDecision && r.agreement.referees > 0 && r.agreement.disagreeRatio >= DISAGREE_THRESHOLD
  ).length;

  return (
    <Card className="overflow-hidden border-isu-navy/20 shadow-md">
      <TcPanelHeader
        eyebrow="TCCube · Race overview"
        title="Race overview"
        subtitle={`${competition?.name || 'This competition'} — every race by race number, with its calls, flag, final-decision change and how far the referees match the Final Call in each mark.`}
        actions={(
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportDebriefPdf({ competition, revisions, rounds, athletes })}
              disabled={debriefCount === 0}
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Export debrief changes (PDF)
            </Button>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1">
              <Flag className="w-3.5 h-3.5" /> {flaggedCount} flagged
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1">
              {revisedCount} changed
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 font-semibold text-white">
              <AlertTriangle className="w-3.5 h-3.5" /> {criticalCount} with ≥{pct(DISAGREE_THRESHOLD)} disagreement
            </span>
          </>
        )}
      />
      <CardContent className="p-6">

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No races have been created for this competition yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[1000px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-semibold">Race</th>
                  <th className="py-2 pr-3 font-semibold">Round</th>
                  <th className="py-2 pr-3 font-semibold whitespace-nowrap">Flagged by TC</th>
                  <th className="py-2 pr-3 font-semibold">Referee attention</th>
                  <th className="py-2 pr-3 font-semibold">Final decision changed</th>
                  {ALL_MARKS.map((mark) => (
                    <th key={mark} className="py-2 pr-3 font-semibold">{markLabel(mark)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ race, round, agreement, hasFinalDecision, refereeAttention }) => {
                  const critical = hasFinalDecision && agreement.referees > 0 && agreement.disagreeRatio >= DISAGREE_THRESHOLD;
                  return (
                    <tr
                      key={race.id}
                      onClick={() => onOpenRace?.(race)}
                      className={`border-b border-border align-middle cursor-pointer hover:bg-accent/50 ${critical ? 'bg-red-50' : ''}`}
                    >
                      <td className={`py-2 pr-3 border-l-4 ${critical ? 'border-red-500' : 'border-transparent'}`}>
                        <span className="w-9 h-9 rounded bg-isu-navy text-white inline-flex items-center justify-center text-xs font-semibold">
                          {race.raceNumber}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        {round ? (
                          <span className="text-xs">
                            <span className="font-semibold">{round.genderGroup}</span>
                            <span className="text-muted-foreground"> · {round.type}{round.distance ? ` · ${round.distance}` : ''}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {race.flagged ? (
                          <span className="inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                            <Flag className="w-3.5 h-3.5" /> Flagged
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {refereeAttention.reached ? (
                          <span className="inline-flex flex-col items-start gap-0.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              <Flag className="w-3 h-3" /> Referee Attention
                            </span>
                            <span className="text-[11px] text-orange-800/80">
                              {refereeAttention.count} / {refereeAttention.total} referees · {pct(refereeAttention.ratio)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {race.finalDecisionRevised ? (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <Badge className={`text-[10px] tracking-wider ${revisionReason(race.finalDecisionRevisionReason).badgeClass}`}>
                              {revisionReason(race.finalDecisionRevisionReason).badge}
                            </Badge>
                            {race.finalDecisionRevisedAt && (
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(race.finalDecisionRevisedAt).toLocaleDateString()}
                              </span>
                            )}
                          </span>
                        ) : !hasFinalDecision ? (
                          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> No Final decision entered yet
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      {ALL_MARKS.map((mark) => {
                        const stat = agreement.marks.find((m) => m.mark === mark);
                        return (
                          <td key={mark} className="py-2 pr-3">
                            {stat ? (
                              <span
                                className="inline-flex min-w-[4rem] flex-col items-start gap-1"
                                title={`${markLabel(mark)}: ${stat.disagreeing} of ${stat.referees} referees did not match the Final Call`}
                              >
                                <span className="inline-flex items-baseline gap-1">
                                  <span className={`text-sm tabular-nums ${agreementTone(stat.disagreeRatio, stat.referees)}`}>
                                    {pct(stat.disagreeRatio)}
                                  </span>
                                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">different call</span>
                                </span>
                                <span className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                  <span
                                    className={`block h-full rounded-full ${disagreeBarTone(stat.disagreeRatio)}`}
                                    style={{ width: pct(stat.disagreeRatio) }}
                                  />
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Each mark column shows the share of referees whose calls did not match the Final Call in that mark — a
          referee counts as disagreeing on a mark when it is not fully matched.{' '}
          {matchMode === 'lenient'
            ? 'Lenient view: a right athlete with a wrong code still counts as correct while the code stays in the same category (e.g. S6 instead of S8), and a missing ADV is not a disagreement. ADV, DNF, DNS, NO CALL and any other code switch in place of a penalty code always count as wrong.'
            : 'Strict view: the athlete and the code both have to match exactly.'}{' '}
          Rows in red: at least {pct(DISAGREE_THRESHOLD)} disagreement in the race. Races without a Final decision
          entered are not rated and stay unhighlighted. Click a race to open it in the Race Aggregation.
          “Referee Attention” marks races that at least half of the referees who called the race flagged for their own
          review — it is informational and never an official TC flag.
        </p>
      </CardContent>
    </Card>
  );
}