import React from 'react';

// The navy→blue header band used on top of every TCCube panel, matching the
// Call sheet / Final decision headers in the Live cube. `compact` renders the
// smaller in-panel variant used for sub-sections.
export default function TcPanelHeader({ eyebrow, title, subtitle, chips = [], actions, tone = 'blue', compact = false }) {
  const band = tone === 'red'
    ? 'from-red-900 via-red-800 to-red-600'
    : 'from-isu-navy via-isu-navy to-isu-blue';

  const visibleChips = chips.filter(Boolean);

  if (compact) {
    return (
      <div className={`relative overflow-hidden bg-gradient-to-r ${band} px-5 py-3 text-white`}>
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div>
            {eyebrow && (
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-isu-light">{eyebrow}</p>
            )}
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <h4 className="font-heading text-base font-bold leading-none">{title}</h4>
              {visibleChips.map((chip) => (
                <span key={chip} className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">{chip}</span>
              ))}
            </div>
            {subtitle && <p className="mt-1 max-w-3xl text-[11px] text-white/75">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 text-xs">{actions}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-gradient-to-r ${band} px-6 py-5 text-white`}>
      <div className="pointer-events-none absolute -right-10 -top-20 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 left-24 h-40 w-40 rounded-full bg-isu-light/25 blur-2xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-isu-light">{eyebrow}</p>
          )}
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <h3 className="font-heading text-2xl font-bold leading-none">{title}</h3>
            {visibleChips.map((chip) => (
              <span key={chip} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{chip}</span>
            ))}
          </div>
          {subtitle && <p className="mt-2 max-w-3xl text-xs text-white/80">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 text-xs">{actions}</div>}
      </div>
    </div>
  );
}