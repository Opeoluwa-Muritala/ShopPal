import React from 'react';
import Link from 'next/link';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-black text-slate-900 tracking-tight hover:text-emerald-700 transition"
          >
            <span className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-base shadow-sm">
              🛍️
            </span>
            <span>Naija Marketplace</span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/dashboard" className="hover:text-emerald-600 transition">
              Dashboard
            </Link>
            <Link href="/products" className="hover:text-emerald-600 transition">
              Products
            </Link>
            <Link href="/orders" className="hover:text-emerald-600 transition">
              Orders
            </Link>
            <Link href="/settings" className="hover:text-emerald-600 transition">
              Settings
            </Link>
          </div>
        </div>

        {/* Right CTA / Auth buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-700 hover:text-emerald-700 px-3 py-2 rounded-lg transition"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl shadow-sm hover:shadow transition"
          >
            Sign up
          </Link>
        </div>
      </nav>
    </header>
  );
}
