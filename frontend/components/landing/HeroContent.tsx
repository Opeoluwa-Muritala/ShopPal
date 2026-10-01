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
      className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left transition-all duration-700 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
      }}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-200 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
        Built for modern retailers
      </div>

      <div className="max-w-[820px]">
        <h1 className="text-[clamp(3.4rem,8vw,8rem)] font-light leading-[0.8] tracking-[-0.08em] text-white">
          ShopPal
        </h1>
        <div className="mt-4 flex items-center justify-center gap-3 lg:justify-start">
          <span className="inline-flex items-center rounded-full border border-[#2a52be]/40 bg-[#2a52be]/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#dfe9ff]">
            WhatsApp commerce
          </span>
        </div>
      </div>

      <p className="max-w-lg text-sm text-slate-300 sm:text-base">
        Turn conversations into sales with a clean storefront, instant Paystack checkout, and less admin work.
      </p>

      <CTAButtons />

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-slate-400 lg:justify-start">
        <span className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-[#f59e0b]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          Paystack ready
        </span>
        <span className="text-slate-600">•</span>
        <span>2-minute setup</span>
        <span className="text-slate-600">•</span>
        <span>98% payout</span>
      </div>
    </div>
  );
}
