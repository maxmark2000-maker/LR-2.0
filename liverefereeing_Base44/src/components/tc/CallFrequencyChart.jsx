import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { flagIso2 } from '@/components/tc/CountryFlag';
import { athleteLabel, callToneColor } from '@/lib/isu';

const MARKS = ['MARK1', 'MARK2', 'MARK3', 'MARK4', 'MARK5'];
const BAR_SIZE = 14;
// Distance between the bars of one row; must match the chart's barGap.
const BAR_GAP = 4;
// Height of a single athlete label, pinned to its bar's centre.
const LABEL_ROW_HEIGHT = 18;
// Width of the athlete label column sitting beside the plot.
const LABEL_WIDTH = 168;
// The value axis sits below the rows and needs its own space: without it the rows
// are squeezed and the bars collapse into thin lines.
const AXIS_HEIGHT = 24;

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-md border border-border bg-popover p-2 shadow-md text-xs">
      <div className="font-semibold mb-1">{row?.name}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="font-mono">{p.dataKey}</span>
          <span className="ml-auto font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// Writes the call code and its count at the end of its bar.
function BarValueLabel({ code, x, y, width, height, value }) {
  if (!value) return null;
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      fill={callToneColor(code)}
      fontSize={10}
      fontWeight={700}
      dominantBaseline="central"
    >
      {`${code} ${value}`}
    </text>
  );
}

// A row can hold one bar per call code, and those bars sit side by side inside the
// row band — so the row's centre is not the centre of any single bar. These are the
// bar centres inside one band, using the very same arithmetic as the chart's own
// bar layout (an explicit barSize, barGap between the bars, group centred in band).
function barCenters(bandSize, count) {
  const sum = count * BAR_SIZE + (count - 1) * BAR_GAP;
  const offset = Math.floor((bandSize - sum) / 2);
  return Array.from({ length: count }, (_, i) => offset + BAR_SIZE / 2 + i * (BAR_SIZE + BAR_GAP));
}

// Athlete labels (flag + name + call code) in their own column beside the plot.
// Each label is pinned to the centre of the bar it belongs to, so a label never
// floats above or below its own bar. Codes without calls in that row stay empty.
function LabelColumn({ data, codes, rowHeight, axisHeight }) {
  const centers = barCenters(rowHeight, codes.length);
  return (
    <div className="shrink-0" style={{ width: LABEL_WIDTH }}>
      {data.map((row, i) => {
        const iso = flagIso2(row.country);
        return (
          <div
            key={row.key}
            className={`relative ${i % 2 === 1 ? 'bg-secondary/50' : ''}`}
            style={{ height: rowHeight }}
          >
            {codes.map((code, j) =>
              row[code] > 0 ? (
                <div
                  key={code}
                  className="absolute inset-x-0 flex items-center gap-2 pr-2"
                  style={{ top: centers[j] - LABEL_ROW_HEIGHT / 2, height: LABEL_ROW_HEIGHT }}
                >
                  {iso ? (
                    <img
                      src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
                      alt={row.country || ''}
                      className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover"
                    />
                  ) : (
                    <span className="h-3.5 w-5 shrink-0" />
                  )}
                  <span className="truncate text-[11px] font-semibold text-foreground">{row.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">{code}</span>
                </div>
              ) : null
            )}
          </div>
        );
      })}
      <div style={{ height: axisHeight }} />
    </div>
  );
}

export default function CallFrequencyChart({ athletes, calls }) {
  const marksWithData = useMemo(
    () => MARKS.filter((m) => calls.some((c) => (c.mark || '') === m)),
    [calls]
  );

  const [mark, setMark] = useState(MARKS[0]);

  const { data, codes } = useMemo(() => {
    const inRace = athletes.filter((a) =>
      calls.some((c) => c.athleteId === a.id && (c.mark || '') === mark)
    );
    const codeSet = new Set();
    inRace.forEach((a) => {
      calls
        .filter((c) => c.athleteId === a.id && (c.mark || '') === mark)
        .forEach((c) => codeSet.add(c.callCode));
    });
    const codes = Array.from(codeSet).sort();
    const data = inRace.map((a) => {
      const row = {
        key: a.id,
        name: athleteLabel(a),
        helmet: a.helmetNumber,
        country: a.country,
      };
      codes.forEach((c) => { row[c] = 0; });
      calls
        .filter((call) => call.athleteId === a.id && (call.mark || '') === mark)
        .forEach((call) => { row[call.callCode] = (row[call.callCode] || 0) + 1; });
      return row;
    });
    return { data, codes };
  }, [athletes, calls, mark]);

  if (!marksWithData.length) {
    return null;
  }

  const empty = data.length === 0;
  const rowHeight = Math.max(codes.length * 20, 36);
  const chartHeight = data.length * rowHeight + AXIS_HEIGHT;

  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Call frequency per athlete</p>
          <p className="text-[11px] text-amber-700">Note: Each MARK corresponds to a yellow box (Yellow Box) in the livestream.</p>
        </div>
        <Select value={mark} onValueChange={setMark}>
          <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MARKS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {empty ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No calls recorded for {mark}.</p>
      ) : (
        <div className="flex" style={{ height: chartHeight }}>
          <LabelColumn data={data} codes={codes} rowHeight={rowHeight} axisHeight={AXIS_HEIGHT} />
          <div className="relative min-w-0 flex-1">
            {/* Alternating row bands: every bar stays visibly tied to its own athlete row. */}
            <div className="pointer-events-none absolute inset-x-0 top-0">
              {data.map((row, i) => (
                <div key={row.key} className={i % 2 === 1 ? 'bg-secondary/50' : ''} style={{ height: rowHeight }} />
              ))}
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data}
                margin={{ top: 0, right: 96, left: 0, bottom: 0 }}
                barCategoryGap={0}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(214 25% 88%)" />
                <XAxis
                  type="number"
                  domain={[0, 'dataMax']}
                  allowDecimals={false}
                  height={AXIS_HEIGHT}
                  tick={{ fontSize: 11 }}
                  axisLine={{ stroke: 'hsl(214 25% 88%)' }}
                  tickLine={false}
                />
                {/* Category axis only: the labels are rendered by LabelColumn beside the plot. */}
                <YAxis type="category" dataKey="key" width={0} tick={false} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(210 40% 96%)' }} />
                {codes.map((c) => (
                  <Bar key={c} dataKey={c} barSize={BAR_SIZE} fill={callToneColor(c)} radius={[0, 3, 3, 0]}>
                    <LabelList dataKey={c} content={<BarValueLabel code={c} />} />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}