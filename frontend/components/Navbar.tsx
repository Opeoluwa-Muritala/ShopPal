'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authApi } from '../lib/api';
import { getCurrentSession, clearStoredTokens, UserSession } from '../lib/auth';

export default function Navbar() {
  const pathname = usePathname();
  const [session, setSession] = useState<UserSession>({
    accessToken: null,
    refreshToken: null,
    vendorId: null,
    accountId: null,
    email: null,
    role: null,
    name: null,
    businessName: null,
    phone: null,
    isAuthenticated: false,
  });

  const updateSession = () => {
    setSession(getCurrentSession());
  };

  useEffect(() => {
    updateSession();

    if (typeof window !== 'undefined') {
      window.addEventListener('shoppal-auth-changed', updateSession);
      window.addEventListener('nm-auth-changed', updateSession);
      return () => {
        window.removeEventListener('shoppal-auth-changed', updateSession);
        window.removeEventListener('nm-auth-changed', updateSession);
      };
    }
  }, []);

  const handleLogout = async () => {
    try {
      const current = getCurrentSession();
      if (current.refreshToken) {
        await authApi.logout(current.refreshToken);
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      clearStoredTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  const displayName = session.businessName || session.name || session.email || 'Vendor';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link
            href={session.isAuthenticated ? '/dashboard' : '/'}
            className="flex items-center gap-2 text-xl font-bold text-slate-900 tracking-tight hover:text-emerald-700 transition"
          >
            <span className="w-7 h-7 rounded bg-emerald-600 text-white flex items-center justify-center font-extrabold text-sm">
              S
            </span>
            <span>ShopPal</span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link
              href="/dashboard"
              className={`transition ${
                pathname === '/dashboard' ? 'text-emerald-700 font-semibold' : 'hover:text-emerald-600'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/products"
              className={`transition ${
                pathname === '/products' ? 'text-emerald-700 font-semibold' : 'hover:text-emerald-600'
              }`}
            >
              Products
            </Link>
            <Link
              href="/orders"
              className={`transition ${
                pathname === '/orders' ? 'text-emerald-700 font-semibold' : 'hover:text-emerald-600'
              }`}
            >
              Orders
            </Link>
            <Link
              href="/settings"
              className={`transition ${
                pathname === '/settings' || pathname.startsWith('/settings')
                  ? 'text-emerald-700 font-semibold'
                  : 'hover:text-emerald-600'
              }`}
            >
              Settings
            </Link>
          </div>
        </div>


        {/* Right CTA / Auth Status */}
        <div className="flex items-center gap-4">
          {session.isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                {displayName}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-medium text-slate-600 hover:text-red-700 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded transition"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-slate-700 hover:text-emerald-700 px-3 py-1.5 transition"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg shadow-sm transition"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>

      </nav>
    </header>
  );
}
