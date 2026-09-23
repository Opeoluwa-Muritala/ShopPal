import React from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Zap, Heart } from 'lucide-react';

export default function CTAFooter() {
  return (
    <section className="relative overflow-hidden bg-slate-900 text-white py-16 md:py-24">
      {/* Decorative gradient glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Call to Action Container */}
        <div className="max-w-4xl mx-auto text-center space-y-8">

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-semibold">
            <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
            <span>Join 450+ Nigerian merchants already selling smarter</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Ready to stop losing 30% to marketplaces?
          </h2>

          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Set up your automated WhatsApp storefront in 2 minutes. Start closing sales 24/7 and keep 98% of every single naira you earn.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 h-14 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-base rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 transform hover:-translate-y-0.5"
            >
              <span>Start Selling in 2 Minutes</span>
              <ArrowRight className="w-5 h-5 text-slate-950" />
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 h-14 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-base rounded-xl border border-slate-700 transition-colors"
            >
              <span>See Live Dashboard Demo</span>
            </Link>
          </div>

          {/* Trust Guarantees */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Instant Paystack Settlement</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>2-Minute Setup</span>
            </div>
            <span>•</span>
            <span>Zero Monthly Subscriptions</span>
          </div>

        </div>

      </div>
    </section>
  );
}
