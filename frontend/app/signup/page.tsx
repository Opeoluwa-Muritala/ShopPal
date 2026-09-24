import React from 'react';
import Link from 'next/link';
import SignupForm from '../../components/signup/SignupForm';

export const metadata = {
  title: 'Sign Up — ShopPal',
  description: 'Create your ShopPal automated WhatsApp storefront in under 2 minutes.',
};

export default function SignupPage() {
  return (
    <section className="min-h-[calc(100vh-8rem)] py-12 px-4 sm:px-6 lg:px-8 bg-white flex flex-col justify-center">
      <div className="max-w-md mx-auto text-center mb-6">
        <span className="text-slate-800 bg-slate-100 border border-slate-200 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded inline-block">
          Fast Onboarding
        </span>
      </div>

      <SignupForm />

      <p className="mt-6 text-center text-xs text-slate-500">
        Already registered as a vendor?{' '}
        <Link href="/login" className="font-semibold text-slate-900 hover:underline">
          Sign in to your dashboard
        </Link>
      </p>
    </section>
  );
}
