import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

const EXAMPLE_VIDEO_URL =
  'https://media.base44.com/videos/public/6a7e05447779e40dc9f5f36a/128be7820_Bildschirmaufnahme2026-10-14um223832.mov';

export default function ExampleVideo() {
  return (
    <section className="overflow-hidden rounded-2xl border border-isu-navy/15 bg-white shadow-lg">
      <div className="relative overflow-hidden bg-gradient-to-r from-isu-navy via-isu-navy to-isu-blue px-6 py-6 text-white">
        <div className="pointer-events-none absolute -right-10 -top-20 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-24 h-40 w-40 rounded-full bg-isu-light/25 blur-2xl" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-isu-light">Walkthrough</p>
          <h2 className="mt-2 font-heading text-2xl md:text-3xl font-bold leading-tight">LiveRefereeing in practice</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/80">
            A short screen recording showing how a referee opens a race, enters calls and submits them.
          </p>
        </div>
      </div>

      <div className="bg-slate-50/70 p-6 lg:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50/80 px-4 py-3">
          <Badge className="bg-amber-500 text-white text-[10px] tracking-wider">EXAMPLE</Badge>
          <span className="flex items-center gap-1.5 text-sm text-amber-900">
            <Info className="h-4 w-4 shrink-0" />
            Example recording for demonstration only — not an official ISU video.
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-isu-navy/15 bg-black shadow-sm">
          <video
            src={EXAMPLE_VIDEO_URL}
            controls
            playsInline
            preload="metadata"
            className="block h-full w-full aspect-video"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </section>
  );
}