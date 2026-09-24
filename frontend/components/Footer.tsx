import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 py-6 px-4 sm:px-6 lg:px-8 mt-auto bg-white text-slate-500 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <p className="text-slate-700 font-medium">© {new Date().getFullYear()} ShopPal. All rights reserved.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Automated WhatsApp Commerce for Nigerian Merchants
          </p>
        </div>
        <div className="flex items-center gap-4 text-slate-600">
          <Link href="/privacy" className="hover:text-slate-900 transition">
            Privacy Policy
          </Link>
          <span>·</span>
          <Link href="/dashboard" className="hover:text-slate-900 transition">
            Dashboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
