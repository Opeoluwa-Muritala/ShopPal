import React from 'react';
import Link from 'next/link';

export default function SolutionSection() {
  const benefits = [
    {
      badge: 'Speed & Simplicity',
      title: 'Upload Products in 2 Minutes',
      description:
        'Add single items in seconds or upload products via CSV spreadsheet. Prices, descriptions, and stock synchronize directly with your WhatsApp bot in real time.',
      highlight: 'Zero technical setup required',
    },
    {
      badge: 'Natural Experience',
      title: 'Customers Shop Like Texting',
      description:
        'Shoppers browse products, ask questions in Nigerian Pidgin or English, and add items to cart without downloading apps or navigating slow websites.',
      highlight: 'Works on any smartphone with WhatsApp',
    },
    {
      badge: 'Maximum Profit',
      title: 'Keep 98% of Sales',
      description:
        'Say goodbye to 30% marketplace cuts. We charge just 2% per completed transaction. Every payment is authorized securely by Paystack and deposited straight to your Nigerian bank.',
      highlight: 'Direct bank settlement via Paystack',
    },
  ];

  return (
    <section id="solution" className="py-16 md:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 text-xs font-semibold uppercase tracking-wider px-3.5 py-1 rounded-full inline-block">
            The ShopPal Advantage
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Built for how Nigerian commerce works.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Everything your business needs to turn WhatsApp into an automated storefront.
          </p>
        </div>

        {/* 3 Benefit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => {
            const badgeColors = [
              'bg-blue-50 text-blue-700 border-blue-200',
              'bg-purple-50 text-purple-700 border-purple-200',
              'bg-emerald-50 text-emerald-800 border-emerald-200',
            ][index % 3];

            return (
              <div
                key={index}
                className="bg-white rounded-xl p-6 border border-slate-200 hover:border-slate-300 flex flex-col justify-between transition-shadow hover:shadow-xs"
              >
                <div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border inline-block mb-3 ${badgeColors}`}>
                    {benefit.badge}
                  </span>

                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {benefit.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-emerald-700 font-semibold">
                  ✓ {benefit.highlight}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Link */}
        <div className="mt-12 text-center">
          <Link
            href="/signup"
            className="text-sm font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            Create your store today →
          </Link>
        </div>


      </div>
    </section>
  );
}
