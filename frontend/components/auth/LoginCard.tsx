'use client';

import React from 'react';
import Link from 'next/link';
import LoginForm from './LoginForm';

interface LoginCardProps {
  onSuccess?: () => void;
}

export default function LoginCard({ onSuccess }: LoginCardProps) {
  return (
    <div className="w-full max-w-md mx-auto bg-white border border-slate-200 rounded-lg p-6 sm:p-8">
      {/* Header */}
      <div className="text-center mb-6">
        <Link
          href="/"
          className="inline-block text-xl font-bold text-slate-900 tracking-tight mb-2 hover:text-slate-700"
        >
          ShopPal
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Vendor Login
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Welcome back! Access your merchant dashboard
        </p>
      </div>

      {/* Main Interactive Form */}
      <LoginForm onSuccess={onSuccess} />

      {/* Footer */}
      <div className="mt-6 pt-5 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-600">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="font-semibold text-slate-900 hover:underline"
          >
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  );
}
