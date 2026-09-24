import React from 'react';
import Link from 'next/link';

export default function CTAFooter() {
  return (
    <section className="relative bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 text-white py-20 md:py-28 overflow-hidden border-t border-emerald-900/30">
      {/* Decorative Blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-6">

          <span className="inline-block px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
            Join 450+ Nigerian merchants selling on WhatsApp
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Ready to stop losing 30% to marketplaces?
          </h2>

          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Set up your automated WhatsApp storefront in 2 minutes. Start closing sales 24/7 and keep 98% of your revenue.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-lg shadow-lg shadow-emerald-500/20 transition-all"
            >
              Start Selling in 2 Minutes
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 h-12 bg-white/10 hover:bg-white/15 text-white font-semibold text-sm rounded-lg border border-white/20 backdrop-blur-sm transition"
            >
              See Dashboard
            </Link>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>Instant Paystack Settlement</span>
            <span>•</span>
            <span>2-Minute Setup</span>
            <span>•</span>
            <span>Zero Monthly Subscriptions</span>
          </div>

        </div>
      </div>
    </section>

  );
}
