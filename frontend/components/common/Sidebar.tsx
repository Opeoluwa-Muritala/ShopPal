'use client';

import React from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  LogOut,
  X,
  Store,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface SidebarProps {
  activeRoute?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
  vendorName?: string;
  shopName?: string;
}

export default function Sidebar({
  activeRoute = '/dashboard',
  isOpenMobile = false,
  onCloseMobile,
  onLogout,
  vendorName = 'Vendor',
  shopName = 'Naija Store',
}: SidebarProps) {
  const navItems = [
    { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Products', href: '/products', icon: Package, badge: '6 items' },
    { label: 'Orders', href: '/orders', icon: ShoppingCart, badge: '3 new', badgeColor: 'bg-emerald-100 text-emerald-800' },
    { label: 'Analytics', href: '#analytics', icon: BarChart3 },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      try {
        localStorage.removeItem('shoppal_vendor');
        localStorage.removeItem('shoppal_vendor_signup');
      } catch {
        // Ignore storage errors
      }
      window.location.href = '/login';
    }
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between bg-white text-slate-800 border-r border-slate-200">
      {/* Top Header / Store Branding */}
      <div>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
              🛍️
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-base tracking-tight leading-none block">
                Naija Marketplace
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Merchant Portal</span>
            </div>
          </Link>
          {isOpenMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              aria-label="Close navigation sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Store Identifier Card */}
        <div className="p-4">
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/10 flex items-center justify-center text-emerald-700">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-900 truncate">{shopName}</h4>
              <p className="text-[11px] text-emerald-700 font-medium truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live on WhatsApp
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeRoute === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile / Quick Info & Logout */}
      <div className="p-4 border-t border-slate-100 space-y-3">
        {/* WhatsApp Bot Status pill */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700">Bot 24/7 Active</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pidgin/Eng</span>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogoutClick}
          className="w-full flex items-center justify-center gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-100 py-2.5 px-4 rounded-xl text-sm font-bold transition duration-150"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 h-[calc(100vh-4rem)] sticky top-16 z-30">
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
