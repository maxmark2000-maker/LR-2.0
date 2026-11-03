import React from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, MapPin } from 'lucide-react';
import { flagIsoFromText } from '@/components/tc/CountryFlag';

const fmt = (value) => {
  if (!value) return '';
  try {
    return format(parseISO(value), 'd MMM yyyy');
  } catch {
    return value;
  }
};

const dateRange = (start, end) => {
  const from = fmt(start);
  const to = fmt(end);
  if (from && to && start !== end) return `${from} – ${to}`;
  return from || to;
};

export default function CompetitionBanner({ competition }) {
  if (!competition) return null;
  const iso = flagIsoFromText(competition.location);
  const dates = dateRange(competition.startDate, competition.endDate);

  return (
    <div className="relative overflow-hidden rounded-xl border border-isu-navy/30 bg-gradient-to-r from-isu-navy via-isu-navy to-isu-blue text-white shadow-lg">
      <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 right-32 h-48 w-48 rounded-full bg-isu-light/25 blur-2xl" />
      <div className="relative flex items-center gap-5 px-6 py-5">
        {iso && (
          <img
            src={`https://flagcdn.com/h80/${iso}.png`}
            alt={competition.location}
            title={competition.location}
            className="h-14 w-auto shrink-0 rounded shadow-md ring-1 ring-white/40"
          />
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-isu-light">Competition</p>
          <h2 className="font-heading text-2xl font-bold leading-tight truncate">{competition.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/85">
            {dates && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-isu-light" /> {dates}
              </span>
            )}
            {competition.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-isu-light" /> {competition.location}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}