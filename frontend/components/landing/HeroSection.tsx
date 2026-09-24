import React from 'react';
import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="relative bg-slate-950 text-white overflow-hidden py-20 md:py-28 lg:py-32 border-b border-slate-800">
      {/* Contrasted Background Image with Gradient Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1556742049-0a67c5574f73?auto=format&fit=crop&w=1920&q=80')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-emerald-950/80" />

      {/* Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">

          {/* Left Column: Spacious, Clean Value Proposition */}
          <div className="lg:col-span-7 text-left space-y-7">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Built for Nigerian Merchants • Keep 98% of your money</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.08]">
              Sell on WhatsApp.{' '}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 mt-2">
                Keep 98% of your sales.
              </span>
            </h1>

            {/* Shortened, Punchy Subtitle with Breathing Space */}
            <p className="text-base sm:text-xl text-slate-300 max-w-xl font-normal leading-relaxed">
              Your automated 24/7 WhatsApp storefront. Take orders, collect instant Paystack payments directly to your bank, and stop losing sales in messy DMs.
            </p>

            {/* Value bullets: Clean spacious 2x2 grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm text-slate-200">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Zero app download for customers</span>
              </div>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Instant Paystack bank settlement</span>
              </div>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Understands &quot;How much last?&quot; and Pidgin</span>
              </div>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Upload entire catalog via CSV</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-8 h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-lg shadow-lg shadow-emerald-500/20 transition-all text-center"
              >
                Start Selling in 2 Minutes
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center px-6 h-12 bg-white/10 hover:bg-white/15 text-white font-semibold text-sm rounded-lg border border-white/20 backdrop-blur-sm transition text-center"
              >
                View Live Demo Dashboard
              </Link>
            </div>

            {/* Trust row */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>Paystack Verified Partner</span>
              <span>•</span>
              <span>No credit card required</span>
              <span>•</span>
              <span>Cancel anytime</span>
            </div>
          </div>

          {/* Right Column: Realistic, Colorful WhatsApp Phone Mockup */}
          <div className="lg:col-span-5">
            <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-white/15 shadow-2xl overflow-hidden backdrop-blur-sm">
              {/* WhatsApp Chat Header */}
              <div className="bg-[#075E54] text-white p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white uppercase tracking-wider">
                    SP
                  </div>
                  <div>
                    <span className="font-bold text-sm block leading-tight">ShopPal Storefront</span>
                    <span className="text-[11px] text-emerald-200">Online • replies instantly</span>
                  </div>
                </div>
                <span className="text-xs bg-emerald-800/80 text-emerald-200 px-2 py-0.5 rounded font-mono">
                  Verified
                </span>
              </div>

              {/* Chat Canvas with WhatsApp Wallpaper Tint */}
              <div className="p-4 space-y-3 text-xs bg-[#EFEAE2]">
                <div className="text-center">
                  <span className="bg-white/80 shadow-xs px-2.5 py-0.5 rounded text-slate-500 text-[10px] font-medium inline-block">
                    Today
                  </span>
                </div>

                {/* Customer Message */}
                <div className="flex justify-end">
                  <div className="bg-[#D9FDD3] text-slate-900 p-2.5 rounded-lg rounded-tr-none max-w-[85%] shadow-xs">
                    <p>How far, you get black Chelsea boots size 43? How much last?</p>
                    <span className="text-[9px] text-slate-500 text-right block mt-1">10:14 AM ✓✓</span>
                  </div>
                </div>

                {/* Bot Response */}
                <div className="flex justify-start">
                  <div className="bg-white text-slate-900 p-2.5 rounded-lg rounded-tl-none max-w-[90%] shadow-xs">
                    <p className="font-semibold text-emerald-900">Yes boss! We get am for stock.</p>
                    <p className="mt-1">
                      <strong>Black Chelsea Leather Boots (Size 43)</strong>
                      <br />
                      Price: <strong className="font-bold text-emerald-700">₦24,000</strong> (Free delivery in Lagos).
                    </p>
                    <p className="mt-1 text-slate-600">You wan make I send Paystack payment link sharp sharp?</p>
                    <span className="text-[9px] text-slate-400 text-right block mt-1">10:14 AM</span>
                  </div>
                </div>

                {/* Customer Message */}
                <div className="flex justify-end">
                  <div className="bg-[#D9FDD3] text-slate-900 p-2 rounded-lg rounded-tr-none max-w-[75%] shadow-xs">
                    <p>Yes send link abeg, I dey pay now.</p>
                    <span className="text-[9px] text-slate-500 text-right block mt-0.5">10:15 AM ✓✓</span>
                  </div>
                </div>

                {/* Paystack Order Card */}
                <div className="flex justify-start">
                  <div className="bg-white text-slate-900 p-3 rounded-lg rounded-tl-none max-w-[95%] shadow-sm border border-emerald-100">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                      <span className="font-bold text-[11px] text-slate-900">Order #ORD-9021</span>
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Paystack Ready
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">1x Chelsea Leather Boots • Size 43</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">Total: ₦24,000</p>
                    <div className="mt-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-center py-2 rounded text-xs transition cursor-pointer shadow-xs">
                      🔒 Pay ₦24,000 via Paystack
                    </div>
                    <span className="text-[9px] text-slate-400 text-right block mt-1">10:15 AM</span>
                  </div>
                </div>

                {/* Verified Payout Alert */}
                <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 p-2.5 rounded-lg text-center text-xs shadow-xs">
                  <p className="font-semibold text-emerald-950">✓ Payment Verified! (₦24,000 received)</p>
                  <p className="text-[10px] text-emerald-800 mt-0.5">Vendor notified. Receipt sent to customer.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
