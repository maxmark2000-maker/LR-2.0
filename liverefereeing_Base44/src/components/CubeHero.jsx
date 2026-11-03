import React from 'react';
import { motion } from 'framer-motion';
import { HERO_IMAGES } from '@/lib/isu';

// Dramatic full-width hero shared by the ORGACube, LiveRefereeing and TCCube views.
export default function CubeHero({ eyebrow, title, subtitle, image = HERO_IMAGES.main }) {
  return (
    <section className="relative overflow-hidden bg-isu-navy">
      <motion.img
        src={image}
        alt="Short track ice arena"
        initial={{ scale: 1.12, opacity: 0.35 }}
        animate={{ scale: 1, opacity: 0.65 }}
        transition={{ duration: 2.2, ease: 'easeOut' }}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Tonal overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-isu-navy via-isu-navy/85 to-isu-navy/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-isu-navy/95 via-transparent to-isu-navy/40" />
      {/* Ice glows */}
      <div className="absolute -top-32 -right-24 w-[36rem] h-[36rem] rounded-full bg-isu-light/20 blur-3xl" />
      <div className="absolute -bottom-44 left-1/4 w-[30rem] h-[30rem] rounded-full bg-isu-blue/30 blur-3xl" />
      {/* Speed lines */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: 'repeating-linear-gradient(115deg, #ffffff 0 1px, transparent 1px 24px)' }}
      />
      {/* Bottom accent bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-isu-light via-isu-blue to-transparent" />

      <div className="relative w-full px-6 lg:px-12 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="max-w-3xl"
        >
          {eyebrow && (
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-isu-light opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-isu-light" />
              </span>
              <p className="text-isu-light text-xs md:text-sm font-semibold tracking-[0.32em] uppercase">{eyebrow}</p>
              <span className="h-px flex-1 bg-gradient-to-r from-isu-light/70 to-transparent" />
            </div>
          )}
          <h1 className="mt-5 font-heading font-extrabold uppercase text-white tracking-tight text-4xl md:text-6xl leading-[1.05]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 max-w-2xl text-blue-50/90 text-base md:text-lg leading-relaxed">{subtitle}</p>
          )}
        </motion.div>
      </div>
    </section>
  );
}