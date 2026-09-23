import React from 'react';
import { AlertCircle, XCircle, CheckCircle2, TrendingDown, Clock, ShieldCheck, Zap } from 'lucide-react';

export default function ProblemSection() {
  return (
    <section id="problem" className="py-16 md:py-24 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
            The Harsh Reality of Nigerian Retail
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Stop giving away your profits or losing orders in messy DMs.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Nigerian merchants work too hard to lose 30% of their earnings to marketplace giants or spend 6 hours daily sending bank account numbers manually.
          </p>
        </div>

        {/* 3-Way Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">

          {/* Scenario 1: Big Marketplaces (Jumia / Konga) */}
          <div className="rounded-2xl border border-red-200/80 bg-red-50/20 p-6 flex flex-col justify-between relative shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-red-600 bg-red-100 px-2.5 py-1 rounded-md">
                  Big Marketplaces
                </span>
                <TrendingDown className="w-6 h-6 text-red-500" />
              </div>

              <h3 className="text-xl font-bold text-slate-900">
                You lose 25%–30% on every single item.
              </h3>

              <ul className="space-y-2.5 text-sm text-slate-600 pt-2">
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>Crushing commissions cut your margins to pennies.</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>You wait 2 to 4 weeks before your payout arrives.</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>Customer belongs to them; you can&apos;t retarget them.</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>Unfair return penalties eat into your stock.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-red-200/60 text-center">
              <span className="text-xs font-semibold text-red-700">Outcome: High sales, zero actual profit</span>
            </div>
          </div>

          {/* Scenario 2: Manual WhatsApp Groups / Instagram DMs */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/20 p-6 flex flex-col justify-between relative shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">
                  Manual WhatsApp Chats
                </span>
                <Clock className="w-6 h-6 text-amber-500" />
              </div>

              <h3 className="text-xl font-bold text-slate-900">
                Chaotic chats &amp; fake alert wahala.
              </h3>

              <ul className="space-y-2.5 text-sm text-slate-600 pt-2">
                <li className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>Replying &ldquo;How much last?&rdquo; 80 times a day burns your energy.</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>Customer orders get buried under flooded group messages.</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>Chasing fake bank transfer screenshots and disputes.</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>When you sleep, your business completely shuts down.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-amber-200/60 text-center">
              <span className="text-xs font-semibold text-amber-800">Outcome: Stress, lost orders, sleepless nights</span>
            </div>
          </div>

          {/* Scenario 3: Naija Marketplace (Highlighted Solution) */}
          <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 p-6 flex flex-col justify-between relative shadow-lg transform md:-translate-y-2">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wider py-1 px-3.5 rounded-full shadow-md flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Recommended Choice</span>
            </div>

            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md">
                  Naija Marketplace
                </span>
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              </div>

              <h3 className="text-xl font-bold text-slate-900">
                Keep 98% of your money. Automated 24/7.
              </h3>

              <ul className="space-y-2.5 text-sm text-slate-700 pt-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Keep 98%:</strong> Only tiny 2% transaction fee when you make a sale.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Instant Paystack Settlement:</strong> Money hits your Nigerian bank account directly.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>AI speaks Pidgin &amp; English:</strong> Answers inquiries &amp; closes sales while you sleep.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Zero app download:</strong> Shoppers buy inside familiar WhatsApp chat.</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-emerald-200 text-center">
              <span className="text-xs font-bold text-emerald-800">Outcome: Maximum profit, zero headache, 24/7 revenue</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
