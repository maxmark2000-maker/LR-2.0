import React from 'react';
import CountryFlag, { countryAbbr } from '@/components/tc/CountryFlag';

// markCountries is stored on the race as a JSON string:
// { "MARK1": ["NETHERLANDS", "ITALY"], "MARK2": [...] }
export const parseMarkCountries = (raw) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

// Light background tints per country (full names and IOC codes) so the
// countries involved in a mark are color-coded across the app.
const COUNTRY_TINTS = {
  NETHERLANDS: '#fde4cc', NED: '#fde4cc',
  SWITZERLAND: '#fbdcdc', SUI: '#fbdcdc',
  'SLOVAK REPUBLIC': '#dce6fb', SVK: '#dce6fb',
  UKRAINE: '#dcedfb', UKR: '#dcedfb',
  NORWAY: '#fbdcdc', NOR: '#fbdcdc',
  CZECHIA: '#dce6fb', 'CZECH REPUBLIC': '#dce6fb', CZE: '#dce6fb',
  FRANCE: '#dce6fb', FRA: '#dce6fb',
  POLAND: '#fbdcdc', POL: '#fbdcdc',
  ROMANIA: '#dcedfb', ROU: '#dcedfb',
  ITALY: '#d9eafc', ITA: '#d9eafc',
  CROATIA: '#fbdcdc', CRO: '#fbdcdc',
  HUNGARY: '#fbdcdc', HUN: '#fbdcdc',
  'GREAT BRITAIN': '#d9dcf0', GBR: '#d9dcf0',
  GERMANY: '#f3ddd9', GER: '#f3ddd9',
  LATVIA: '#f3d4d4', LAT: '#f3d4d4',
  SLOVENIA: '#dce6fb', SLO: '#dce6fb',
  AUSTRIA: '#f3ddd9', AUT: '#f3ddd9',
  CANADA: '#fbdcdc', CAN: '#fbdcdc',
  KOREA: '#dce6fb', KOR: '#dce6fb',
  CHINA: '#fbdcdc', CHN: '#fbdcdc',
  JAPAN: '#fbdcdc', JPN: '#fbdcdc',
  'UNITED STATES': '#dce6fb', USA: '#dce6fb',
};

export const countryTint = (country) =>
  (country && COUNTRY_TINTS[String(country).toUpperCase().trim()]) || '#e8edf3';

// Renders the two-country focus of a single mark (e.g. "NED vs ITA" with flags).
// Returns null when no focus is set for the mark.
export function MarkCountryFocus({ markCountries, mark, className, dark = false }) {
  const pair = markCountries?.[mark];
  if (!Array.isArray(pair)) return null;
  const [a, b] = pair;
  if (!a && !b) return null;
  const chip = (c) => (
    <span className={`inline-flex items-center gap-0.5 ${dark ? 'text-isu-light' : 'text-foreground'}`}>
      <CountryFlag country={c} />{countryAbbr(c)}
    </span>
  );
  return (
    <span className={`inline-flex flex-row items-center gap-1 text-[11px] font-medium leading-none ${className || ''}`}>
      {a && chip(a)}
      {a && b && <span className={`text-[9px] ${dark ? 'text-white/50' : 'text-muted-foreground'}`}>vs</span>}
      {b && chip(b)}
    </span>
  );
}