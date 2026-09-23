import React from 'react';
import Link from 'next/link';
import SignupForm from '../../components/signup/SignupForm';

export default function SignupPage() {
  return (
    <section className="min-h-[calc(100vh-8rem)] py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-emerald-50/50 via-slate-50 to-white flex flex-col justify-center">
      <div className="max-w-md mx-auto text-center mb-6">
        <span className="text-emerald-700 bg-emerald-100/80 border border-emerald-300/60 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          Fast Onboarding (&lt; 2 Minutes)
        </span>
      </div>

      <SignupForm />

      <p className="mt-6 text-center text-xs text-slate-500">
        Already registered as a vendor?{' '}
        <Link href="/login" className="font-semibold text-emerald-600 hover:text-emerald-700 underline">
          Sign in to your dashboard
        </Link>
      </p>
    </section>
  );
}
