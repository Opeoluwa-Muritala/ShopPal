'use client';

import React, { useState } from 'react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How do I sign up?',
      a: 'Signing up takes under 2 minutes. Enter your business name, email, and password, then add your products or upload via CSV. Your WhatsApp storefront activates immediately.',
    },
    {
      q: 'How much do you charge?',
      a: 'We charge only a 2% transaction fee on successful sales. You keep 98% of your money. There are zero upfront setup fees, zero monthly subscription fees, and no hidden charges.',
    },
    {
      q: 'Do customers need to download an app?',
      a: 'No. Customers shop directly inside WhatsApp. They message your number, browse products, view details and prices, and receive direct Paystack checkout links right in the chat.',
    },
    {
      q: 'How do I get paid?',
      a: 'All transactions are processed securely through Paystack. The funds settle automatically into your registered Nigerian bank account with instant verification.',
    },
    {
      q: 'Does the bot understand Nigerian Pidgin and local phrases?',
      a: 'Yes. Powered by AI, the bot understands everyday Nigerian phrases like “How much last?”, “You get size 42?”, “I wan buy”, and replies naturally in friendly English or Pidgin.',
    },
    {
      q: 'What if I need help?',
      a: 'Our support team is always available via WhatsApp chat and email to assist you with onboarding and store configuration.',
    },
  ];

  const toggleAccordion = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="border-b border-white/10 bg-[#0d1014] py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="rounded-[28px] border border-white/10 bg-[#10171d] p-6 sm:p-8">
            <span className="inline-block rounded-full border border-[#2a52be]/40 bg-[#2a52be]/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#dfe9ff]">
              FAQ
            </span>
            <h2 className="mt-4 text-3xl font-light tracking-[-0.06em] text-white sm:text-5xl">
              Frequently asked questions.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Everything you need to know before launching your WhatsApp storefront.
            </p>

            <div className="mt-8 rounded-[22px] border border-[#2a52be]/30 bg-[#2a52be]/10 p-4 text-sm text-slate-200">
              <p className="font-medium text-white">Need a quick answer?</p>
              <p className="mt-2 text-slate-300">Our support team is available whenever your store needs help.</p>
              <a
                href="https://wa.me/14155238886?text=Hello%20ShopPal%20Support%2C%20I%20have%20a%20question"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#111417] transition hover:bg-slate-200"
              >
                Chat with support
              </a>
            </div>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div key={idx} className="overflow-hidden rounded-[22px] border border-white/10 bg-white/5">
                  <button
                    type="button"
                    onClick={() => toggleAccordion(idx)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-medium text-white sm:text-base">{faq.q}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-300">
                      {isOpen ? 'Close' : 'Open'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/10 bg-[#0f161d] px-5 py-4 text-sm leading-6 text-slate-300">
                      <p>{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
