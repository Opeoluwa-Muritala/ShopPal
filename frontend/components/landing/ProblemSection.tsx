import React from 'react';

export default function ProblemSection() {
  return (
    <section id="problem" className="py-16 md:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <span className="text-rose-800 bg-rose-50 border border-rose-200 text-xs font-semibold uppercase tracking-wider px-3.5 py-1 rounded-full inline-block">
            The Harsh Reality of Nigerian Retail
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Stop giving away your profits or losing orders in messy DMs.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Nigerian merchants work too hard to lose 30% of their earnings to marketplace giants or spend hours manually copying account numbers.
          </p>
        </div>

        {/* 3-Way Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">

          {/* Scenario 1: Big Marketplaces */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/20 p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 bg-rose-100/80 px-2.5 py-1 rounded-md inline-block">
                Big Marketplaces
              </span>

              <h3 className="text-lg font-bold text-slate-900">
                You lose 25%–30% on every single item.
              </h3>

              <ul className="space-y-2 text-xs text-slate-600 pt-2">
                <li>• Heavy commissions cut your margins to pennies.</li>
                <li>• Payouts often delayed for weeks.</li>
                <li>• Customer data is withheld from you.</li>
                <li>• Unfair return penalties eat into inventory.</li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-rose-100 text-xs font-medium text-rose-700">
              Outcome: High sales volume with minimal net profit.
            </div>
          </div>

          {/* Scenario 2: Manual WhatsApp Chats */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-md inline-block">
                Manual WhatsApp Chats
              </span>

              <h3 className="text-lg font-bold text-slate-900">
                Chaotic chats and payment verification delays.
              </h3>

              <ul className="space-y-2 text-xs text-slate-600 pt-2">
                <li>• Replying &quot;How much last?&quot; dozens of times a day.</li>
                <li>• Customer orders get buried under personal group messages.</li>
                <li>• Chasing manual payment screenshots.</li>
                <li>• When you sleep, your business cannot close orders.</li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-amber-100 text-xs font-medium text-amber-800">
              Outcome: Constant manual effort and lost orders.
            </div>
          </div>

          {/* Scenario 3: ShopPal */}
          <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50/40 p-6 flex flex-col justify-between shadow-sm ring-1 ring-emerald-500/20">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-white bg-emerald-600 px-3 py-1 rounded-md inline-block">
                ShopPal Solution
              </span>

              <h3 className="text-lg font-bold text-slate-900">
                Keep 98% of your money. Automated 24/7.
              </h3>

              <ul className="space-y-2 text-xs text-slate-700 pt-2">
                <li>• <strong className="text-emerald-800">Keep 98%:</strong> Only 2% fee when you make a completed sale.</li>
                <li>• <strong className="text-emerald-800">Instant Paystack Settlement:</strong> Verified funds sent directly to your Nigerian bank.</li>
                <li>• <strong className="text-emerald-800">AI Speaks Pidgin &amp; English:</strong> Answers inquiries and closes sales anytime.</li>
                <li>• <strong className="text-emerald-800">Zero app download:</strong> Shoppers buy directly inside WhatsApp.</li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-emerald-200 text-xs font-bold text-emerald-900">
              Outcome: Maximized margins, 24/7 sales, instant settlement.
            </div>
          </div>

        </div>


      </div>
    </section>
  );
}
