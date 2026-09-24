'use client';

import React, { useState } from 'react';
import Link from 'next/link';

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
      a: 'Yes. Powered by AI, the bot understands everyday Nigerian phrases like "How much last?", "You get size 42?", "I wan buy", and replies naturally in friendly English or Pidgin.',
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
    <section id="faq" className="py-16 md:py-24 bg-white border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center mb-14 space-y-3">
          <span className="text-slate-800 bg-slate-100 border border-slate-200 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded inline-block">
            Questions & Answers
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Everything you need to know about selling with ShopPal.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(idx)}
                  className="w-full text-left px-5 py-4 bg-white hover:bg-slate-50 flex items-center justify-between gap-4 transition"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-semibold text-slate-900">
                    {faq.q}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {isOpen ? 'Close' : 'Open'}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 text-slate-600 text-xs sm:text-sm leading-relaxed bg-white border-t border-slate-100">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Support callout */}
        <div className="mt-12 p-5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Still have questions?</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Contact our merchant support team on WhatsApp anytime.
            </p>
          </div>
          <a
            href="https://wa.me/14155238886?text=Hello%20ShopPal%20Support%2C%20I%20have%20a%20question"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded transition"
          >
            Chat with Support
          </a>
        </div>

      </div>
    </section>
  );
}
