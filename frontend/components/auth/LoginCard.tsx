'use client';

import React from 'react';
import Link from 'next/link';
import LoginForm from './LoginForm';

interface LoginCardProps {
  onSuccess?: () => void;
}

export default function LoginCard({ onSuccess }: LoginCardProps) {
  return (
    <div className="w-full max-w-[420px] mx-auto bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 transition-all duration-300">
      {/* Header */}
      <div className="text-center mb-6">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 mb-3 group transition"
        >
          <span className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-lg shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
            🛍️
          </span>
          <span className="text-lg font-black text-slate-900 tracking-tight">
            Naija Marketplace
          </span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Vendor Login
        </h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">
          Welcome back! Access your merchant dashboard
        </p>
      </div>

      {/* Main Interactive Form */}
      <LoginForm onSuccess={onSuccess} />

      {/* Footer */}
      <div className="mt-6 pt-5 border-t border-slate-100 text-center">
        <p className="text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition"
          >
            Sign up here
          </Link>
        </p>
        <p className="mt-2 text-[11px] text-slate-400">
          Sell on WhatsApp. Keep 98% of your sales.
        </p>
      </div>
    </div>
  );
}
