'use client';

import React, { useEffect, useRef, useState } from 'react';
import HeroContent from './HeroContent';
import HeroVisual from './HeroVisual';

export default function HeroSection() {
  const [visualVisible, setVisualVisible] = useState(false);
  const visualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Stagger visual entrance slightly after content
    const t = setTimeout(() => setVisualVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      className="relative overflow-hidden text-white"
      style={{
        background: 'linear-gradient(180deg, #111417 0%, #1a1d21 100%)',
        paddingTop: 'clamp(36px, 8vw, 72px)',
        paddingBottom: 'clamp(36px, 8vw, 64px)',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),transparent_45%)]" />
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1.05fr_1.1fr] lg:gap-4">
          <HeroContent />

          <div
            ref={visualRef}
            className="flex justify-center transition-all duration-700 ease-out lg:justify-end"
            style={{
              opacity: visualVisible ? 1 : 0,
              transform: visualVisible ? 'translateY(0)' : 'translateY(24px)',
            }}
          >
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
