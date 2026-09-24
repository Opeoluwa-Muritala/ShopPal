import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 py-6 px-4 sm:px-8 mt-auto bg-slate-50 text-slate-500 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <p>© {new Date().getFullYear()} Naija Marketplace (EcomBot). All rights reserved.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            WhatsApp Conversational Commerce &amp; Paystack Integration for Nigerian Merchants
          </p>
        </div>
        <div className="flex items-center gap-4 font-semibold text-slate-600">
          <Link href="/privacy" className="hover:text-emerald-700 transition">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/dashboard/logs" className="hover:text-emerald-700 transition">
            System Diagnostics
          </Link>
          <span>•</span>
          <a
            href="https://wa.me/14155238886?text=Hello%20ShopPal%20Support"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-emerald-700 transition"
          >
            WhatsApp Support
          </a>
        </div>
      </div>
    </footer>
  );
}
