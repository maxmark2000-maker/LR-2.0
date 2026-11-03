import { jsPDF } from 'jspdf';
import { drawTable, sectionTitle } from '@/lib/racePdf';

const MARGIN = 14;

// The printable participant list of a competition: who took part, and in how
// many races they submitted a call (a "no call" verdict counts as a call too).
const COLUMNS = {
  name: { label: 'Name', width: 120, cell: (row) => [row.name] },
  country: { label: 'Country', width: 60, cell: (row) => [row.country || '—'] },
  races: { label: 'Races with call', width: 45, cell: (row) => [String(row.races)] },
};

export const PDF_COLUMN_KEYS = Object.keys(COLUMNS);

const byName = (a, b) => a.name.localeCompare(b.name);

const SORTS = {
  name: byName,
  country: (a, b) => (a.country || '\uffff').localeCompare(b.country || '\uffff') || byName(a, b),
  calls: (a, b) => (b.races || 0) - (a.races || 0) || byName(a, b),
};

export function exportRefereeParticipationPdf({ competition, rows = [], columns = PDF_COLUMN_KEYS, sort = 'name' }) {
  const keys = columns.filter((key) => COLUMNS[key]);
  if (!keys.length) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const state = { y: 18 };

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(`${competition?.name || 'Competition'} — Referee participation`, MARGIN, state.y);
  state.y += 7;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text([competition?.location, competition?.startDate].filter(Boolean).join(' · '), MARGIN, state.y);
  state.y += 6;
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleString()}`, MARGIN, state.y);
  state.y += 4;

  sectionTitle(doc, state, 'Races with a call per referee');
  drawTable(
    doc,
    state,
    keys.map((key) => ({ label: COLUMNS[key].label, width: COLUMNS[key].width })),
    [...rows].sort(SORTS[sort] || byName).map((row) => keys.map((key) => COLUMNS[key].cell(row)))
  );

  doc.save(`referee-participation-${competition?.name || 'competition'}.pdf`.replace(/\s+/g, '-'));
}