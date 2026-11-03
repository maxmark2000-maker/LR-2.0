import { jsPDF } from 'jspdf';
import { parseFinalDecision } from '@/lib/refereeScore';

const MARKS = ['MARK1', 'MARK2', 'MARK3', 'MARK4', 'MARK5'];
const PAGE_W = 297; // landscape A4
const PAGE_H = 210; // landscape A4
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_H = 5;
const BREAK_Y = PAGE_H - MARGIN;

function ensureSpace(doc, state, needed = LINE_H) {
  if (state.y + needed > BREAK_Y) {
    doc.addPage();
    state.y = 18;
  }
}

export function sectionTitle(doc, state, title) {
  ensureSpace(doc, state, 12);
  state.y += 4;
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.text(title, MARGIN, state.y);
  state.y += 6;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
}

// Draws a table with header row and rows of cell-line-arrays. Auto page-breaks.
export function drawTable(doc, state, columns, rows) {
  const colCount = columns.length;
  const colW = columns.map((c) => c.width);
  const colX = columns.map((_, i) =>
    MARGIN + colW.slice(0, i).reduce((s, w) => s + w, 0)
  );

  const rightEdge = MARGIN + colW.reduce((s, w) => s + w, 0);

  const headerRow = (resetY) => {
    doc.setFillColor(19, 41, 75); // isu-navy
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    let hy = resetY;
    // Fill every header cell first: drawing white text also switches the PDF fill
    // colour to white, so filling cell by cell left all but the first cell blank.
    doc.rect(MARGIN, hy, rightEdge - MARGIN, 7, 'F');
    columns.forEach((c, i) => {
      doc.text(String(c.label), colX[i] + 2, hy + 5);
    });
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    // closed grid around the header cells
    doc.setDrawColor(220, 220, 220);
    doc.line(MARGIN, hy, rightEdge, hy);
    doc.line(MARGIN, hy + 7, rightEdge, hy + 7);
    colX.forEach((x) => doc.line(x, hy, x, hy + 7));
    doc.line(rightEdge, hy, rightEdge, hy + 7);
    return hy + 7;
  };

  // Header
  state.y = headerRow(state.y);

  rows.forEach((row) => {
    // compute line count per cell
    const lineCounts = row.map((cell) => (cell && cell.length ? cell.length : 1));
    const rowH = Math.max(...lineCounts) * LINE_H + 2;

    if (state.y + rowH > BREAK_Y) {
      doc.addPage();
      state.y = 18;
      state.y = headerRow(state.y);
    }

    doc.setDrawColor(220, 220, 220);
    row.forEach((cell, i) => {
      doc.line(colX[i], state.y, colX[i] + colW[i], state.y);
      const lines = cell && cell.length ? cell : ['—'];
      lines.forEach((ln, li) => {
        doc.text(String(ln), colX[i] + 2, state.y + 5 + li * LINE_H);
      });
    });
    colX.forEach((x) => doc.line(x, state.y, x, state.y + rowH));
    doc.line(rightEdge, state.y, rightEdge, state.y + rowH);
    state.y += rowH;
  });

  // bottom border
  doc.line(MARGIN, state.y, MARGIN + colW.reduce((s, w) => s + w, 0), state.y);
  state.y += 4;
  doc.setTextColor(0, 0, 0);
}

export function exportRacePdf({ competition, round, race, athletes, calls }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const state = { y: 18 };

  // Header
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(competition?.name || 'Competition', MARGIN, state.y);
  state.y += 7;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text([competition?.location, competition?.startDate].filter(Boolean).join(' · '), MARGIN, state.y);
  state.y += 8;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`${round?.genderGroup} — ${round?.type} — Race ${race?.raceNumber}`, MARGIN, state.y);
  state.y += 6;
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Generated ' + new Date().toLocaleString(), MARGIN, state.y);
  state.y += 4;

  // Athletes table
  sectionTitle(doc, state, 'Athletes');
  const athleteRows = athletes.map((a) => [
    [a.helmetNumber || ''],
    [a.country || ''],
    [`${a.firstName} ${a.lastName}`],
  ]);
  drawTable(
    doc,
    state,
    [
      { label: 'Helm #', width: 20 },
      { label: 'Country', width: 22 },
      { label: 'Name', width: CONTENT_W - 42 },
    ],
    athleteRows
  );

  // Referees × marks table
  sectionTitle(doc, state, 'Referees × marks');
  const byReferee = {};
  calls.forEach((c) => {
    const key = c.refereeName || c.refereeId;
    (byReferee[key] = byReferee[key] || []).push(c);
  });

  const markColW = 34;
  const refColW = 40;
  const otherColW = CONTENT_W - refColW - markColW * MARKS.length;
  const refMarkCols = [
    { label: 'Referee', width: refColW },
    ...MARKS.map((m, i) => ({ label: `Mark ${i + 1}`, width: markColW })),
    { label: 'Other', width: otherColW },
  ];

  const formatCall = (c) => {
    const athlete = athletes.find((a) => a.id === c.athleteId);
    const parts = [];
    if (c.helmetNumber) parts.push(c.helmetNumber);
    if (athlete?.country) parts.push(athlete.country);
    parts.push(c.callCode);
    return parts.join('  ');
  };

  const refMarkRows = Object.entries(byReferee).map(([name, list]) => {
    const cells = MARKS.map((m) =>
      list.filter((c) => (c.mark || '') === m).map(formatCall)
    );
    const other = list
      .filter((c) => !MARKS.includes((c.mark || '')))
      .map(formatCall);
    return [[name], ...cells, other];
  });

  if (refMarkRows.length === 0) {
    doc.setFontSize(9);
    doc.text('No calls submitted.', MARGIN, state.y + 4);
    state.y += 10;
  } else {
    drawTable(doc, state, refMarkCols, refMarkRows);
  }

  doc.save(`race-report-${round?.genderGroup}-${round?.type}-${race?.raceNumber}.pdf`.replace(/\s+/g, '-'));
}

export function exportFlaggedPdf({ competition, flaggedRaces, rounds, calls, athletes }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const state = { y: 18 };

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(`${competition?.name || 'Competition'} — Flagged Races Report`, MARGIN, state.y);
  state.y += 7;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text([competition?.location, competition?.startDate].filter(Boolean).join(' · '), MARGIN, state.y);
  state.y += 6;
  doc.setFontSize(8);
  doc.text(`Flagged races: ${flaggedRaces.length} · Generated ${new Date().toLocaleString()}`, MARGIN, state.y);
  state.y += 6;

  if (flaggedRaces.length === 0) {
    doc.setFontSize(11);
    doc.text('No flagged races for this competition.', MARGIN, state.y + 4);
    doc.save(`flagged-report-${competition?.name || 'competition'}.pdf`.replace(/\s+/g, '-'));
    return;
  }

  const roundLabel = (rid) => {
    const r = rounds.find((x) => x.id === rid);
    return r ? `${r.genderGroup} — ${r.type}${r.distance ? ` — ${r.distance}` : ''}` : '—';
  };

  const sorted = [...flaggedRaces].sort((a, b) => (a.raceNumber || 0) - (b.raceNumber || 0));

  sorted.forEach((race) => {
    sectionTitle(doc, state, `Race ${race.raceNumber} — ${roundLabel(race.roundId)}`);
    const raceCalls = calls.filter((c) => c.raceId === race.id);
    const raceAthletes = (race.athleteIds || [])
      .map((id) => athletes.find((a) => a.id === id))
      .filter(Boolean);

    const athleteRows = raceAthletes.map((a) => [
      [a.helmetNumber || ''],
      [a.country || ''],
      [`${a.firstName} ${a.lastName}`],
    ]);
    drawTable(
      doc,
      state,
      [
        { label: 'Helm #', width: 20 },
        { label: 'Country', width: 22 },
        { label: 'Name', width: CONTENT_W - 42 },
      ],
      athleteRows.length ? athleteRows : [[['—'], ['—'], ['No athletes assigned']]]
    );

    // calls summary
    const counts = {};
    raceCalls.forEach((c) => { counts[c.callCode] = (counts[c.callCode] || 0) + 1; });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const summaryRows = entries.length
      ? entries.map(([code, count]) => [[code], [String(count)]])
      : [[['No calls'], ['0']]];
    drawTable(
      doc,
      state,
      [
        { label: 'Call code', width: 60 },
        { label: 'Count', width: 30 },
      ],
      summaryRows
    );
  });

  doc.save(`flagged-report-${competition?.name || 'competition'}.pdf`.replace(/\s+/g, '-'));
}

// Lists the Final Call components that differ between two stored decision versions.
function decisionChanges(original, next, athleteById) {
  const a = parseFinalDecision(original);
  const b = parseFinalDecision(next);
  const keys = new Set([...Object.keys(a.marks || {}), ...Object.keys(b.marks || {})]);
  const changes = [];
  keys.forEach((key) => {
    const from = a.marks[key] || '';
    const to = b.marks[key] || '';
    if (from === to) return;
    const [athleteId, mark] = key.split('|');
    const athlete = athleteById[athleteId];
    changes.push({
      mark,
      athlete: athlete
        ? `${athlete.helmetNumber ? `${athlete.helmetNumber} ` : ''}${athlete.firstName} ${athlete.lastName}`
        : athleteId,
      from: from || '—',
      to: to || '—',
    });
  });
  return changes.sort((x, y) => MARKS.indexOf(x.mark) - MARKS.indexOf(y.mark) || x.athlete.localeCompare(y.athlete));
}

export function exportDebriefPdf({ competition, revisions, rounds, athletes }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const state = { y: 18 };

  const debriefs = (revisions || []).filter((r) => r.reason === 'DEBRIEF');

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(`${competition?.name || 'Competition'} — Debrief Changes Report`, MARGIN, state.y);
  state.y += 7;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text([competition?.location, competition?.startDate].filter(Boolean).join(' · '), MARGIN, state.y);
  state.y += 6;
  doc.setFontSize(8);
  const changedRaces = new Set(debriefs.map((r) => r.raceId)).size;
  doc.text(
    `Races changed in the debrief: ${changedRaces} · Changes: ${debriefs.length} · Generated ${new Date().toLocaleString()}`,
    MARGIN,
    state.y
  );
  state.y += 6;

  if (debriefs.length === 0) {
    doc.setFontSize(11);
    doc.text('No Final Call changes were recorded in a debrief for this competition.', MARGIN, state.y + 4);
    doc.save(`debrief-changes-${competition?.name || 'competition'}.pdf`.replace(/\s+/g, '-'));
    return;
  }

  const athleteById = {};
  (athletes || []).forEach((a) => { athleteById[a.id] = a; });

  const byRace = {};
  debriefs.forEach((rev) => { (byRace[rev.raceId] = byRace[rev.raceId] || []).push(rev); });

  Object.values(byRace)
    .sort((a, b) => (a[0].raceNumber || 0) - (b[0].raceNumber || 0))
    .forEach((revs) => {
      const rd = (rounds || []).find((x) => x.id === revs[0].roundId);
      const roundLabel = rd
        ? `${rd.genderGroup} — ${rd.type}${rd.distance ? ` — ${rd.distance}` : ''}`
        : revs[0].genderGroup || '—';
      sectionTitle(doc, state, `Race ${revs[0].raceNumber} — ${roundLabel}`);

      const rows = [];
      [...revs]
        .sort((a, b) => new Date(a.revisedAt || 0) - new Date(b.revisedAt || 0))
        .forEach((rev) => {
          const changes = decisionChanges(rev.originalDecision, rev.newDecision, athleteById);
          changes.forEach((c, i) => {
            rows.push([
              [i === 0 && rev.revisedAt ? new Date(rev.revisedAt).toLocaleString() : ''],
              [c.mark.replace('MARK', 'Mark ')],
              [c.athlete],
              [c.from],
              [c.to],
            ]);
          });
        });

      drawTable(
        doc,
        state,
        [
          { label: 'Changed at', width: 45 },
          { label: 'Mark', width: 25 },
          { label: 'Athlete', width: 90 },
          { label: 'Final decision before', width: 50 },
          { label: 'Final decision after', width: CONTENT_W - 210 },
        ],
        rows.length ? rows : [[['—'], ['—'], ['No component change recorded'], ['—'], ['—']]]
      );
    });

  doc.save(`debrief-changes-${competition?.name || 'competition'}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.pdf`.replace(/\s+/g, '-'));
}