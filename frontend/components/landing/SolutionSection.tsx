import React from 'react';
import { Zap, MessageCircle, Wallet, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SolutionSection() {
  const benefits = [
    {
      icon: Zap,
      badge: 'Speed & Simplicity',
      title: 'Upload Products in 2 Minutes',
      description:
        'Add single items in seconds or upload hundreds of products instantly via CSV spreadsheet. Your prices, sizes, and stock synchronize directly with your WhatsApp bot in real-time.',
      highlight: 'Zero technical setup required',
      color: 'emerald',
    },
    {
      icon: MessageCircle,
      badge: 'Natural Experience',
      title: 'Customers Shop Like Texting',
      description:
        'Shoppers browse products, ask for discounts in Nigerian Pidgin ("How much last?"), and add to cart without downloading heavy apps or navigating slow websites. It feels just like chatting with a friend.',
      highlight: 'Works on any smartphone with WhatsApp',
      color: 'sky',
    },
    {
      icon: Wallet,
      badge: 'Maximum Profit',
      title: 'Keep 98% of Sales',
      description:
        'Say goodbye to 30% marketplace cuts. We charge just a tiny 2% fee per transaction. Every payment is authorized securely by Paystack and deposits straight to your registered Nigerian bank account.',
      highlight: 'Direct bank settlement via Paystack',
      color: 'amber',
    },
  ];

  return (
    <section id="solution" className="py-16 md:py-24 bg-slate-50 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-emerald-700 bg-emerald-100/80 border border-emerald-300/60 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
            The Naija Marketplace Advantage
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Built specifically for the way Nigerians buy and sell.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Everything your business needs to turn WhatsApp into an automated, money-making storefront in minutes.
          </p>
        </div>

        {/* 3 Benefit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="group relative bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:border-emerald-500/50 transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col justify-between"
              >
                <div>
                  {/* Icon & Badge */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                      <Icon className="w-7 h-7" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {benefit.badge}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-emerald-700 transition-colors">
                    {benefit.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>

                {/* Footer Highlight */}
                <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md">
                    ✓ {benefit.highlight}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Link below solution */}
        <div className="mt-12 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800 transition"
          >
            <span>See how simple it is to get started</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </section>
  );
}
