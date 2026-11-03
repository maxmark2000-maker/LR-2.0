import React from 'react';
import { ChevronDown, Eraser, Info, ListOrdered, Send, Ban, Tv } from 'lucide-react';
import CountryFlag from '@/components/tc/CountryFlag';

const MARKS = ['MARK1', 'MARK2', 'MARK3', 'MARK4', 'MARK5'];

// Two marks carry the country pair of the reviewed situation, exactly like the
// real call sheet does in the livestream.
const MARK_FOCUS = {
  MARK1: ['KOR', 'CAN'],
  MARK3: ['KOR', 'POL'],
};

// Fictional athletes: the real names shown in the original screenshot are
// replaced so the example never points at actual skaters.
const ATHLETES = [
  { number: '3', name: 'Marc DELACROIX', country: 'CAN', calls: {} },
  { number: '4', name: 'Jihoon PARK', country: 'KOR', calls: {} },
  { number: '6', name: 'Seungho LIM', country: 'KOR', calls: {} },
  { number: '12', name: 'Matteo ROSSI', country: 'ITA', calls: {} },
  { number: '29', name: 'Louis MERCIER', country: 'CAN', calls: { MARK1: 'SR', MARK2: 'C1' } },
  { number: '36', name: 'Jack THOMPSON', country: 'AUS', calls: { MARK1: 'SR' } },
  { number: '39', name: 'Piotr KOWALSKI', country: 'POL', calls: {} },
  { number: '167', name: 'A. MOREAU', country: 'FRA', calls: {} },
];

function EmptyCell() {
  return (
    <div className="flex h-8 items-center justify-between rounded-md border border-input bg-white px-2 text-xs text-muted-foreground">
      <span>—</span>
      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
    </div>
  );
}

// Static, non-interactive illustration of the referee call sheet. It exists so a
// referee recognises the screen before signing in — nothing here submits calls.
export default function CallSheetExample() {
  return (
    <figure className="overflow-hidden rounded-xl border border-isu-navy/20 bg-white shadow-md">
      <div className="relative overflow-hidden bg-gradient-to-r from-isu-navy via-isu-navy to-isu-blue px-6 py-5 text-white">
        <div className="pointer-events-none absolute -right-10 -top-20 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-24 h-40 w-40 rounded-full bg-isu-light/25 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-isu-light">Referee call sheet</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <h3 className="font-heading text-2xl font-bold leading-none">Call sheet</h3>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Race 118</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">Preliminaries</span>
              <span className="rounded-full bg-isu-light/25 px-3 py-1 text-xs font-semibold">1500M</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">MEN</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-amber-300/70 bg-amber-400/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-50">
              Example
            </span>
            <span className="inline-flex items-center rounded-md border border-white/40 bg-white/10 px-3 py-1.5 text-xs font-medium">
              <Eraser className="mr-1 h-3.5 w-3.5" /> Clear
            </span>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
          <div className="flex items-start gap-2 text-xs text-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-isu-blue" />
            <span>Enter a call code per athlete and mark, then send everything at once. Already submitted calls are shown inline.</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-amber-800">
            <Tv className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span><span className="font-semibold">Each MARK = one Yellow Box</span> in the livestream.</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ListOrdered className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Athlete order here does <span className="font-medium">not</span> reflect the official Start List order.</span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground md:text-sm">
                <th className="w-[6%] py-2 pr-2 font-semibold md:py-3">No.</th>
                <th className="w-[24%] py-2 pr-2 font-semibold md:py-3">Athlete</th>
                {MARKS.map((mark) => (
                  <th key={mark} className="w-[14%] px-1 py-2 text-center font-semibold md:py-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{mark}</span>
                      {MARK_FOCUS[mark] && (
                        <span className="flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
                          <CountryFlag country={MARK_FOCUS[mark][0]} />
                          <span>vs</span>
                          <CountryFlag country={MARK_FOCUS[mark][1]} />
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ATHLETES.map((athlete) => (
                <tr key={athlete.number} className="border-b border-border align-middle">
                  <td className="py-2 pr-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded bg-isu-navy text-xs font-semibold text-white">
                      {athlete.number}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <CountryFlag country={athlete.country} />
                      <div>
                        <div className="whitespace-nowrap font-medium">{athlete.name}</div>
                        <div className="text-xs text-muted-foreground">{athlete.country}</div>
                      </div>
                    </div>
                  </td>
                  {MARKS.map((mark) => (
                    <td key={mark} className="px-1 py-2 text-center">
                      {athlete.calls[mark] ? (
                        <span className="inline-flex items-center rounded bg-isu-navy px-2 py-1 font-mono text-xs text-white">
                          {athlete.calls[mark]}
                        </span>
                      ) : (
                        <EmptyCell />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-isu-blue px-4 py-2 text-sm font-medium text-white">
            <Send className="mr-1 h-4 w-4" /> Send all calls
          </span>
          <span className="inline-flex items-center rounded-md border border-input bg-white px-4 py-2 text-sm font-medium text-foreground">
            <Ban className="mr-1 h-4 w-4" /> NO CALL — nothing happened in this race
          </span>
        </div>

        <figcaption className="mt-4 border-t border-border pt-3 text-xs italic text-muted-foreground">
          Example — the Call Sheet as a referee sees it. Athletes, helmet numbers and calls are fictional.
        </figcaption>
      </div>
    </figure>
  );
}