import React from 'react';

export default function Testimonial() {
  const testimonials = [
    {
      name: 'Mrs. Chidinma Okafor',
      business: 'Fabrics & Lace Merchant',
      location: 'Lagos',
      quote:
        'Before ShopPal, I spent hours every day sending pictures and answering "how much last" to customers. Now the WhatsApp bot handles routine inquiries and generates Paystack links directly.',
      salesGrowth: '+114% order throughput',
    },
    {
      name: 'Ibrahim D.',
      business: 'Leather Goods Retailer',
      location: 'Abuja',
      quote:
        'No more fake payment alert issues. Customers pay directly through the Paystack link on WhatsApp, and the funds enter my bank account immediately. It is reliable and simple.',
      salesGrowth: 'Direct bank payouts',
    },
    {
      name: 'Femi A.',
      business: 'Footwear Merchant',
      location: 'Lagos',
      quote:
        'Marketplaces were taking nearly 30% of my margin. With ShopPal, I keep 98% of my hard-earned sales. My shoppers love ordering on WhatsApp without downloading other apps.',
      salesGrowth: 'Keeps 98% margin',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 text-xs font-semibold uppercase tracking-wider px-3.5 py-1 rounded-full inline-block">
            Merchant Feedback
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Real feedback from Nigerian traders
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            See how merchants are boosting revenue and saving hours with WhatsApp commerce.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 mb-12 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center shadow-xs">
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 block">450+</span>
            <span className="text-xs text-slate-500 font-medium">Active Merchants</span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 block">₦45M+</span>
            <span className="text-xs text-slate-500 font-medium">Transactions Settled</span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 block">98%</span>
            <span className="text-xs text-slate-500 font-medium">Kept by Merchants</span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 block">4.9/5</span>
            <span className="text-xs text-slate-500 font-medium">Merchant Rating</span>
          </div>
        </div>

        {/* Testimonial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl p-6 border border-slate-200 hover:border-slate-300 flex flex-col justify-between transition-shadow hover:shadow-xs"
            >
              <div>
                <p className="text-xs text-slate-700 italic leading-relaxed mb-4">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">{t.name}</p>
                  <p className="text-[11px] text-slate-500">{t.business} • {t.location}</p>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {t.salesGrowth}
                </span>
              </div>
            </div>
          ))}
        </div>


      </div>
    </section>
  );
}
