'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell,
  Menu,
  ChevronDown,
  Settings,
  LogOut,
  Globe,
  Store,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShoppingBag,
} from 'lucide-react';
import { formatNaira } from '../../lib/utils';

export interface NotificationOrder {
  id: string;
  customerPhone: string;
  total: number;
  items: string;
  timestamp: string;
  read: boolean;
}

interface TopNavBarProps {
  vendorName?: string;
  isOpenStatus?: boolean;
  onToggleShopStatus?: () => void;
  onToggleMobileMenu?: () => void;
  recentOrders?: NotificationOrder[];
  onMarkNotificationsRead?: () => void;
  language?: 'en' | 'pcm';
  onLanguageChange?: (lang: 'en' | 'pcm') => void;
  onLogout?: () => void;
}

export default function TopNavBar({
  vendorName = 'Mrs. Chidinma Okafor',
  isOpenStatus = true,
  onToggleShopStatus,
  onToggleMobileMenu,
  recentOrders = [
    { id: '#ORD-9021', customerPhone: '0803 123 4567', total: 24000, items: 'Chelsea Boots (43)', timestamp: '10m ago', read: false },
    { id: '#ORD-9020', customerPhone: '0814 998 7711', total: 37000, items: 'Ankara Maxi Dress (x2)', timestamp: '35m ago', read: false },
    { id: '#ORD-9019', customerPhone: '0902 443 1209', total: 35000, items: 'Senator Suit (Navy)', timestamp: '1h ago', read: false },
  ],
  onMarkNotificationsRead,
  language = 'en',
  onLanguageChange,
  onLogout,
}: TopNavBarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [ordersState, setOrdersState] = useState<NotificationOrder[]>(recentOrders);

  // Sync orders when props change without cascading state calls
  useEffect(() => {
    setOrdersState(recentOrders);
  }, [recentOrders]);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = ordersState.filter((o) => !o.read).length;

  const handleMarkAllRead = () => {
    setOrdersState((prev) => prev.map((o) => ({ ...o, read: true })));
    if (onMarkNotificationsRead) {
      onMarkNotificationsRead();
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      try {
        localStorage.removeItem('shoppal_vendor');
        localStorage.removeItem('shoppal_vendor_signup');
      } catch {
        // Ignore
      }
      window.location.href = '/login';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left Side: Mobile Hamburger + Logo + Greeting */}
        <div className="flex items-center gap-3 md:gap-6 min-w-0">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
            aria-label="Open navigation sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <span className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-base shadow-sm">
              🛍️
            </span>
            <span className="font-extrabold text-slate-900 text-lg tracking-tight hidden sm:inline">
              Naija Marketplace
            </span>
          </Link>

          {/* Welcome Vendor Name */}
          <div className="hidden lg:block border-l border-slate-200 pl-4">
            <p className="text-sm font-bold text-slate-900 truncate">
              Welcome back, <span className="text-emerald-700">{vendorName}</span>! 👋
            </p>
            <p className="text-[11px] text-slate-500">Balogun Market, Lagos</p>
          </div>
        </div>

        {/* Right Side: Status Toggle + Notifications + User Menu */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Shop Status Toggle (Bonus Feature) */}
          <button
            onClick={onToggleShopStatus}
            type="button"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
              isOpenStatus
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
            title="Click to toggle shop taking orders status"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOpenStatus ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="hidden xs:inline">
              {isOpenStatus ? 'Open / Taking Orders' : 'Shop Paused'}
            </span>
          </button>

          {/* Language Switcher Button (Pidgin / English) */}
          <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold text-slate-600">
            <button
              onClick={() => onLanguageChange && onLanguageChange('en')}
              className={`px-2 py-1 rounded-md transition ${
                language === 'en' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => onLanguageChange && onLanguageChange('pcm')}
              className={`px-2 py-1 rounded-md transition ${
                language === 'pcm' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Pidgin
            </button>
          </div>

          {/* Notification Bell Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications((prev) => !prev)}
              aria-label={`Notifications, ${unreadCount} unread`}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Recent Order Alerts</h3>
                    {unreadCount > 0 && (
                      <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {ordersState.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No notifications yet.
                    </div>
                  ) : (
                    ordersState.map((order) => (
                      <div
                        key={order.id}
                        className={`p-3.5 hover:bg-slate-50 transition flex items-start gap-3 ${
                          !order.read ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {order.id} • {order.customerPhone}
                            </span>
                            <span className="text-[10px] text-slate-400">{order.timestamp}</span>
                          </div>
                          <p className="text-xs text-slate-600 truncate mt-0.5">{order.items}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-bold text-emerald-700">
                              {formatNaira(order.total)}
                            </span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded">
                              WhatsApp order
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-slate-100 text-center">
                  <Link
                    href="/orders"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 block py-1"
                  >
                    View All Orders →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Menu Profile Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu((prev) => !prev)}
              aria-label="User profile menu"
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 text-slate-700 hover:bg-slate-100 rounded-xl transition"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                {vendorName.charAt(0) || 'V'}
              </div>
              <span className="text-xs font-bold hidden sm:inline text-slate-800 max-w-[100px] truncate">
                {vendorName.split(' ')[0]}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">{vendorName}</p>
                  <p className="text-[11px] text-slate-500">Vendor ID: #V9042</p>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Store Settings</span>
                  </Link>

                  <div className="sm:hidden px-4 py-2 border-t border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-400 mb-1.5">Language</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onLanguageChange?.('en');
                          setShowUserMenu(false);
                        }}
                        className={`text-xs px-2.5 py-1 rounded border font-semibold ${
                          language === 'en' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'text-slate-600'
                        }`}
                      >
                        English
                      </button>
                      <button
                        onClick={() => {
                          onLanguageChange?.('pcm');
                          setShowUserMenu(false);
                        }}
                        className={`text-xs px-2.5 py-1 rounded border font-semibold ${
                          language === 'pcm' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'text-slate-600'
                        }`}
                      >
                        Pidgin
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
