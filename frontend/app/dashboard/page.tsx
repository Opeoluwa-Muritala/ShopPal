'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ShoppingBag,
  MessageSquare,
  Users,
  CreditCard,
  Plus,
  ArrowUpRight,
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Package,
  Settings,
  Sparkles,
} from 'lucide-react';
import { formatNaira } from '../../lib/utils';

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  const chartData = {
    '7d': {
      line: 'M0,170 C80,150 140,110 200,125 C260,140 320,80 380,75 C440,70 500,95 600,30',
      area: 'M0,170 C80,150 140,110 200,125 C260,140 320,80 380,75 C440,70 500,95 600,30 L600,200 L0,200 Z',
      labels: ['Mon (₦140k)', 'Tue (₦185k)', 'Wed (₦165k)', 'Thu (₦210k)', 'Fri (₦290k)', 'Sat (₦340k)', 'Sun (₦420k)'],
      revenue: 1480500,
    },
    '30d': {
      line: 'M0,180 C100,160 200,130 300,90 C400,100 500,50 600,20',
      area: 'M0,180 C100,160 200,130 300,90 C400,100 500,50 600,20 L600,200 L0,200 Z',
      labels: ['Week 1 (₦240k)', 'Week 2 (₦380k)', 'Week 3 (₦410k)', 'Week 4 (₦450k)'],
      revenue: 4120000,
    },
    all: {
      line: 'M0,190 C150,170 300,120 450,60 550,40 600,10',
      area: 'M0,190 C150,170 300,120 450,60 550,40 600,10 L600,200 L0,200 Z',
      labels: ['Jan (₦450k)', 'Feb (₦680k)', 'Mar (₦920k)', 'Apr (₦1.48M)'],
      revenue: 9680000,
    },
  };

  const currentChart = chartData[timeRange];

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
              WhatsApp Bot Active (+234 812 000 7890)
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
            <strong>Today&apos;s Highlights:</strong> 18 automated WhatsApp orders closed • ₦324,500 settled via Paystack
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
          <span style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '0.25rem 0.6rem', borderRadius: '0.375rem' }}>
            3 Pending Dispatches
          </span>
          <span style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '0.25rem 0.6rem', borderRadius: '0.375rem' }}>
            99.4% Twilio Delivery
          </span>
        </div>
      </div>

      {/* 6 Enhanced KPI Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        {/* Total Sales / Revenue */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Total Sales</span>
            <span style={{ color: '#16a34a', backgroundColor: '#f0fdf4', padding: '0.1rem 0.35rem', borderRadius: '0.25rem' }}>+24.8%</span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>
            {formatNaira(1480500)}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Settled to bank via Paystack</span>
        </div>

        {/* Active Orders */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Active Orders</span>
            <ShoppingBag size={14} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>85</div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>72 completed • 13 in transit</span>
        </div>

        {/* Conversion Rate */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Conversion Rate</span>
            <TrendingUp size={14} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>14.2%</div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>WhatsApp inquiry to paid</span>
        </div>

        {/* Average Order Value */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Avg Order Value</span>
            <CreditCard size={14} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>{formatNaira(18200)}</div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>2.3 items per customer cart</span>
        </div>

        {/* Customer Retention */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Repeat Buyers</span>
            <Users size={14} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>68.4%</div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Returning WhatsApp buyers</span>
        </div>

        {/* Message Delivery Rate */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600 }}>
            <span>Delivery Rate</span>
            <MessageSquare size={14} color="#16a34a" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>99.4%</div>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>1.8s avg Claude bot response</span>
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

          {/* SVG Trend Line */}
          <div style={{ position: 'relative', width: '100%', height: '180px', marginTop: '0.5rem' }}>
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
              <path d={currentChart.area} fill="url(#dashboardAreaGrad)" />
              <path d={currentChart.line} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>

          {/* X Axis Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '0.5rem' }}>
            {currentChart.labels.map((lbl, idx) => (
              <span key={idx}>{lbl}</span>
            ))}
          </div>
        </div>

        {/* Donut Chart / Order Status Breakdown */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#111827' }}>Order Status Breakdown</h3>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.2rem 0 0' }}>85 total active transactions</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', margin: '1rem 0' }}>
            <svg viewBox="0 0 100 100" style={{ width: '130px', height: '130px', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f3f4f6" strokeWidth="12" />
              {/* Completed 72% */}
              <circle cx="50" cy="50" r="38" fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray="172 238" strokeDashoffset="0" />
              {/* In Transit 18% */}
              <circle cx="50" cy="50" r="38" fill="transparent" stroke="#0ea5e9" strokeWidth="12" strokeDasharray="43 238" strokeDashoffset="-172" />
              {/* Pending 10% */}
              <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f59e0b" strokeWidth="12" strokeDasharray="24 238" strokeDashoffset="-215" />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>85</span>
              <span style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Orders</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <span style={{ color: '#4b5563' }}>Completed & Delivered</span>
              </div>
              <strong style={{ color: '#111827' }}>61 (72%)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0ea5e9' }} />
                <span style={{ color: '#4b5563' }}>In Transit (Dispatch)</span>
              </div>
              <strong style={{ color: '#111827' }}>15 (18%)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <span style={{ color: '#4b5563' }}>Pending Packaging</span>
              </div>
              <strong style={{ color: '#111827' }}>9 (10%)</strong>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                  <span style={{ color: '#111827' }}>Tunde O. (Ikeja, Lagos)</span>
                  <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>2m ago</span>
                </div>
                <p style={{ fontSize: '0.775rem', color: '#4b5563', margin: '0.2rem 0' }}>
                  Paid <strong style={{ color: '#16a34a' }}>₦24,000</strong> for <em>Chelsea Boots (Size 43)</em> via Paystack.
                </p>
                <span style={{ fontSize: '0.7rem', color: '#065f46', backgroundColor: '#ecfdf5', padding: '0.1rem 0.35rem', borderRadius: '0.25rem' }}>
                  Receipt sent on WhatsApp
                </span>
              </div>

              <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                  <span style={{ color: '#111827' }}>Amina B. (Wuse II, Abuja)</span>
                  <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>7m ago</span>
                </div>
                <p style={{ fontSize: '0.775rem', color: '#4b5563', margin: '0.2rem 0' }}>
                  Asked in Pidgin: <em>&ldquo;How much last for Ankara Dress?&rdquo;</em> — Bot answered: ₦18,500.
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                  <span style={{ color: '#111827' }}>Chidinma E. (Port Harcourt)</span>
                  <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>14m ago</span>
                </div>
                <p style={{ fontSize: '0.775rem', color: '#4b5563', margin: '0.2rem 0' }}>
                  Added 2 items to WhatsApp cart (₦37,000 total). Paystack checkout link generated.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            style={{
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
            }}
          >
            View Full WhatsApp Message Logs →
          </button>
        </div>

        {/* Top 5 Products Widget */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#111827' }}>Top 5 Products</h3>
              <Link href="/products" style={{ fontSize: '0.75rem', color: '#16a34a', textDecoration: 'none', fontWeight: 600 }}>
                Manage Catalog →
              </Link>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#9ca3af', fontSize: '0.7rem' }}>
                    <th style={{ padding: '0.4rem 0' }}>Product</th>
                    <th style={{ padding: '0.4rem 0' }}>Stock</th>
                    <th style={{ padding: '0.4rem 0', textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 600, color: '#111827' }}>Chelsea Leather Boots</td>
                    <td style={{ padding: '0.6rem 0' }}>
                      <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontSize: '0.7rem' }}>18 left</span>
                    </td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>₦768,000</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 600, color: '#111827' }}>Ankara Premium Dress</td>
                    <td style={{ padding: '0.6rem 0' }}>
                      <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontSize: '0.7rem' }}>12 left</span>
                    </td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>₦388,500</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 600, color: '#111827' }}>Senator Navy Suit</td>
                    <td style={{ padding: '0.6rem 0' }}>
                      <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontSize: '0.7rem' }}>4 left</span>
                    </td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>₦210,000</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.6rem 0', fontWeight: 600, color: '#111827' }}>Casual Quartz Watch</td>
                    <td style={{ padding: '0.6rem 0' }}>
                      <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontSize: '0.7rem' }}>25 left</span>
                    </td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>₦96,000</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.6rem 0', fontWeight: 600, color: '#111827' }}>Leather Crossbody Bag</td>
                    <td style={{ padding: '0.6rem 0' }}>
                      <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontSize: '0.7rem' }}>10 left</span>
                    </td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>₦75,000</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: '#6b7280', borderTop: '1px solid #f3f4f6', paddingTop: '0.5rem' }}>
            Total active catalog stock: <strong>69 units</strong>
          </div>
        </div>
      </div>

      {/* Recent Orders Table Preview (Last 5 Orders) */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#111827' }}>Recent WhatsApp Orders</h3>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.2rem 0 0' }}>Last 5 customer transactions verified by Paystack</p>
          </div>
          <Link href="/orders" style={{ fontSize: '0.75rem', color: '#16a34a', textDecoration: 'none', fontWeight: 600 }}>
            View All Orders →
          </Link>
        </div>

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
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, fontFamily: 'monospace' }}>#ORD-9021</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>+234 803 123 4567</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>1x Chelsea Boots (43)</td>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>₦24,000</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>
                  <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '9999px' }}>PAID</span>
                </td>
                <td style={{ padding: '0.6rem 0.5rem' }}>
                  <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>Dispatched</span>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, fontFamily: 'monospace' }}>#ORD-9020</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>+234 814 998 7711</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>2x Ankara Maxi Dress</td>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>₦37,000</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>
                  <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '9999px' }}>PAID</span>
                </td>
                <td style={{ padding: '0.6rem 0.5rem' }}>
                  <span style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>Packaging</span>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, fontFamily: 'monospace' }}>#ORD-9019</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>+234 902 443 1209</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>1x Senator Suit (Navy)</td>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>₦35,000</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>
                  <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '9999px' }}>PAID</span>
                </td>
                <td style={{ padding: '0.6rem 0.5rem' }}>
                  <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>Delivered</span>
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, fontFamily: 'monospace' }}>#ORD-9018</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>+234 708 554 9923</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>1x Quartz Watch + Bag</td>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>₦27,000</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>
                  <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '9999px' }}>PAID</span>
                </td>
                <td style={{ padding: '0.6rem 0.5rem' }}>
                  <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>Delivered</span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, fontFamily: 'monospace' }}>#ORD-9017</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>+234 816 772 3410</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>1x Leather Crossbody</td>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>₦15,000</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>
                  <span style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '9999px' }}>PENDING</span>
                </td>
                <td style={{ padding: '0.6rem 0.5rem' }}>
                  <span style={{ backgroundColor: '#f3f4f6', color: '#4b5563', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>Awaiting Pay</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer / Merchant Testimonial Snippet */}
      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.825rem', color: '#064e3b', fontStyle: 'italic' }}>
            &ldquo;ShopPal answered over 40 customer questions in Nigerian Pidgin while I was away, closed 12 sales, and sent me the Paystack receipts directly. It feels like having 3 staff members working 24/7.&rdquo;
          </p>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#166534', marginTop: '0.35rem' }}>
            — Mrs. Chidinma Okafor, Fabric Merchant at Balogun Market, Lagos
          </span>
        </div>
        <Link
          href="/orders"
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
