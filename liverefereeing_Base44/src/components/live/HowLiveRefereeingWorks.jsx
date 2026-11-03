import React from 'react';
import {
  Flag, Gavel, Send, CheckCheck, Info, AlertTriangle, Target, ChevronRight, ChevronDown,
} from 'lucide-react';
import CallSheetExample from '@/components/live/CallSheetExample';

const CALL_CODES = ['S1–S9', 'C1–C5', 'ST1–ST6', 'F1–F6', 'R1–R6', 'SR', 'NRV', 'ADV', 'OFF', 'ASS', 'EQP', 'EMB', 'Relay codes', 'Card codes'];

const STEPS = [
  {
    n: 1,
    icon: Flag,
    label: 'Race',
    title: 'Open a race',
    body: 'Select the race you want to review.',
    points: [
      { text: 'Each race contains the participating athletes.' },
      { text: 'Up to five MARKS represent separate race situations within the race.' },
    ],
  },
  {
    n: 2,
    icon: Gavel,
    label: 'Make Calls',
    title: 'Submit your own calls',
    body: 'In the Call Sheet, enter your own decision for each relevant athlete and MARK.',
    codeIntro: 'Use the official Short Track call codes such as:',
    points: [
      { text: 'ADV means Advancement and is not a Penalty.' },
      { text: 'SR means Shared Responsibility and results in no Penalty.' },
      { text: 'NRV means No Rule Violation.' },
      { text: 'A MARK represents one individual race situation.' },
    ],
    note: 'Calls should be entered independently, based on what you see in the race.',
  },
  {
    n: 3,
    icon: Send,
    label: 'Submit',
    title: 'Send your calls',
    body: 'Once your decisions are complete, submit all calls for the race.',
    points: [
      { text: 'Submitted calls are saved and cannot accidentally be mixed with another race.' },
    ],
    callout: 'NO CALL — nothing happened in this race',
  },
  {
    n: 4,
    icon: CheckCheck,
    label: 'Compare',
    title: 'Compare with the Final Decision',
    body: 'After the official Final Decision is available, the referee can open the Final Decision Sheet and sees:',
    points: [
      { text: 'The official decision for each MARK' },
      { text: 'Their own submitted decision' },
      { text: 'A green check when the decision matches', tone: 'match' },
      { text: 'A red indicator when the decision differs or is missing', tone: 'mismatch' },
    ],
    note: 'The purpose is not only to see whether a call was right or wrong, but to compare the referee’s interpretation of the race situation with the official decision and learn from it.',
  },
];

const dotTone = (tone) => {
  if (tone === 'match') return 'bg-emerald-500';
  if (tone === 'mismatch') return 'bg-red-500';
  return 'bg-isu-blue/60';
};

function StepCard({ step, last }) {
  const Icon = step.icon;
  return (
    <li className="relative flex flex-col">
      <div className="flex flex-1 flex-col rounded-xl border border-isu-navy/15 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-isu-navy to-isu-blue text-white shadow-sm">
            <Icon className="h-5 w-5" />
          </span>
          <span className="font-heading text-2xl font-bold leading-none text-isu-navy/15">{step.n}</span>
        </div>

        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-isu-blue">{step.label}</p>
        <h3 className="mt-1.5 font-heading text-base font-bold leading-snug text-isu-navy">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>

        {step.codeIntro && (
          <p className="mt-3 text-xs font-medium text-slate-500">{step.codeIntro}</p>
        )}
        {step.codeIntro && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CALL_CODES.map((code) => (
              <span
                key={code}
                className="rounded border border-isu-navy/15 bg-isu-navy/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-isu-navy"
              >
                {code}
              </span>
            ))}
          </div>
        )}

        {step.points?.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {step.points.map((p) => (
              <li key={p.text} className="flex gap-2 text-xs leading-relaxed text-slate-600">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotTone(p.tone)}`} />
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        )}

        {step.callout && (
          <div className="mt-3 rounded-md border border-cyan-200 bg-cyan-50/70 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-800">If nothing relevant happened</p>
            <p className="mt-1 font-mono text-xs font-semibold text-cyan-900">{step.callout}</p>
          </div>
        )}

        {step.note && (
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">{step.note}</p>
        )}
      </div>

      {!last && (
        <>
          <div className="flex justify-center py-1.5 md:hidden">
            <ChevronDown className="h-5 w-5 text-isu-blue/50" />
          </div>
          <div className="pointer-events-none absolute -right-[13px] top-1/2 z-10 hidden -translate-y-1/2 xl:flex">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-isu-navy/15 bg-white shadow-sm">
              <ChevronRight className="h-3.5 w-3.5 text-isu-blue" />
            </span>
          </div>
        </>
      )}
    </li>
  );
}

export default function HowLiveRefereeingWorks() {
  return (
    <section className="overflow-hidden rounded-2xl border border-isu-navy/15 bg-white shadow-lg">
      <div className="relative overflow-hidden bg-gradient-to-r from-isu-navy via-isu-navy to-isu-blue px-6 py-6 text-white">
        <div className="pointer-events-none absolute -right-10 -top-20 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-24 h-40 w-40 rounded-full bg-isu-light/25 blur-2xl" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-isu-light">Referee guide</p>
          <h2 className="mt-2 font-heading text-2xl md:text-3xl font-bold leading-tight">How LiveRefereeing works</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/80">
            Judge Short Track race situations independently, submit your own calls and compare them with the official Final Decision.
          </p>
        </div>
      </div>

      <div className="space-y-6 bg-slate-50/70 p-6 lg:p-8">
        <ol className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, i) => (
            <StepCard key={step.n} step={step} last={i === STEPS.length - 1} />
          ))}
        </ol>

        <CallSheetExample />

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-5 lg:col-span-2">
            <div className="flex items-center gap-2 text-cyan-800">
              <Info className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em]">Refereeing principle</p>
            </div>
            <p className="mt-3 text-sm md:text-[15px] italic leading-relaxed text-cyan-950">
              “Only clear and obvious race incidents should lead to sanctions. If a situation is not clear and obvious, the correct decision may also be No Rule Violation or Shared Responsibility.”
            </p>
            <p className="mt-3 text-xs leading-relaxed text-cyan-800/80">
              This reflects the Short Track Guidance, which states that reviewed situations must be clear and obvious before sanctions are given, while unclear situations may result in NRV or Shared Responsibility.
            </p>
          </div>

          <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-5">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em]">Important</p>
            </div>
            <p className="mt-3 text-sm italic leading-relaxed text-amber-950">
              “Your call is your independent decision. Do not try to predict the Final Decision. Judge the race situation as you would as a referee.”
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-isu-navy/15 bg-gradient-to-r from-isu-navy/5 to-isu-blue/5 p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-isu-navy text-white">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-isu-blue">The goal</p>
              <p className="mt-2 text-sm md:text-[15px] italic leading-relaxed text-slate-700">
                “LiveRefereeing helps referees train consistent decision-making, review race situations and compare their interpretation with the official Final Decision.”
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}