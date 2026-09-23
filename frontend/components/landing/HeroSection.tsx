import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, MessageCircle } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/60 via-white to-slate-50 py-16 md:py-24 border-b border-slate-100">
      {/* Decorative background glow circles */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-emerald-200/20 via-green-100/30 to-transparent blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-7 text-left space-y-6">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-300/60 text-emerald-800 text-xs sm:text-sm font-semibold shadow-sm">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Built for Nigerian Traders &amp; Brands</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-700 font-medium">Keep 98% of your money</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Sell on WhatsApp.{' '}
              <span className="text-emerald-600 underline decoration-emerald-300 decoration-wavy decoration-2">
                Keep 98%
              </span>{' '}
              of your sales.
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
              Why pay marketplaces like Jumia <strong>25–30% in commission fees</strong> or drown in chaotic WhatsApp group chats?
              Naija Marketplace gives you an automated 24/7 AI storefront that speaks fluent Nigerian Pidgin &amp; English, takes orders, and verifies Paystack bank transfers instantly.
            </p>

            {/* Value bullets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero app download for customers</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Instant Paystack bank settlement</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Understands &quot;How much last?&quot; &amp; Pidgin</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Upload entire catalog via CSV</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-8 h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-xl shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/35 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 text-center"
              >
                <span>Start Selling in 2 Minutes</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-6 h-14 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-base rounded-xl border border-slate-200 shadow-sm transition-colors text-center"
              >
                <span>View Live Demo Dashboard</span>
              </Link>
            </div>

            {/* Trust Footer line */}
            <div className="pt-2 flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Paystack Verified Partner</span>
              </div>
              <span>•</span>
              <span>No credit card required</span>
              <span>•</span>
              <span>Cancel anytime</span>
            </div>

          </div>

          {/* Right Column: Interactive WhatsApp & Dashboard Preview Mockup */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto w-full max-w-sm sm:max-w-md bg-slate-900 rounded-[2.5rem] p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-900/10">

              {/* Phone Speaker Notch */}
              <div className="w-32 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
              </div>

              {/* WhatsApp Interface Mockup Screen */}
              <div className="bg-[#efeae2] rounded-[2rem] overflow-hidden text-slate-800 shadow-inner">

                {/* WhatsApp Chat Header */}
                <div className="bg-[#075e54] text-white p-3.5 flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-white shadow">
                      🛍️
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm">ShopPal Storefront</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 fill-emerald-400" />
                      </div>
                      <span className="text-[11px] text-emerald-100 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Online (replies instantly)
                      </span>
                    </div>
                  </div>
                  <MessageCircle className="w-5 h-5 text-emerald-100" />
                </div>

                {/* Chat Messages Stream */}
                <div className="p-3 space-y-3 text-xs">

                  {/* Date badge */}
                  <div className="text-center">
                    <span className="bg-white/80 backdrop-blur-sm text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-md shadow-xs">
                      Today
                    </span>
                  </div>

                  {/* Customer Message 1 */}
                  <div className="flex justify-end">
                    <div className="bg-[#dcf8c6] text-slate-800 p-2.5 rounded-2xl rounded-tr-none max-w-[85%] shadow-xs">
                      <p>How far, you get black Chelsea boots size 43? How much last?</p>
                      <span className="text-[9px] text-slate-500 text-right block mt-1">10:14 AM ✓✓</span>
                    </div>
                  </div>

                  {/* Bot Reply 1 */}
                  <div className="flex justify-start">
                    <div className="bg-white text-slate-800 p-2.5 rounded-2xl rounded-tl-none max-w-[90%] shadow-xs border border-slate-100">
                      <p className="font-medium">Yes boss! We get am for stock. 👞</p>
                      <p className="mt-1">
                        <strong>Black Chelsea Leather Boots (Size 43)</strong>
                        <br />
                        Price: <strong className="text-emerald-700 font-bold">₦24,000</strong> (Free delivery in Lagos).
                      </p>
                      <p className="mt-1 text-slate-600">You wan make I send Paystack payment link sharp sharp?</p>
                      <span className="text-[9px] text-slate-400 text-right block mt-1">10:14 AM</span>
                    </div>
                  </div>

                  {/* Customer Message 2 */}
                  <div className="flex justify-end">
                    <div className="bg-[#dcf8c6] text-slate-800 p-2 rounded-2xl rounded-tr-none max-w-[75%] shadow-xs">
                      <p>Yes send link abeg, I dey pay now.</p>
                      <span className="text-[9px] text-slate-500 text-right block mt-0.5">10:15 AM ✓✓</span>
                    </div>
                  </div>

                  {/* Bot Order Card with Paystack Link */}
                  <div className="flex justify-start">
                    <div className="bg-white text-slate-800 p-3 rounded-2xl rounded-tl-none max-w-[95%] shadow-xs border-l-4 border-emerald-500">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                        <span className="font-bold text-[11px] text-slate-900">Order #ORD-9021</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          Paystack Ready
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">1x Chelsea Leather Boots • Size 43</p>
                      <p className="text-sm font-bold text-slate-900 mt-1">Total: ₦24,000</p>
                      <div className="mt-2.5 bg-emerald-600 text-white font-semibold text-center py-2 rounded-lg text-xs shadow-sm flex items-center justify-center gap-1.5">
                        <span>🔒 Pay ₦24,000 via Paystack</span>
                      </div>
                      <span className="text-[9px] text-slate-400 text-right block mt-1">10:15 AM</span>
                    </div>
                  </div>

                  {/* Payment Confirmed Alert */}
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-2 rounded-xl text-center shadow-xs">
                    <p className="font-bold text-[11px] flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Payment Verified! (₦24,000 received)
                    </p>
                    <p className="text-[10px] text-emerald-700 mt-0.5">Vendor notified. Receipt sent to customer.</p>
                  </div>

                </div>

                {/* WhatsApp Chat Input placeholder */}
                <div className="bg-[#f0f0f0] p-2 flex items-center gap-2 border-t border-slate-200">
                  <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-slate-400 text-[11px]">
                    Type a message...
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#128c7e] text-white flex items-center justify-center text-xs">
                    🎙️
                  </div>
                </div>

              </div>
            </div>

            {/* Floating Trust Badge */}
            <div className="hidden sm:flex absolute -bottom-6 -left-6 bg-white p-3.5 rounded-2xl shadow-xl border border-slate-100 items-center gap-3 max-w-[260px]">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg shrink-0">
                💰
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">₦1.48M+ Earned</span>
                <span className="text-[11px] text-slate-500">By 450+ Nigerian merchants this month</span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
