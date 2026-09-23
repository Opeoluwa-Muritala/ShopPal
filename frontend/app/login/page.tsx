import React from 'react';
import LoginCard from '../../components/auth/LoginCard';

export const metadata = {
  title: 'Vendor Login — Naija Marketplace',
  description: 'Access your Naija Marketplace merchant dashboard and manage your WhatsApp bot storefront.',
};

export default function LoginPage() {
  return (
    <section className="min-h-[calc(100vh-8rem)] py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-emerald-50/50 via-slate-50 to-white flex flex-col justify-center items-center">
      <div className="max-w-md mx-auto text-center mb-6">
        <span className="text-emerald-700 bg-emerald-100/80 border border-emerald-300/60 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-xs">
          <span>⚡</span>
          <span>WhatsApp Merchant Portal</span>
        </span>
      </div>

      <LoginCard />
    </section>
  );
}
