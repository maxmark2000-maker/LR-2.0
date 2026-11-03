import React from 'react';
import { HERO_IMAGES } from '@/lib/isu';

export default function Hero({ eyebrow, title, subtitle, image = HERO_IMAGES.main, compact = false, children }) {
  return (
    <section className="relative overflow-hidden">
      <img src={image} alt="Short track ice arena" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-isu-navy/95 via-isu-navy/80 to-isu-navy/50" />
      <div className={`relative w-full px-6 lg:px-12 ${compact ? 'py-14 md:py-16' : 'py-24 md:py-32'}`}>
        {eyebrow && (
          <p className="text-isu-light text-xs md:text-sm font-semibold tracking-[0.22em] uppercase mb-4">{eyebrow}</p>
        )}
        <h1 className={`font-heading font-bold text-white tracking-tight ${compact ? 'text-3xl md:text-4xl' : 'text-4xl md:text-6xl'}`}>
          {title}
        </h1>
        {subtitle && <p className="mt-5 max-w-2xl text-blue-50/90 text-base md:text-lg leading-relaxed">{subtitle}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}