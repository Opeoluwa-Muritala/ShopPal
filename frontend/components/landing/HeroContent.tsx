'use client';

import React, { useEffect, useRef, useState } from 'react';
import CTAButtons from './CTAButtons';

export default function HeroContent() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Trigger fade-in shortly after mount
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      ref={ref}
      className="flex flex-col gap-8 max-w-[600px] mx-auto lg:mx-0 transition-all duration-700 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
      }}
    >
      {/* Pill badge */}
      <div className="inline-flex w-fit items-center gap-2 px-3.5 py-1.5 rounded-full bg-green-500/10 border border-green-500/25 text-green-400 text-xs font-semibold tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Built for Nigerian Vendors
      </div>

      {/* Headline */}
      <div className="flex flex-col gap-4">
        <h1
          className="text-[clamp(36px,6vw,64px)] font-extrabold text-white leading-[1.1] tracking-tight"
        >
          Sell on WhatsApp
        </h1>

        {/* Subheading */}
        <p className="text-[clamp(16px,2vw,20px)] text-[#d1d5db] leading-[1.55] font-normal max-w-[480px]">
          Keep 98% of your sales.{' '}
          <span className="text-white font-medium">No app. No chaos.</span>
        </p>
      </div>

      {/* CTA Buttons */}
      <CTAButtons />

      {/* Trust micro-copy */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-slate-400 transition-all duration-700 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transitionDelay: '200ms',
        }}
      >
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Paystack Verified Partner
        </span>
        <span className="text-slate-600">·</span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          No credit card required
        </span>
        <span className="text-slate-600">·</span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Cancel anytime
        </span>
      </div>
    </div>
  );
}
