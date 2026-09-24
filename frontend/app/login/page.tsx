import React from 'react';
import LoginCard from '../../components/auth/LoginCard';

export const metadata = {
  title: 'Vendor Login — ShopPal',
  description: 'Access your ShopPal merchant dashboard and manage your WhatsApp bot storefront.',
};

export default function LoginPage() {
  return (
    <section className="min-h-[calc(100vh-8rem)] py-12 px-4 sm:px-6 lg:px-8 bg-white flex flex-col justify-center items-center">
      <div className="max-w-md mx-auto text-center mb-6">
        <span className="text-slate-800 bg-slate-100 border border-slate-200 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded inline-block">
          WhatsApp Merchant Portal
        </span>
      </div>

      <LoginCard />
    </section>
  );
}
