import React from 'react';
import Link from 'next/link';

export default function CTAButtons() {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
      {/* Primary CTA */}
      <Link
        href="/signup"
        className="
          group relative inline-flex items-center justify-center
          px-7 py-[15px] min-h-[52px]
          bg-green-500 hover:bg-green-600
          text-white font-bold text-[15px] tracking-tight
          rounded-lg
          shadow-[0_4px_24px_rgba(34,197,94,0.35)]
          hover:shadow-[0_6px_32px_rgba(34,197,94,0.5)]
          transition-all duration-200 ease-out
          hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]
          w-full sm:w-auto
          overflow-hidden
        "
      >
        {/* Shimmer */}
        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <span className="relative">Start Selling in 2 Minutes</span>
        <svg
          className="relative ml-2 w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>

      {/* Secondary CTA */}
      <Link
        href="/dashboard"
        className="
          group inline-flex items-center justify-center
          px-7 py-[14px] min-h-[52px]
          bg-transparent
          text-green-400 font-semibold text-[15px]
          border-2 border-green-500/50 hover:border-green-500
          hover:bg-green-500 hover:text-white
          rounded-lg
          transition-all duration-200 ease-out
          hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]
          w-full sm:w-auto
        "
      >
        View Live Demo
        <svg
          className="ml-2 w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
        </svg>
      </Link>
    </div>
  );
}
