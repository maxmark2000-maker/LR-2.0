import React from 'react';

const IOC_TO_ISO = {
  GER: 'de', USA: 'us', CAN: 'ca', KOR: 'kr', CHN: 'cn', JPN: 'jp', NED: 'nl',
  GBR: 'gb', FRA: 'fr', ITA: 'it', HUN: 'hu', POL: 'pl', RUS: 'ru', BLR: 'by',
  UKR: 'ua', KAZ: 'kz', AUS: 'au', NZL: 'nz', ESP: 'es', SUI: 'ch', SWE: 'se',
  NOR: 'no', FIN: 'fi', AUT: 'at', CZE: 'cz', SVK: 'sk', SLO: 'si', CRO: 'hr',
  BUL: 'bg', ROU: 'ro', TUR: 'tr', ISL: 'is', BEL: 'be', DEN: 'dk', LUX: 'lu',
  ISR: 'il', RSA: 'za', ARG: 'ar', BRA: 'br', MEX: 'mx', CHI: 'cl', TPE: 'tw',
  HKG: 'hk', THA: 'th', MAS: 'my', INA: 'id', PHI: 'ph', SGP: 'sg', MGL: 'mn',
  LAT: 'lv', EST: 'ee', LTU: 'lt', GRE: 'gr', POR: 'pt', IRL: 'ie', ALB: 'al',
  GEO: 'ge', ARM: 'am', AZE: 'az', UZB: 'uz', IND: 'in', QAT: 'qa', UAE: 'ae',
  KUW: 'kw', KSA: 'sa', SRB: 'rs', BIH: 'ba', MNE: 'me', MKD: 'mk', AND: 'ad',
  LIE: 'li', SMR: 'sm', MLT: 'mt', CYP: 'cy', TUN: 'tn', EGY: 'eg', MAR: 'ma',
  ALG: 'dz', NGA: 'ng', KEN: 'ke', JAM: 'jm', TRI: 'tt', COL: 'co', ECU: 'ec',
  PER: 'pe', URU: 'uy', PAR: 'py', VEN: 've', DOM: 'do', PUR: 'pr',
};

// Full English country names (as produced by AI-assisted athlete imports) → ISO codes
const NAME_TO_ISO = {
  GERMANY: 'de', NETHERLANDS: 'nl', SWITZERLAND: 'ch', 'SLOVAK REPUBLIC': 'sk',
  UKRAINE: 'ua', NORWAY: 'no', CZECHIA: 'cz', 'CZECH REPUBLIC': 'cz', FRANCE: 'fr',
  POLAND: 'pl', ROMANIA: 'ro', ITALY: 'it', CROATIA: 'hr', HUNGARY: 'hu',
  'GREAT BRITAIN': 'gb', 'UNITED STATES': 'us', 'UNITED STATES OF AMERICA': 'us',
  CANADA: 'ca', 'SOUTH KOREA': 'kr', 'REPUBLIC OF KOREA': 'kr', CHINA: 'cn',
  JAPAN: 'jp', 'GREAT BRITAIN AND NORTHERN IRELAND': 'gb', AUSTRIA: 'at',
  SWEDEN: 'se', FINLAND: 'fi', BELGIUM: 'be', DENMARK: 'dk', SPAIN: 'es',
  BULGARIA: 'bg', TURKIYE: 'tr', TURKEY: 'tr', ICELAND: 'is', LUXEMBOURG: 'lu',
  ISRAEL: 'is', 'SOUTH AFRICA': 'za', ARGENTINA: 'ar', BRAZIL: 'br', MEXICO: 'mx',
  CHILE: 'cl', 'CHINESE TAIPEI': 'tw', 'HONG KONG': 'hk', 'HONG KONG, CHINA': 'hk',
  THAILAND: 'th', MALAYSIA: 'my', INDONESIA: 'id', PHILIPPINES: 'ph',
  SINGAPORE: 'sg', MONGOLIA: 'mn', LATVIA: 'lv', ESTONIA: 'ee', LITHUANIA: 'lt',
  GREECE: 'gr', PORTUGAL: 'pt', IRELAND: 'ie', ALBANIA: 'al', GEORGIA: 'ge',
  ARMENIA: 'am', AZERBAIJAN: 'az', UZBEKISTAN: 'uz', INDIA: 'in', QATAR: 'qa',
  'UNITED ARAB EMIRATES': 'ae', KUWAIT: 'kw', 'SAUDI ARABIA': 'sa', SERBIA: 'rs',
  'BOSNIA AND HERZEGOVINA': 'ba', MONTENEGRO: 'me', 'NORTH MACEDONIA': 'mk',
  ANDORRA: 'ad', LIECHTENSTEIN: 'li', 'SAN MARINO': 'sm', MALTA: 'mt', CYPRUS: 'cy',
  TUNISIA: 'tn', EGYPT: 'eg', MOROCCO: 'ma', ALGERIA: 'dz', NIGERIA: 'ng',
  KENYA: 'ke', JAMAICA: 'jm', 'TRINIDAD AND TOBAGO': 'tt', COLOMBIA: 'co',
  ECUADOR: 'ec', PERU: 'pe', URUGUAY: 'uy', PARAGUAY: 'py', VENEZUELA: 've',
  'DOMINICAN REPUBLIC': 'do', 'PUERTO RICO': 'pr', RUSSIA: 'ru', BELARUS: 'by',
  KAZAKHSTAN: 'kz', AUSTRALIA: 'au', 'NEW ZEALAND': 'nz', SLOVENIA: 'si',
};

// Reverse map ISO → IOC abbreviation, used to shorten full country names.
const ISO_TO_IOC = Object.fromEntries(Object.entries(IOC_TO_ISO).map(([ioc, iso]) => [iso, ioc]));

export function flagIso2(country) {
  if (!country) return null;
  const key = country.toUpperCase().trim();
  return IOC_TO_ISO[key] || NAME_TO_ISO[key] || null;
}

// Finds a country mentioned inside free text (e.g. "Heerenveen, Netherlands").
export function flagIsoFromText(text) {
  if (!text) return null;
  const direct = flagIso2(text);
  if (direct) return direct;
  const parts = text.toUpperCase().replace(/[^A-Z ,]/g, ' ').split(/[,\s]+/).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    for (let j = Math.min(parts.length, i + 4); j > i; j--) {
      const candidate = parts.slice(i, j).join(' ');
      const iso = NAME_TO_ISO[candidate] || IOC_TO_ISO[candidate];
      if (iso) return iso;
    }
  }
  return null;
}

// Returns the short IOC code (e.g. "ITALY" → "ITA"); falls back to the input.
export function countryAbbr(country) {
  if (!country) return '';
  const key = country.toUpperCase().trim();
  if (IOC_TO_ISO[key]) return key;
  const iso = NAME_TO_ISO[key];
  return (iso && ISO_TO_IOC[iso]) || country;
}

export default function CountryFlag({ country, className, width = 20, height = 14 }) {
  const iso = flagIso2(country);
  if (!iso) return null;
  return (
    <img
      src={`https://flagcdn.com/h20/${iso}.png`}
      srcSet={`https://flagcdn.com/h40/${iso}.png 2x`}
      alt={country}
      title={country}
      loading="lazy"
      className={`inline-block object-cover rounded-sm align-middle ${className || ''}`}
      style={{ width, height }}
    />
  );
}