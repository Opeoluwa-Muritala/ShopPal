import React from 'react';
import { Star, Quote, CheckCircle2 } from 'lucide-react';

export default function Testimonial() {
  const testimonials = [
    {
      name: 'Mrs. Chidinma Okafor',
      business: 'Chidi Fabrics & Lace',
      location: 'Balogun Market, Lagos Island',
      rating: 5,
      quote:
        'Before Naija Marketplace, I lost 4 hours every day sending picture after picture and replying "how much last" to customers while my shop was crowded. Now the WhatsApp bot handles all inquiries and collects the money via Paystack. My sales doubled in just 3 weeks!',
      salesGrowth: '+114% revenue growth',
      avatarInitial: 'CO',
    },
    {
      name: 'Ibrahim Danjuma',
      business: 'Kano Premium Leather Hub',
      location: 'Wuse Market, Abuja',
      rating: 5,
      quote:
        'No more fake alert wahala or endless arguments over bank transfer screenshots. Customers pay directly through the Paystack link on WhatsApp, and the funds enter my GTBank account immediately. It is the best selling tool for any Nigerian trader.',
      salesGrowth: '₦2.8M sold on WhatsApp',
      avatarInitial: 'ID',
    },
    {
      name: 'Femi Adebayo',
      business: 'Lagos Sneaker Haven',
      location: 'Surulere, Lagos',
      rating: 5,
      quote:
        'Jumia was eating nearly 30% of my margin. On a ₦30,000 sneaker, they took almost ₦9,000! With Naija Marketplace, I keep 98% of my hard-earned money. My shoppers love ordering on WhatsApp without downloading another slow app.',
      salesGrowth: 'Keeps 98% of all margins',
      avatarInitial: 'FA',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-slate-50 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
          <span className="text-emerald-700 bg-emerald-100/80 border border-emerald-300/60 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
            Loved by Nigerian Merchants
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Real stories from vendors across Lagos, Abuja &amp; Port Harcourt
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            See how everyday traders are boosting revenue and saving hours with automated WhatsApp selling.
          </p>
        </div>

        {/* Social Proof Stats Bar */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-12 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 block">450+</span>
            <span className="text-xs text-slate-500 font-medium">Active Vendors</span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 block">₦45M+</span>
            <span className="text-xs text-slate-500 font-medium">Transactions Settled</span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 block">98%</span>
            <span className="text-xs text-slate-500 font-medium">Kept by Merchants</span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 block">4.9/5</span>
            <span className="text-xs text-slate-500 font-medium">Merchant Rating</span>
          </div>
        </div>

        {/* Testimonial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* 5-Star Rating & Quote Icon */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <Quote className="w-6 h-6 text-emerald-200" />
                </div>

                {/* Quote text */}
                <p className="text-sm text-slate-700 italic leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              {/* Vendor Profile */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center">
                    {t.avatarInitial}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{t.name}</h3>
                    <p className="text-xs text-slate-500">{t.business}</p>
                    <span className="text-[11px] text-emerald-700 block">{t.location}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
