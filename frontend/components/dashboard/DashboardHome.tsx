'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Wallet,
  Users,
  Percent,
  CheckCircle2,
  Bell,
  Sparkles,
  ExternalLink,
  Share2,
  X,
  RefreshCw,
} from 'lucide-react';
import Sidebar from '../common/Sidebar';
import TopNavBar, { NotificationOrder } from '../common/TopNavBar';
import StatsCard from './StatsCard';
import RecentOrdersSection, { DashboardOrder } from './RecentOrdersSection';
import TopProductsSection, { TopProduct } from './TopProductsSection';
import QuickActionsBar from './QuickActionsBar';
import GettingStartedChecklist from './GettingStartedChecklist';
import BroadcastModal from './BroadcastModal';
import { apiClient } from '../../lib/api';
import { formatNaira } from '../../lib/utils';

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  commission: number;
  repeatCustomers: number;
  ordersTrend: string;
  revenueTrend: string;
  customersTrend: string;
}

interface ToastMessage {
  id: string;
  title: string;
  description: string;
  type: 'order' | 'info' | 'success';
}

const DEFAULT_ORDERS: DashboardOrder[] = [
  {
    id: '#ORD-9021',
    customerPhone: '0803 123 4567',
    items: 'Chelsea Boots (43)',
    total: 24000,
    status: 'Paid',
    timestamp: '10m ago',
  },
  {
    id: '#ORD-9020',
    customerPhone: '0814 998 7711',
    items: 'Ankara Maxi Dress (x2)',
    total: 37000,
    status: 'Paid',
    timestamp: '35m ago',
  },
  {
    id: '#ORD-9019',
    customerPhone: '0902 443 1209',
    items: 'Senator Suit (Navy)',
    total: 35000,
    status: 'Processing',
    timestamp: '1h ago',
  },
  {
    id: '#ORD-9018',
    customerPhone: '0708 554 9923',
    items: 'Quartz Watch + Leather Bag',
    total: 27000,
    status: 'Shipped',
    timestamp: '3h ago',
  },
  {
    id: '#ORD-9017',
    customerPhone: '0816 772 3410',
    items: 'Leather Crossbody Bag',
    total: 15000,
    status: 'New',
    timestamp: '5h ago',
  },
];

const DEFAULT_PRODUCTS: TopProduct[] = [
  {
    id: 'prod-1',
    name: 'Ankara Maxi Dress',
    category: 'Clothing',
    ordersCount: 8,
    revenue: 148000,
    stock: 14,
    emoji: '👗',
  },
  {
    id: 'prod-2',
    name: 'Senator Suit (Navy Blue)',
    category: 'Clothing',
    ordersCount: 5,
    revenue: 175000,
    stock: 8,
    emoji: '👔',
  },
  {
    id: 'prod-3',
    name: 'Chelsea Boots (Leather)',
    category: 'Footwear',
    ordersCount: 4,
    revenue: 96000,
    stock: 12,
    emoji: '👞',
  },
];

const DEFAULT_STATS: DashboardStats = {
  totalOrders: 12,
  totalRevenue: 450000,
  commission: 9000,
  repeatCustomers: 8,
  ordersTrend: '+3 from last week',
  revenueTrend: '+₦50,000 from last week',
  customersTrend: '+2 from last week',
};

export default function DashboardHome() {
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOpenStatus, setIsOpenStatus] = useState(true);
  const [language, setLanguage] = useState<'en' | 'pcm'>('en');
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Vendor Data State
  const [vendorName, setVendorName] = useState('Mrs. Chidinma Okafor');
  const [shopName, setShopName] = useState('Chidinma Fabrics & Fashion');
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [orders, setOrders] = useState<DashboardOrder[]>(DEFAULT_ORDERS);
  const [products, setProducts] = useState<TopProduct[]>(DEFAULT_PRODUCTS);

  const prevOrderCountRef = useRef<number>(DEFAULT_ORDERS.length);
  const hasMountedRef = useRef<boolean>(false);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch Dashboard Data from Backend or use Demo Fallback
  const fetchDashboardData = useCallback(async () => {
    try {
      let vendorId = 'v_9042';
      try {
        const storedVendor = localStorage.getItem('shoppal_vendor');
        if (storedVendor) {
          const parsed = JSON.parse(storedVendor);
          if (parsed.vendor_id) vendorId = parsed.vendor_id;
          if (parsed.name) setVendorName(parsed.name);
          if (parsed.business_name) setShopName(parsed.business_name);
        }
      } catch {
        // Fallback
      }

      const res = await apiClient<any>(`/api/dashboard?vendor_id=${encodeURIComponent(vendorId)}`);
      if (res.data) {
        if (res.data.stats) setStats(res.data.stats);
        if (res.data.orders) {
          // Detect newly arrived orders for toast notification
          if (hasMountedRef.current && res.data.orders.length > prevOrderCountRef.current) {
            const newOrder = res.data.orders[0];
            addToast({
              title: `🔔 New order from ${newOrder.customerPhone}`,
              description: `${newOrder.items} • ${formatNaira(newOrder.total)}`,
              type: 'order',
            });
          }
          prevOrderCountRef.current = res.data.orders.length;
          setOrders(res.data.orders);
        }
        if (res.data.products) setProducts(res.data.products);
      }
    } catch {
      // Backend not yet available: graceful demo state preserved
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  // Initial Load (deferred schedule to satisfy react compiler linting)
  useEffect(() => {
    const timer = setTimeout(() => {
      hasMountedRef.current = true;
      fetchDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchDashboardData]);

  // Real-Time Polling: Polls every 5 seconds (5000ms)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Share Shop Action: Copies Store Link to Clipboard & shows Toast
  const handleShareShop = () => {
    const shopUrl = typeof window !== 'undefined' ? `${window.location.origin}/store/chidinma` : 'https://naijamarketplace.ng/store/chidinma';
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shopUrl);
      }
      setIsCopied(true);
      addToast({
        title: 'Shop Link Copied! 🛍️',
        description: 'Link copied to clipboard. Ready to paste on WhatsApp status or groups!',
        type: 'success',
      });
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      addToast({
        title: 'Share Link',
        description: shopUrl,
        type: 'info',
      });
    }
  };

  const handleBroadcastSent = (msg: string) => {
    addToast({
      title: 'Broadcast Dispatched! 📢',
      description: 'Your announcement was queued for active WhatsApp customers.',
      type: 'success',
    });
  };

  // Convert orders to TopNavBar notification format
  const notificationOrders: NotificationOrder[] = orders.map((o) => ({
    id: o.id,
    customerPhone: o.customerPhone,
    total: o.total,
    items: o.items,
    timestamp: o.timestamp,
    read: false,
  }));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <TopNavBar
        vendorName={vendorName}
        isOpenStatus={isOpenStatus}
        onToggleShopStatus={() => setIsOpenStatus(!isOpenStatus)}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        recentOrders={notificationOrders}
        language={language}
        onLanguageChange={(lang) => setLanguage(lang)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Sidebar (Desktop + Mobile Drawer) */}
        <Sidebar
          activeRoute="/dashboard"
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          vendorName={vendorName}
          shopName={shopName}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Welcome & Live Status Banner */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Vendor Dashboard
                </h1>
                <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ShopPal Verified
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {language === 'pcm'
                  ? 'Your WhatsApp bot dey work 24/7 dey answer customers and close sales.'
                  : 'Your automated WhatsApp commerce bot is active, receiving customer inquiries, and settling via Paystack.'}
              </p>
            </div>

            {/* Live WhatsApp Bot Indicator */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-900">
                  WhatsApp Bot: <strong className="font-bold">+234 812 000 7890</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => fetchDashboardData()}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
                title="Refresh dashboard stats"
                aria-label="Refresh dashboard data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Section 5: Getting Started Checklist (Dismissible/Collapsible for new vendors) */}
          <GettingStartedChecklist
            hasOrders={orders.length > 0}
            hasProducts={products.length > 0}
            onShareClick={handleShareShop}
          />

          {/* Section 1: Quick Stats Cards (4 Cards in 2x2 on mobile, 4-col on desktop) */}
          <section aria-label="Key Performance Indicators">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Orders */}
              <StatsCard
                title="Total Orders"
                subtitle="All WhatsApp Checkouts"
                value={isLoading ? '...' : stats.totalOrders.toString()}
                period="This Week"
                trend={stats.ordersTrend}
                trendDirection="up"
                icon={ShoppingCart}
                iconBgColor="bg-emerald-50"
                iconColor="text-emerald-600"
                href="/orders"
                testId="stats-total-orders"
              />

              {/* Card 2: Total Revenue / Total Sales */}
              <StatsCard
                title="Total Revenue"
                subtitle="Total Sales"
                value={isLoading ? '...' : formatNaira(stats.totalRevenue)}
                period="This Week"
                trend={stats.revenueTrend}
                trendDirection="up"
                icon={Wallet}
                iconBgColor="bg-emerald-50"
                iconColor="text-emerald-700"
                href="/orders"
                tooltip="Gross settled customer transactions processed via Paystack"
                testId="stats-total-revenue"
              />

              {/* Card 3: Commission to You (OMJ Labs) */}
              <StatsCard
                title="Commission to You (OMJ Labs)"
                subtitle="2-3% platform fee"
                value={isLoading ? '...' : formatNaira(stats.commission)}
                period="2-3% commission (you keep 98%)"
                trend="You keep 98% of sales"
                trendDirection="neutral"
                icon={Percent}
                iconBgColor="bg-blue-50"
                iconColor="text-blue-600"
                tooltip="Naija Marketplace charges only 2% commission upon successful delivery. You keep 98% of all revenue."
                testId="stats-commission"
              />

              {/* Card 4: Repeat Customers */}
              <StatsCard
                title="Repeat Customers"
                subtitle="Loyal buyers"
                value={isLoading ? '...' : stats.repeatCustomers.toString()}
                period="Customers who ordered 2+ times"
                trend={stats.customersTrend}
                trendDirection="up"
                icon={Users}
                iconBgColor="bg-purple-50"
                iconColor="text-purple-600"
                tooltip="Customers who have completed two or more orders through your WhatsApp bot"
                testId="stats-repeat-customers"
              />
            </div>
          </section>

          {/* Section 4: Quick Actions Bar */}
          <QuickActionsBar
            onShareShop={handleShareShop}
            onOpenBroadcast={() => setIsBroadcastOpen(true)}
            isCopied={isCopied}
          />

          {/* Sections 2 & 3: Recent Orders (Left/Top) & Best-Selling Products (Right/Bottom) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Section 2: Recent Orders List (Spans 2 columns on lg) */}
            <div className="lg:col-span-2">
              <RecentOrdersSection orders={orders} isLoading={isLoading} />
            </div>

            {/* Section 3: Best-Selling Products (Spans 1 column on lg) */}
            <div className="lg:col-span-1">
              <TopProductsSection products={products} isLoading={isLoading} />
            </div>
          </div>
        </main>
      </div>

      {/* Customer Broadcast Modal */}
      <BroadcastModal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        onSent={handleBroadcastSent}
      />

      {/* Floating Toast Notification Container */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border text-xs animate-in slide-in-from-bottom-5 duration-200 ${
              toast.type === 'order'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : toast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-white text-slate-900 border-slate-200'
            }`}
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs">{toast.title}</h4>
              <p className="text-[11px] opacity-90 mt-0.5">{toast.description}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/60 hover:text-white p-1"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
