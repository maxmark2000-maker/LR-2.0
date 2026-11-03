import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import IsuLogo from '@/components/IsuLogo';

const NAV = [
  { label: 'Home', to: '/' },
  { label: 'ORGACube', to: '/orgacube' },
  { label: 'LiveRefereeing', to: '/live' },
  { label: 'TCCube', to: '/tccube' },
];

export default function SiteLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 shadow-lg shadow-isu-navy/10">
        {/* Upper band — ISU gradient */}
        <div className="bg-isu-gradient text-white">
          <div className="w-full px-6 lg:px-12 h-16 flex items-center justify-between gap-6">
            <Link to="/" className="flex items-center gap-3 min-w-0">
              <IsuLogo className="h-6 sm:h-7 w-auto text-white" />
              <span className="hidden sm:block h-6 w-px bg-white/30" aria-hidden="true" />
              <span className="hidden sm:inline font-extrabold uppercase tracking-[0.18em] text-xs lg:text-sm text-white whitespace-nowrap">
                LIVE REFEREEING
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                    pathname === item.to
                      ? 'border-white text-white'
                      : 'border-transparent text-white/80 hover:text-white hover:border-white/40'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Toggle menu">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Lower band — deep ISU navy */}
        <div className="text-white/85" style={{ background: 'linear-gradient(90deg, #000046 0%, #1437c8 100%)' }}>
          <div className="w-full px-6 lg:px-12 h-10 flex items-center gap-4 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em]">
            <span className="truncate">ISU Short Track Speed Skating</span>
          </div>
        </div>

        {open && (
          <nav className="md:hidden bg-isu-deep border-t border-white/10 px-6 py-2">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`block py-3 text-sm border-b border-white/10 last:border-b-0 ${
                  pathname === item.to ? 'text-white font-semibold' : 'text-blue-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="text-white/90 text-sm">
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="block w-full h-10 md:h-14" aria-hidden="true">
          <defs>
            <linearGradient id="isuFooterGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#192266" />
              <stop offset="0.6" stopColor="#0e3be1" />
              <stop offset="0.8" stopColor="#00b3ff" />
              <stop offset="1" stopColor="#00d7ff" />
            </linearGradient>
          </defs>
          <path d="M0 22 Q 560 66 1440 0 L1440 60 L0 60 Z" fill="url(#isuFooterGrad)" />
        </svg>
        <div className="bg-isu-gradient">
          <div className="w-full px-6 lg:px-12 pb-8 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <p>Short Track Refereeing Platform — independent tool for officials.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}