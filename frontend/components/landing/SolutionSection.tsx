import React from 'react';
import Link from 'next/link';

export default function SolutionSection() {
  const benefits = [
    {
      badge: 'Setup',
      title: 'Ready in minutes',
      description: 'Upload products, add your store, and launch your WhatsApp sales flow.',
    },
    {
      badge: 'Sales',
      title: 'Chat-based checkout',
      description: 'Customers browse, ask questions, and pay without leaving WhatsApp.',
    },
    {
      badge: 'Profit',
      title: 'Keep more of each sale',
      description: 'Simple 2% transaction fee and direct bank settlement through Paystack.',
    },
  ];

  return (
    <section id="solution" className="border-b border-white/10 bg-[#0c0f12] py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-300">
            Minimal workflow
          </span>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.06em] text-white sm:text-5xl">
            Built for everyday selling.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-200 hover:border-[#f59e0b]/40 hover:bg-white/[0.07]"
            >
              <span className="inline-block rounded-full border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#f5c982]">
                {benefit.badge}
              </span>
              <h3 className="mt-4 text-xl font-light text-white">{benefit.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
