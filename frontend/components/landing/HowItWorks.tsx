import React from 'react';
import Link from 'next/link';

export default function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Sign Up & Upload Catalog',
      subtitle: 'Takes less than 2 minutes',
      description:
        'Create your merchant profile, set your business details, and upload products using our clean form or CSV import. Your WhatsApp storefront activates immediately.',
      badgeText: 'Step 1: Setup',
    },
    {
      number: '02',
      title: 'Shoppers Buy on WhatsApp',
      subtitle: 'Natural Pidgin & English conversations',
      description:
        'Customers message your WhatsApp bot to view items, check availability, and receive secure Paystack checkout links right inside the chat.',
      badgeText: 'Step 2: Automated Sales',
    },
    {
      number: '03',
      title: 'Manage Orders & Receive Payouts',
      subtitle: 'Instant Paystack bank settlements',
      description:
        'Orders appear in real-time on your dashboard. Dispatch items via your preferred courier while verified funds land directly in your Nigerian bank account.',
      badgeText: 'Step 3: Fulfillment',
    },
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 text-xs font-semibold uppercase tracking-wider px-3.5 py-1 rounded-full inline-block">
            Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            How it works in 3 simple steps
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            From setup to automated WhatsApp sales in minutes.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-6 border border-slate-200 hover:border-emerald-300 flex flex-col justify-between transition-all hover:shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl font-black text-emerald-600">
                    {step.number}
                  </span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    {step.badgeText}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 mt-2 mb-1">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  {step.subtitle}
                </p>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {step.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-emerald-700 font-semibold">
                ✓ Fast and frictionless
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-8 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow-sm transition"
          >
            Get Started Free
          </Link>
        </div>


      </div>
    </section>
  );
}
