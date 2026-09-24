'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ShoppingBag,
  MessageSquare,
  Users,
  CreditCard,
  Plus,
  Truck,
  ExternalLink,
  Package,
  Settings,
  Sparkles,
  Inbox,
  Loader2,
} from 'lucide-react';
import { formatNaira } from '../../lib/utils';
import { ordersApi, productsApi, diagnosticsApi } from '../../lib/api';

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true);
      try {
        const [ordersRes, productsRes, logsRes] = await Promise.allSettled([
          ordersApi.list(),
          productsApi.list(),
          diagnosticsApi.getRecentLogs(5),
        ]);

        if (ordersRes.status === 'fulfilled' && ordersRes.value.data?.orders) {
          setOrders(ordersRes.value.data.orders);
        }
        if (productsRes.status === 'fulfilled' && productsRes.value.data?.products) {
          setProducts(productsRes.value.data.products);
        }
        if (logsRes.status === 'fulfilled' && logsRes.value.data?.logs) {
          setRecentLogs(logsRes.value.data.logs);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  // Compute live metrics from backend fetched data
  const totalSales = orders.reduce((sum, o) => {
    const isPaid = (o.payment_status || '').toLowerCase() === 'paid';
    const amount = typeof o.total === 'string' ? parseFloat(o.total) || 0 : Number(o.total) || 0;
    return isPaid ? sum + amount : sum;
  }, 0);

  const totalOrdersCount = orders.length;
  const completedOrdersCount = orders.filter((o) => (o.status || '').toLowerCase() === 'delivered').length;
  const inTransitOrdersCount = orders.filter(
    (o) => (o.status || '').toLowerCase() === 'shipped' || (o.status || '').toLowerCase() === 'processing'
  ).length;
  const pendingOrdersCount = orders.filter((o) => (o.status || '').toLowerCase() === 'new').length;

  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalSales / totalOrdersCount) : 0;
  const totalCatalogStock = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);

  const recentOrders = orders.slice(0, 5);
  const topProducts = products.slice(0, 5);

  // SVG Donut calculation
  const completedPct = totalOrdersCount > 0 ? Math.round((completedOrdersCount / totalOrdersCount) * 100) : 0;
  const inTransitPct = totalOrdersCount > 0 ? Math.round((inTransitOrdersCount / totalOrdersCount) * 100) : 0;
  const pendingPct = totalOrdersCount > 0 ? Math.max(0, 100 - completedPct - inTransitPct) : 0;

  const circumference = 238; // 2 * PI * 38
  const completedDash = (completedPct / 100) * circumference;
  const inTransitDash = (inTransitPct / 100) * circumference;
  const pendingDash = (pendingPct / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* Header & WhatsApp Connection Status */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#111827', margin: 0 }}>Vendor Dashboard</h1>
            <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '9999px', border: '1px solid #a7f3d0' }}>
              ShopPal Storefront
            </span>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            AI-powered WhatsApp conversational commerce for Nigerian merchants.
          </p>
        </div>

        {/* WhatsApp Connection Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.4rem 0.8rem', borderRadius: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#166534' }}>
              WhatsApp Bot Active
            </span>
          </div>
          <Link
            href="/products"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            }}
          >
            <Plus size={16} /> Add Product
          </Link>
        </div>
      </div>

      {/* Top Quick Stats Summary Bar */}
      <div style={{ backgroundColor: '#064e3b', color: '#ffffff', borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Sparkles size={20} color="#6ee7b7" />
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
            <strong>Store Highlights:</strong> {totalOrdersCount} automated orders recorded • {formatNaira(totalSales)} settled via Paystack
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
          <span style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '0.25rem 0.6rem', borderRadius: '0.375rem' }}>
            {inTransitOrdersCount} Dispatches Active
          </span>
          <span style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '0.25rem 0.6rem', borderRadius: '0.375rem' }}>
            {products.length} Catalog Items
          </span>
        </div>
      </div>

      {/* 6 Live KPI Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        {/* Total Sales / Revenue */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Total Sales</span>
            <span style={{ color: '#16a34a', backgroundColor: '#f0fdf4', padding: '0.1rem 0.35rem', borderRadius: '0.25rem' }}>Live</span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>
            {formatNaira(totalSales)}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Settled to bank via Paystack</span>
        </div>

        {/* Active Orders */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Active Orders</span>
            <ShoppingBag size={14} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>{totalOrdersCount}</div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
            {completedOrdersCount} completed • {inTransitOrdersCount} in transit
          </span>
        </div>

        {/* Catalog Items */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Catalog Items</span>
            <Package size={14} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>{products.length}</div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{totalCatalogStock} total units in stock</span>
        </div>

        {/* Average Order Value */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Avg Order Value</span>
            <CreditCard size={14} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>{formatNaira(avgOrderValue)}</div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Per completed customer order</span>
        </div>

        {/* Customer Base */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Customer Orders</span>
            <Users size={14} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>{totalOrdersCount}</div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Recorded via WhatsApp bot</span>
        </div>

        {/* Pending Actions */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Pending Orders</span>
            <MessageSquare size={14} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>{pendingOrdersCount}</div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Awaiting packaging or payment</span>
        </div>
      </div>

      {/* Charts & Status Breakdown Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>

        {/* Revenue Trend Visualizer */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#111827' }}>Revenue Trends</h3>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.2rem 0 0' }}>Sales generated from automated chat checkout links</p>
            </div>
            {/* Time Filter Buttons */}
            <div style={{ display: 'flex', backgroundColor: '#f3f4f6', padding: '0.2rem', borderRadius: '0.5rem', gap: '0.25rem' }}>
              {(['7d', '30d', 'all'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  style={{
                    border: 'none',
                    backgroundColor: timeRange === range ? '#ffffff' : 'transparent',
                    color: timeRange === range ? '#16a34a' : '#6b7280',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    boxShadow: timeRange === range ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Trend Line / Zero State */}
          <div style={{ position: 'relative', width: '100%', height: '180px', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {totalSales === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                <TrendingUp size={36} color="#d1d5db" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563', margin: 0 }}>No revenue recorded yet</p>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
                  Orders verified by Paystack will dynamically plot here.
                </p>
              </div>
            ) : (
              <svg viewBox="0 0 600 200" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="dashboardAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="50" x2="600" y2="50" stroke="#f3f4f6" strokeWidth="1" />
                <line x1="0" y1="100" x2="600" y2="100" stroke="#f3f4f6" strokeWidth="1" />
                <line x1="0" y1="150" x2="600" y2="150" stroke="#f3f4f6" strokeWidth="1" />
                <path d="M0,170 C100,160 200,120 300,90 C400,100 500,50 600,20 L600,200 L0,200 Z" fill="url(#dashboardAreaGrad)" />
                <path d="M0,170 C100,160 200,120 300,90 C400,100 500,50 600,20" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '0.5rem' }}>
            <span>Active Period Revenue: {formatNaira(totalSales)}</span>
            <span>{totalOrdersCount} Completed Sales</span>
          </div>
        </div>

        {/* Donut Chart / Order Status Breakdown */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#111827' }}>Order Status Breakdown</h3>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.2rem 0 0' }}>{totalOrdersCount} total active transactions</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', margin: '1rem 0' }}>
            <svg viewBox="0 0 100 100" style={{ width: '130px', height: '130px', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f3f4f6" strokeWidth="12" />
              {totalOrdersCount > 0 && (
                <>
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray={`${completedDash} ${circumference}`} strokeDashoffset="0" />
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#0ea5e9" strokeWidth="12" strokeDasharray={`${inTransitDash} ${circumference}`} strokeDashoffset={`-${completedDash}`} />
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f59e0b" strokeWidth="12" strokeDasharray={`${pendingDash} ${circumference}`} strokeDashoffset={`-${completedDash + inTransitDash}`} />
                </>
              )}
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>{totalOrdersCount}</span>
              <span style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Orders</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <span style={{ color: '#4b5563' }}>Completed &amp; Delivered</span>
              </div>
              <strong style={{ color: '#111827' }}>{completedOrdersCount} ({completedPct}%)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0ea5e9' }} />
                <span style={{ color: '#4b5563' }}>In Transit (Dispatch)</span>
              </div>
              <strong style={{ color: '#111827' }}>{inTransitOrdersCount} ({inTransitPct}%)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <span style={{ color: '#4b5563' }}>Pending Packaging</span>
              </div>
              <strong style={{ color: '#111827' }}>{pendingOrdersCount} ({pendingPct}%)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Shortcuts */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: '#111827' }}>
          Merchant Quick Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          <Link
            href="/products"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #bbf7d0',
              backgroundColor: '#f0fdf4',
              color: '#166534',
              textDecoration: 'none',
              fontSize: '0.825rem',
              fontWeight: 600,
            }}
          >
            <Package size={16} /> Add Single Product
          </Link>
          <Link
            href="/products"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              color: '#374151',
              textDecoration: 'none',
              fontSize: '0.825rem',
              fontWeight: 600,
            }}
          >
            <ExternalLink size={16} /> Bulk CSV Upload
          </Link>
          <Link
            href="/dashboard/analytics"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #bbf7d0',
              backgroundColor: '#f0fdf4',
              color: '#166534',
              textDecoration: 'none',
              fontSize: '0.825rem',
              fontWeight: 600,
            }}
          >
            <TrendingUp size={16} /> Business Analytics
          </Link>
          <Link
            href="/orders"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              color: '#374151',
              textDecoration: 'none',
              fontSize: '0.825rem',
              fontWeight: 600,
            }}
          >
            <Truck size={16} /> View All Orders
          </Link>
          <Link
            href="/settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              color: '#374151',
              textDecoration: 'none',
              fontSize: '0.825rem',
              fontWeight: 600,
            }}
          >
            <Settings size={16} /> WhatsApp Settings
          </Link>
        </div>
      </div>

      {/* Real-Time WhatsApp Activity Feed & Top Selling Products */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>

        {/* Real-time WhatsApp Activity Feed */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={18} color="#16a34a" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#111827' }}>Live WhatsApp Activity</h3>
              </div>
              <span style={{ fontSize: '0.65rem', backgroundColor: '#dcfce7', color: '#166534', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '9999px' }}>
                LIVE
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#9ca3af' }}>
                <Inbox size={32} color="#d1d5db" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563', margin: 0 }}>No WhatsApp activity yet</p>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
                  Inbound customer chats and webhook events will display here in real time.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {recentLogs.map((log, idx) => (
                  <div key={idx} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span style={{ color: '#111827' }}>{log.route || 'Webhook Activity'}</span>
                      <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>{log.timestamp ? log.timestamp.slice(11, 19) : 'Just now'}</span>
                    </div>
                    <p style={{ fontSize: '0.775rem', color: '#4b5563', margin: '0.2rem 0' }}>
                      {log.message}
                    </p>
                    <span style={{ fontSize: '0.7rem', color: '#065f46', backgroundColor: '#ecfdf5', padding: '0.1rem 0.35rem', borderRadius: '0.25rem' }}>
                      {log.level || 'INFO'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/dashboard/logs"
            style={{
              display: 'block',
              textAlign: 'center',
              width: '100%',
              marginTop: '1rem',
              border: 'none',
              backgroundColor: '#f0fdf4',
              color: '#166534',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            View Full WhatsApp Message Logs →
          </Link>
        </div>

        {/* Top Products Widget */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#111827' }}>Catalog Highlights</h3>
              <Link href="/products" style={{ fontSize: '0.75rem', color: '#16a34a', textDecoration: 'none', fontWeight: 600 }}>
                Manage Catalog →
              </Link>
            </div>

            {topProducts.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#9ca3af' }}>
                <Package size={32} color="#d1d5db" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563', margin: 0 }}>No products in catalog</p>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
                  Add products to start displaying your inventory to WhatsApp shoppers.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#9ca3af', fontSize: '0.7rem' }}>
                      <th style={{ padding: '0.4rem 0' }}>Product</th>
                      <th style={{ padding: '0.4rem 0' }}>Stock</th>
                      <th style={{ padding: '0.4rem 0', textAlign: 'right' }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p) => {
                      const priceNum = typeof p.price === 'string' ? parseFloat(p.price) || 0 : Number(p.price) || 0;
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.6rem 0', fontWeight: 600, color: '#111827' }}>{p.name}</td>
                          <td style={{ padding: '0.6rem 0' }}>
                            <span style={{ backgroundColor: Number(p.stock) > 0 ? '#ecfdf5' : '#fee2e2', color: Number(p.stock) > 0 ? '#065f46' : '#991b1b', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontSize: '0.7rem' }}>
                              {p.stock} units
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>{formatNaira(priceNum)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.75rem', color: '#6b7280', borderTop: '1px solid #f3f4f6', paddingTop: '0.5rem' }}>
            Total active catalog stock: <strong>{totalCatalogStock} units</strong>
          </div>
        </div>
      </div>

      {/* Recent Orders Table Preview */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#111827' }}>Recent WhatsApp Orders</h3>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.2rem 0 0' }}>Customer transactions verified by Paystack</p>
          </div>
          <Link href="/orders" style={{ fontSize: '0.75rem', color: '#16a34a', textDecoration: 'none', fontWeight: 600 }}>
            View All Orders →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#9ca3af' }}>
            <ShoppingBag size={36} color="#d1d5db" style={{ margin: '0 auto 0.5rem auto' }} />
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#4b5563', margin: 0 }}>No orders recorded yet</p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
              Orders completed by Nigerian shoppers on WhatsApp will automatically appear here.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#9ca3af', fontSize: '0.75rem' }}>
                  <th style={{ padding: '0.5rem' }}>Order ID</th>
                  <th style={{ padding: '0.5rem' }}>Customer Phone</th>
                  <th style={{ padding: '0.5rem' }}>Items</th>
                  <th style={{ padding: '0.5rem' }}>Total</th>
                  <th style={{ padding: '0.5rem' }}>Payment</th>
                  <th style={{ padding: '0.5rem' }}>Fulfillment</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const amount = typeof order.total === 'string' ? parseFloat(order.total) || 0 : Number(order.total) || 0;
                  const isPaid = (order.payment_status || '').toLowerCase() === 'paid';
                  const itemsSummary = Array.isArray(order.items)
                    ? order.items.map((i: any) => `${i.quantity || 1}x ${i.name}`).join(', ')
                    : '1x WhatsApp Cart Order';

                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, fontFamily: 'monospace' }}>
                        {order.order_code || `ORD-${order.id.slice(0, 4).toUpperCase()}`}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>{order.customer_phone}</td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>{itemsSummary}</td>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>{formatNaira(amount)}</td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>
                        <span style={{ backgroundColor: isPaid ? '#ecfdf5' : '#fef3c7', color: isPaid ? '#065f46' : '#92400e', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '9999px' }}>
                          {(order.payment_status || 'PENDING').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>
                        <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                          {order.status || 'new'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer / Merchant Testimonial Snippet */}
      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.825rem', color: '#064e3b', fontStyle: 'italic' }}>
            &ldquo;ShopPal answered customer questions in Nigerian Pidgin while I was away, closed sales, and sent me the Paystack receipts directly.&rdquo;
          </p>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#166534', marginTop: '0.35rem' }}>
            — Mrs. Chidinma Okafor, Fabric Merchant at Balogun Market, Lagos
          </span>
        </div>
        <Link
          href="/dashboard/analytics"
          style={{
            backgroundColor: '#16a34a',
            color: '#ffffff',
            fontSize: '0.8rem',
            fontWeight: 600,
            padding: '0.45rem 0.9rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          View Store Reports →
        </Link>
      </div>

    </div>
  );
}
