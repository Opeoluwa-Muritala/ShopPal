import React from 'react';

export default function ProblemSection() {
  return (
    <section id="problem" className="border-b border-white/10 bg-[#101317] py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <span className="inline-block rounded-full border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#f5c982]">
            Why it matters
          </span>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.06em] text-white sm:text-5xl">
            More sales. Less friction.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">Marketplace drag</p>
            <h3 className="text-xl font-light text-white">Heavy fees. Low margin.</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Too much of your revenue disappears before it ever reaches your account.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">Manual chaos</p>
            <h3 className="text-xl font-light text-white">Replies pile up.</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Every order, question, and payment update gets buried in long DMs.
            </p>
          </div>

          <div className="rounded-2xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-6 text-left">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#f5c982]">ShopPal</p>
            <h3 className="text-xl font-light text-white">Clean storefront. 24/7 sales.</h3>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              A simpler way to sell—without the platform tax or the chat chaos.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
