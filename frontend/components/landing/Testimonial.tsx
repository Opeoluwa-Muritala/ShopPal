'use client';

import React from 'react';

export default function Testimonial() {
  const testimonials = [
    {
      name: 'Mrs. Chidinma Okafor',
      business: 'Fabrics & Lace Merchant',
      location: 'Lagos',
      quote:
        'Before ShopPal, I spent hours every day sending pictures and answering “how much last” to customers. Now the WhatsApp bot handles routine inquiries and generates Paystack links directly.',
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
    <>
      <style jsx>{`
        @keyframes slideLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .testimonial-track {
          animation: slideLeft 18s linear infinite;
        }
        .testimonial-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <section className="border-b border-white/10 bg-[#0d1014] py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-[0.75fr_1.45fr]">
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#10151b] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
              <img
                src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80"
                alt="African merchant smiling while using a mobile phone"
                className="h-[420px] w-full object-cover object-center"
              />
              <div className="border-t border-white/10 bg-[#111a22] px-4 py-3 text-sm text-slate-200">
                <p className="font-medium text-white">Ada & Co. Fashion</p>
                <p className="text-xs text-slate-400">Lagos, Nigeria</p>
              </div>
            </div>

            <div>
              <div className="mb-6">
                <span className="inline-block rounded-full border border-[#2a52be]/40 bg-[#2a52be]/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#dfe9ff]">
                  Merchant feedback
                </span>
                <h2 className="mt-4 text-3xl font-light tracking-[-0.06em] text-white sm:text-5xl">
                  Real wins from real sellers.
                </h2>
              </div>

              <div className="overflow-hidden pb-2">
                <div className="testimonial-track flex w-max gap-4">
                  {[...testimonials, ...testimonials].map((t, idx) => (
                    <article
                      key={`${t.name}-${idx}`}
                      className="w-[300px] rounded-[24px] border border-white/10 bg-white/5 p-5 text-left backdrop-blur-sm"
                    >
                      <p className="text-sm leading-6 text-slate-200">“{t.quote}”</p>
                      <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/10 pt-4">
                        <div>
                          <p className="text-sm font-medium text-white">{t.name}</p>
                          <p className="text-[11px] text-slate-400">{t.business} • {t.location}</p>
                        </div>
                        <span className="rounded-full border border-[#2a52be]/40 bg-[#2a52be]/10 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-[#dfe9ff]">
                          {t.salesGrowth}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
