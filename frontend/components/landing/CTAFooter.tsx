import React from 'react';
import Link from 'next/link';

export default function CTAFooter() {
  return (
    <section className="relative overflow-hidden border-t border-white/10 bg-[#0b0d10] py-20 md:py-24">
      <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f59e0b]/10 blur-3xl" />

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <span className="inline-block rounded-full border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#f5c982]">
          Launch your storefront
        </span>
        <h2 className="mt-6 text-3xl font-light tracking-[-0.06em] text-white sm:text-5xl">
          Sell better. Keep more.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
          Set up your WhatsApp storefront in minutes and turn conversations into revenue.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#f59e0b] px-7 text-sm font-medium text-[#111417] transition hover:bg-[#f8b64d]"
          >
            Get Started For Free
          </Link>
          {/* <Link
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 text-sm font-medium text-white transition hover:bg-white/10"
          >
            View dashboard
          </Link> */}
        </div>
      </div>
    </section>
  );
}
