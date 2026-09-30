import React from 'react';
import Link from 'next/link';

export default function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'List products',
      description: 'Add your catalog in a few taps or upload a CSV.',
    },
    {
      number: '02',
      title: 'Sell on WhatsApp',
      description: 'Customers message, browse, and buy without leaving chat.',
    },
    {
      number: '03',
      title: 'Get paid',
      description: 'Orders confirm and payouts land directly in your account.',
    },
  ];

  return (
    <section id="how-it-works" className="border-b border-white/10 bg-[#0d0f12] py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-300">
            Simple flow
          </span>
          <h2 className="mt-4 text-3xl font-light tracking-[-0.06em] text-white sm:text-5xl">
            Three steps. Zero clutter.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-3xl font-light tracking-[-0.06em] text-[#f59e0b]">{step.number}</span>
                <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
              </div>
              <h3 className="text-xl font-light text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
