'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle, MessageCircle } from 'lucide-react';
import Link from 'next/link';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How do I sign up?',
      a: 'Signing up takes under 2 minutes. Enter your business name, email, and password, then upload your products either one-by-one or via our bulk CSV spreadsheet template. Your WhatsApp bot activates immediately.',
    },
    {
      q: 'How much do you charge?',
      a: 'We charge only a tiny 2% transaction fee on successful sales. You keep 98% of your money. There are zero upfront setup fees, zero monthly subscription fees, and no hidden charges.',
    },
    {
      q: 'Do customers need to download an app?',
      a: 'No! Customers shop directly inside their existing WhatsApp chat. They text your number, search products, view photos and prices, and receive direct Paystack checkout links right in the chat.',
    },
    {
      q: 'How do I get paid?',
      a: 'All customer transactions are processed securely through Paystack. The funds settle automatically into your registered Nigerian bank account (GTBank, Access, Zenith, Kuda, etc.) with instant confirmation receipts.',
    },
    {
      q: 'Does the bot understand Nigerian Pidgin and local slang?',
      a: 'Yes! Powered by Claude 3.5, the bot understands everyday Nigerian phrases like "How much last?", "You get size 42?", "I wan buy", and answers naturally in friendly English or Pidgin.',
    },
    {
      q: 'What if I have questions or need help?',
      a: 'Our Lagos-based support team is always available. You can reach out directly via WhatsApp chat, email, or schedule a 1-on-1 walkthrough anytime.',
    },
  ];

  const toggleAccordion = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-16 md:py-24 bg-white border-b border-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center mb-14 space-y-3">
          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
            Got Questions?
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-600 text-base sm:text-lg">
            Everything you need to know about selling with Naija Marketplace.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="border border-slate-200 rounded-2xl overflow-hidden transition-all duration-200 shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(idx)}
                  className="w-full text-left px-6 py-5 bg-white hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-base sm:text-lg font-bold text-slate-900">
                    {faq.q}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? 'bg-emerald-100 text-emerald-800 rotate-180' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-slate-600 text-sm sm:text-base leading-relaxed bg-white border-t border-slate-100">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Need more help support callout */}
        <div className="mt-12 p-6 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Still have questions?</h3>
              <p className="text-xs text-slate-600">Chat with our onboarding team directly on WhatsApp.</p>
            </div>
          </div>
          <Link
            href="/signup"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
          >
            Chat with Us →
          </Link>
        </div>

      </div>
    </section>
  );
}
