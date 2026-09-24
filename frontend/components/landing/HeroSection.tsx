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
        background: 'linear-gradient(135deg, #0d1117 0%, #0f1f3d 50%, #0a1628 100%)',
        paddingTop: 'clamp(64px, 10vw, 100px)',
        paddingBottom: 'clamp(64px, 10vw, 100px)',
      }}
    >
      {/* ── Background decorations ── */}
      {/* Top-right radial glow */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 80% 20%, rgba(34,197,94,0.10) 0%, transparent 60%)',
        }}
      />
      {/* Bottom-left subtle glow */}
      <div
        className="absolute bottom-0 left-0 w-[400px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 20% 80%, rgba(34,197,94,0.06) 0%, transparent 60%)',
        }}
      />
      {/* Fine grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* ── Content container ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        <div
          className="
            grid grid-cols-1 lg:grid-cols-2
            gap-12 lg:gap-16 xl:gap-20
            items-center
          "
        >
          {/* Left: Content */}
          <HeroContent />

          {/* Right: Visual (phone mockup) */}
          <div
            ref={visualRef}
            className="flex justify-center lg:justify-end transition-all duration-700 ease-out"
            style={{
              opacity: visualVisible ? 1 : 0,
              transform: visualVisible ? 'translateY(0)' : 'translateY(32px)',
            }}
          >
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
