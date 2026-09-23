import React from 'react';
import { UserCheck, MessageSquare, LayoutDashboard, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Vendor Signs Up & Uploads Catalog',
      subtitle: 'Takes less than 2 minutes',
      description:
        'Create your free merchant profile, add your store details, and upload your inventory using our simple web form or bulk CSV template. Your WhatsApp bot activates instantly.',
      icon: UserCheck,
      badgeText: 'Step 1: Setup',
    },
    {
      number: '02',
      title: 'Shoppers Discover & Buy on WhatsApp',
      subtitle: 'Natural Pidgin & English conversations',
      description:
        'Customers text your WhatsApp bot to ask questions, view product photos, check availability, and receive secure Paystack checkout links right inside the chat.',
      icon: MessageSquare,
      badgeText: 'Step 2: Automated Sales',
    },
    {
      number: '03',
      title: 'Manage Orders & Receive Payouts',
      subtitle: 'Instant Paystack bank settlements',
      description:
        'Orders appear in real-time on your clean merchant dashboard. Dispatch items via your preferred courier, while funds land directly in your Nigerian bank account.',
      icon: LayoutDashboard,
      badgeText: 'Step 3: Fulfillment',
    },
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
            Effortless Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How it works in 3 simple steps
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            From setup to your first automated WhatsApp sale in under 10 minutes.
          </p>
        </div>

        {/* 3 Step Timeline Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">

          {/* Desktop Connecting Line */}
          <div className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-300 -translate-y-8 -z-0" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="relative bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between z-10"
              >
                <div>
                  {/* Step Number & Icon Header */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-3xl font-black text-emerald-600/30">
                      {step.number}
                    </span>
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200">
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Badge */}
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                    {step.badgeText}
                  </span>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-slate-900 mt-3 mb-1">
                    {step.title}
                  </h3>
                  <p className="text-xs font-semibold text-emerald-600 mb-3">
                    {step.subtitle}
                  </p>

                  {/* Description */}
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <span>Fast, frictionless, automated</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Action */}
        <div className="mt-14 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 px-8 h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-xl shadow-md transition-colors"
          >
            <span>Set Up Your Store Now</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

      </div>
    </section>
  );
}
