import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDown, Check, X, Flag } from 'lucide-react';
import CountryFlag from '@/components/tc/CountryFlag';
import FinalDecision from '@/components/tc/FinalDecision';
import RaceNoteField from '@/components/tc/RaceNoteField';
import CallFrequencyChart from '@/components/tc/CallFrequencyChart';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import TcPanelHeader from '@/components/tc/TcPanelHeader';
import { athleteLabel, isMixedAthlete, callTone, findYc2Athletes } from '@/lib/isu';
import { codesMatch } from '@/lib/refereeScore';
import { parseMarkCountries, MarkCountryFocus } from '@/components/MarkCountries';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import RefereeAttentionStrip from '@/components/tc/RefereeAttentionStrip';
import RefereeParticipation from '@/components/tc/RefereeParticipation';
import { refereesWithCalls, registeredReferees, countRefereesWithCalls } from '@/lib/refereeFlags';

export default function RaceAggregation({ competition, round, race, athletes, calls, refereeFunctions, onExport, onRaceUpdated, onToggleFlag, flagBusy, matchMode, refereeFlags = [], referees = [] }) {
  const MARKS = ['MARK1', 'MARK2', 'MARK3', 'MARK4', 'MARK5'];
  // Referees who called this race — the base for the majority count.
  const attentionBase = refereesWithCalls(calls, referees);
  // Referees registered for this competition, and how many already called.
  const registered = registeredReferees(referees, race?.competitionId, race?.genderGroup);
  const calledCount = countRefereesWithCalls(registered, calls);
  const finalMarks = (() => {
    try {
      return JSON.parse(race?.finalDecision || '{}').marks || {};
    } catch {
      return {};
    }
  })();
  const byReferee = calls.reduce((acc, c) => {
    const key = c.refereeName || c.refereeId;
    acc[key] = acc[key] || [];
    acc[key].push(c);
    return acc;
  }, {});
  const counts = calls.reduce((acc, c) => {
    acc[c.callCode] = (acc[c.callCode] || 0) + 1;
    return acc;
  }, {});
  const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [filterMark, setFilterMark] = React.useState('ALL');
  const [filterMode, setFilterMode] = React.useState('ALL');

  const callStatus = (c, mark) => {
    const finalCode = mark && c.athleteId ? finalMarks[`${c.athleteId}|${mark}`] || '' : '';
    return finalCode ? codesMatch(finalCode, c.callCode, matchMode) : null;
  };
  const filteredReferees = Object.keys(byReferee).filter((name) => {
    if (filterMark === 'ALL' || filterMode === 'ALL') return true;
    const list = byReferee[name].filter((c) => (c.mark || '') === filterMark);
    return filterMode === 'CORRECT'
      ? list.some((c) => callStatus(c, filterMark) === true)
      : list.some((c) => callStatus(c, filterMark) === false);
  });

  const resolveFunction = (list) => {
    const refId = list.find((c) => c.refereeId)?.refereeId;
    return (refId && refereeFunctions?.[refId]) || list.find((c) => c.refereeFunction)?.refereeFunction;
  };
  const tcReferees = filteredReferees.filter((name) => resolveFunction(byReferee[name]) === 'TC');
  const standardReferees = filteredReferees.filter((name) => resolveFunction(byReferee[name]) !== 'TC');

  const renderRefereeTable = (names, title) => {
    const visibleMarks = filterMark === 'ALL' ? MARKS : [filterMark];
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 pr-3 font-semibold w-52">{title}</th>
              {visibleMarks.map((m) => (
                <th key={m} className="py-2 pr-3 font-semibold text-left">
                  <div className="flex flex-col items-start gap-0.5">
                    <span>{m}</span>
                    <MarkCountryFocus markCountries={parseMarkCountries(race?.markCountries)} mark={m} />
                  </div>
                </th>
              ))}
              <th className="py-2 pr-3 font-semibold text-left">Other</th>
              <th className="py-2 pr-3 font-semibold text-left">YC-2</th>
            </tr>
          </thead>
          <tbody>
            {names.length === 0 ? (
              <tr><td colSpan={3 + visibleMarks.length} className="py-6 text-center text-muted-foreground text-sm">No referees.</td></tr>
            ) : (
              names.map((name) => {
                const list = byReferee[name];
                const renderCell = (items, mark) => (
                  <td className="py-2 pr-3 text-xs align-top">
                    {items.length === 0 ? (
                      <div className="flex items-center justify-start min-h-[2.5rem]">
                        <span className="text-muted-foreground">—</span>
                      </div>
                    ) : (
                      <div className="flex justify-start min-h-[2.5rem]">
                        <div className="flex flex-col items-start gap-1.5">
                          {items.map((c) => {
                          const athlete = athletes.find((a) => a.id === c.athleteId);
                          const tone = callTone(c.callCode);
                          const finalCode = mark && c.athleteId ? finalMarks[`${c.athleteId}|${mark}`] || '' : '';
                          const matchesFinal = finalCode ? codesMatch(finalCode, c.callCode, matchMode) : null;
                          return (
                            <div key={c.id} className="flex items-center gap-1">
                              {c.helmetNumber && <Badge className={`${tone} hover:opacity-90 font-mono justify-center`}>{c.helmetNumber}</Badge>}
                              {athlete?.country && <Badge className={`${tone} hover:opacity-90 font-mono justify-center`}>{athlete.country}</Badge>}
                              <Badge className={`${tone} hover:opacity-90 font-mono justify-center whitespace-nowrap`}>{c.callCode}</Badge>
                              {matchesFinal === true && (
                                <span className="inline-flex items-center gap-0.5 shrink-0">
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white shadow-sm">
                                    <Check className="w-3 h-3" strokeWidth={3} />
                                  </span>
                                  {finalCode !== c.callCode && (
                                    <span className="text-[10px] font-bold text-amber-700" title="Right athlete, code differs">≈</span>
                                  )}
                                </span>
                              )}
                              {matchesFinal === false && (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-white shadow-sm shrink-0">
                                  <X className="w-3 h-3" strokeWidth={3} />
                                </span>
                              )}
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    )}
                  </td>
                );
                const byHelmet = (a, b) => (parseInt(a.helmetNumber, 10) || 999) - (parseInt(b.helmetNumber, 10) || 999);
                const fn = resolveFunction(list);
                // This referee's own review flag for the race, if any (matched by id, then name).
                const refereeId = list.find((c) => c.refereeId)?.refereeId;
                const rowFlag = refereeFlags.find((f) => (refereeId && f.refereeId === refereeId) || f.refereeName === name) || null;
                return (
                  <tr key={name} className="border-b border-border">
                    <td className="py-2 pr-3 font-medium whitespace-nowrap align-top w-52">
                      <span className="inline-flex items-center gap-1">
                        {name}
                        {rowFlag && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex cursor-help items-center text-amber-600">
                                <Flag className="w-3 h-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This referee flagged this race for review.</p>
                              {rowFlag.videoTimestamp && <p>Video timestamp: {rowFlag.videoTimestamp}</p>}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      {fn && <Badge className="ml-2 bg-isu-blue text-white text-[10px] tracking-wider align-middle">{fn}</Badge>}
                    </td>
                    {visibleMarks.map((m) => renderCell(list.filter((c) => (c.mark || '') === m).sort(byHelmet), m))}
                    {renderCell(list.filter((c) => !MARKS.includes((c.mark || ''))).sort(byHelmet))}
                    <td className="py-2 pr-3 text-xs align-top">
                      {(() => {
                        const yc2 = findYc2Athletes(list);
                        if (yc2.length === 0) {
                          return <div className="flex items-center justify-start min-h-[2.5rem]"><span className="text-muted-foreground">—</span></div>;
                        }
                        return (
                          <div className="flex justify-center min-h-[2.5rem]">
                            <div className="flex flex-col items-start gap-1.5">
                              {yc2.map((id) => {
                                const athlete = athletes.find((a) => a.id === id);
                                if (!athlete) return null;
                                return (
                                  <div key={id} className="flex items-center gap-1">
                                    <Badge className="bg-isu-navy text-white font-mono justify-center">{athlete.helmetNumber || athlete.country}</Badge>
                                    <Badge className="bg-yellow-400 text-yellow-950 font-mono justify-center whitespace-nowrap">YC-2</Badge>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <TooltipProvider>
    <Card className="overflow-hidden border-isu-navy/20 shadow-md">
      <TcPanelHeader
        eyebrow="TCCube · Race aggregation"
        title={`${round?.type} · Race ${race.raceNumber}`}
        subtitle={`${round?.genderGroup} · ${calls.length} call(s) from ${Object.keys(byReferee).length} referee(s)`}
        actions={(
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleFlag}
              disabled={flagBusy}
              className={race.flagged
                ? 'border-amber-300 bg-amber-500 text-white hover:bg-amber-600 hover:text-white'
                : 'border-amber-300 bg-white/10 text-white hover:bg-white/20 hover:text-white'}
            >
              <Flag className="w-4 h-4 mr-2" />
              {race.flagged ? 'Unflag race' : 'Flag this race'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport({ competition, round, race, athletes, calls })}
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <FileDown className="w-4 h-4 mr-2" /> Export PDF
            </Button>
          </>
        )}
      />
      <CardContent className="p-6">

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Athletes</p>
            <div className="mt-3 grid gap-y-2 text-base" style={{ gridTemplateColumns: '3rem 2.75rem 1fr 4.5rem', columnGap: '0.6rem' }}>
              {athletes.length === 0 && <p className="text-muted-foreground col-span-4">No athletes assigned.</p>}
              {athletes.map((a) => (
                <React.Fragment key={a.id}>
                  <span className="font-mono text-sm bg-secondary rounded flex items-center justify-center h-8">{a.helmetNumber || a.country}</span>
                  <span className="flex items-center"><CountryFlag country={a.country} width={26} height={18} /></span>
                  <span className="flex items-center truncate font-medium">{athleteLabel(a)}</span>
                  <span className="flex items-center text-muted-foreground text-xs">{!isMixedAthlete(a) ? a.country : ''}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Aggregated summary · call frequency</p>
            {calls.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No calls submitted.</p>
            ) : (
              <div className="mt-3">
                <CallFrequencyChart athletes={athletes} calls={calls} />
              </div>
            )}
          </div>
        </div>

        <RaceNoteField race={race} onSaved={(patch) => onRaceUpdated?.(race.id, patch)} />

        <FinalDecision race={race} athletes={athletes} onSaved={(patch) => onRaceUpdated?.(race.id, patch)} />

        <div className="mt-6 overflow-hidden rounded-lg border border-isu-navy/20 shadow-sm">
          <TcPanelHeader
            compact
            eyebrow="TCCube"
            title="Referees × marks"
            subtitle="Every referee's submitted calls per mark, compared with the official Final Call."
          />
          <div className="p-4">
          <RefereeParticipation registered={registered} called={calledCount} />
          <RefereeAttentionStrip flags={refereeFlags} eligible={attentionBase} />
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Select value={filterMark} onValueChange={setFilterMark}>
              <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All marks</SelectItem>
                {MARKS.map((m) => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMode} onValueChange={setFilterMode} disabled={filterMark === 'ALL'}>
              <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All referees</SelectItem>
                <SelectItem value="CORRECT" className="text-xs">Correct ✓ only</SelectItem>
                <SelectItem value="WRONG" className="text-xs">Wrong ✗ only</SelectItem>
              </SelectContent>
            </Select>
            {filterMark !== 'ALL' && filterMode !== 'ALL' && (
              <span className="text-xs text-muted-foreground">{filteredReferees.length} of {Object.keys(byReferee).length} referee(s)</span>
            )}
          </div>
          {calls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calls submitted.</p>
          ) : (
            <div className="space-y-6">
              {tcReferees.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-isu-blue/30">
                    <span className="inline-flex items-center justify-center rounded bg-isu-navy text-white text-[11px] font-bold uppercase tracking-wider px-2 py-0.5">TC</span>
                    <h4 className="font-heading font-bold text-sm text-foreground">TC Members</h4>
                    <span className="text-xs text-muted-foreground">({tcReferees.length})</span>
                  </div>
                  {renderRefereeTable(tcReferees, 'TC Member')}
                </div>
              )}
              {standardReferees.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                    <span className="inline-flex items-center justify-center rounded bg-secondary text-secondary-foreground text-[11px] font-bold uppercase tracking-wider px-2 py-0.5">REF</span>
                    <h4 className="font-heading font-bold text-sm text-foreground">Referees</h4>
                    <span className="text-xs text-muted-foreground">({standardReferees.length})</span>
                  </div>
                  {renderRefereeTable(standardReferees, 'Referee')}
                </div>
              )}
            </div>
          )}
          </div>
        </div>

      </CardContent>
    </Card>
    </TooltipProvider>
  );
}