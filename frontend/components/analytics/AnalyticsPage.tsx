'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AnalyticsProvider from './AnalyticsProvider';
import DateRangePicker from './DateRangePicker';
import SummaryCards from './SummaryCards';
import RevenueChart from './RevenueChart';
import TopProductsChart from './TopProductsChart';
import PaymentStatusChart from './PaymentStatusChart';
import CustomerInsights from './CustomerInsights';
import { AnalyticsData, DateRangeKey } from './types';
import { ordersApi, productsApi } from '../../lib/api';

// Empty/zero state — used as fallback when API fails or returns no data.
// Keeps the AnalyticsData shape satisfied without exposing fake demo figures.
const FALLBACK_ANALYTICS: AnalyticsData = {
  total_orders: 0,
  total_revenue: 0,
  commission: 0,
  avg_order_value: 0,
  repeat_customers: 0,
  revenue_by_date: [],
  top_products: [],
  payment_status: { paid: 0, pending: 0, failed: 0 },
  unique_customers: 0,
  repeat_purchase_rate: 0,
  customer_acquisition: 0,
  avg_customer_lifetime_value: 0,
  orders_trend: { value: 0, is_positive: true },
  revenue_trend: { value: 0, is_positive: true },
  aov_trend: { value: 0, is_positive: true },
  repeat_customers_trend: { value: 0, is_positive: true },
};

/** Derive AnalyticsData from real orders + products API responses */
function deriveAnalytics(
  orders: Awaited<ReturnType<typeof ordersApi.list>>['data'],
  _products: Awaited<ReturnType<typeof productsApi.list>>['data']
): AnalyticsData {
  if (!orders) return FALLBACK_ANALYTICS;

  const orderList = orders.orders ?? [];

  // Payment status counts
  const paymentStatus = { paid: 0, pending: 0, failed: 0 };
  for (const o of orderList) {
    const ps = (o.payment_status || '').toLowerCase();
    if (ps === 'paid') paymentStatus.paid += 1;
    else if (ps === 'pending') paymentStatus.pending += 1;
    else if (ps === 'failed') paymentStatus.failed += 1;
  }

  // Revenue from paid orders only
  const totalRevenue = orderList.reduce((sum, o) => {
    if ((o.payment_status || '').toLowerCase() === 'paid') {
      return sum + parseFloat(String(o.total) || '0');
    }
    return sum;
  }, 0);

  const totalOrders = orderList.length;
  const commission = totalRevenue * 0.02;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Unique and repeat customers
  const phoneCounts = new Map<string, number>();
  for (const o of orderList) {
    const phone = o.customer_phone || 'unknown';
    phoneCounts.set(phone, (phoneCounts.get(phone) ?? 0) + 1);
  }
  const uniqueCustomers = phoneCounts.size;
  const repeatCustomers = Array.from(phoneCounts.values()).filter((c) => c > 1).length;
  const repeatPurchaseRate = uniqueCustomers > 0 ? repeatCustomers / uniqueCustomers : 0;

  // Revenue by date — group by date portion of created_at (fallback to today)
  const today = new Date().toISOString().slice(0, 10);
  const revenueByDateMap = new Map<string, { revenue: number; orders: number }>();
  for (const o of orderList) {
    const dateKey: string = (o as any).created_at
      ? String((o as any).created_at).slice(0, 10)
      : today;
    const entry = revenueByDateMap.get(dateKey) ?? { revenue: 0, orders: 0 };
    if ((o.payment_status || '').toLowerCase() === 'paid') {
      entry.revenue += parseFloat(String(o.total) || '0');
    }
    entry.orders += 1;
    revenueByDateMap.set(dateKey, entry);
  }
  const revenueByDate = Array.from(revenueByDateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { revenue, orders }]) => ({ date, revenue, orders }));

  // Top products — group order items by product name
  const productOrderMap = new Map<string, { product_id: string; orders: number; revenue: number }>();
  for (const o of orderList) {
    const items: any[] = Array.isArray(o.items) ? o.items : [];
    for (const item of items) {
      const name: string = item.name || item.product_name || 'Unknown Product';
      const prodId: string = item.product_id || item.id || name;
      const itemRevenue =
        parseFloat(String(item.price || item.total || '0')) *
        (parseInt(String(item.quantity || item.qty || '1'), 10) || 1);
      const existing = productOrderMap.get(name) ?? { product_id: prodId, orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += itemRevenue;
      productOrderMap.set(name, existing);
    }
  }
  const topProducts = Array.from(productOrderMap.entries())
    .map(([name, { product_id, orders, revenue }]) => ({
      product_id,
      name,
      orders,
      revenue,
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);

  const avgCustomerLifetimeValue =
    uniqueCustomers > 0 ? totalRevenue / uniqueCustomers : 0;

  return {
    total_orders: totalOrders,
    total_revenue: totalRevenue,
    commission,
    avg_order_value: avgOrderValue,
    repeat_customers: repeatCustomers,
    revenue_by_date: revenueByDate,
    top_products: topProducts,
    payment_status: paymentStatus,
    unique_customers: uniqueCustomers,
    repeat_purchase_rate: repeatPurchaseRate,
    customer_acquisition: uniqueCustomers,
    avg_customer_lifetime_value: avgCustomerLifetimeValue,
    orders_trend: { value: 0, is_positive: true },
    revenue_trend: { value: 0, is_positive: true },
    aov_trend: { value: 0, is_positive: true },
    repeat_customers_trend: { value: 0, is_positive: true },
  };
}

function AnalyticsContent({ vendorId = 'demo_vendor' }: { vendorId?: string }) {
  const [dateRange, setDateRange] = useState<DateRangeKey>('30days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // React Query Fetcher — derives analytics from real orders + products endpoints
  const {
    data = FALLBACK_ANALYTICS,
    isLoading,
    isRefetching,
    refetch,
    isError,
  } = useQuery<AnalyticsData>({
    queryKey: ['analytics', vendorId, dateRange, customFrom, customTo],
    queryFn: async () => {
      const [ordersRes, productsRes] = await Promise.all([
        ordersApi.list(),
        productsApi.list(),
      ]);

      if (ordersRes.error && productsRes.error) {
        // Both failed — return empty state, no fake data
        return FALLBACK_ANALYTICS;
      }

      return deriveAnalytics(ordersRes.data, productsRes.data);
    },
  });

  const handleRefresh = async () => {
    setLastRefreshedAt(new Date());
    await refetch();
  };

  const handleCustomDatesChange = (from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
  };

  const handleDownloadReport = () => {
    // Generates a simple print / PDF export
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const periodLabelMap: Record<DateRangeKey, string> = {
    '7days': 'Last 7 days',
    '30days': 'Last 30 days',
    'this_month': 'This Month',
    'all_time': 'All time',
    'custom': customFrom && customTo ? `${customFrom} to ${customTo}` : 'Custom range',
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Analytics
              </h1>
              <span className="text-xs font-semibold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                ShopPal
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Monitor store performance, revenue retention, and sales metrics.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadReport}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
              title="Print or Save Analytics as PDF"
            >
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Date Range Picker Bar */}
        <DateRangePicker
          selectedRange={dateRange}
          onRangeChange={setDateRange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomDatesChange={handleCustomDatesChange}
          onRefresh={handleRefresh}
          isRefreshing={isLoading || isRefetching}
          lastUpdatedText={`Last updated: ${lastRefreshedAt.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}`}
        />

        {/* Section 1: Summary Cards (4 Cards: Orders, Revenue, AOV, Repeat Customers) */}
        <SummaryCards
          data={data}
          isLoading={isLoading}
          periodLabel={periodLabelMap[dateRange]}
        />

        {/* Section 2: Revenue Chart Over Time */}
        <RevenueChart
          data={data.revenue_by_date}
          isLoading={isLoading}
          title={`Revenue Over Time (${periodLabelMap[dateRange]})`}
        />

        {/* Sections 3 & 4: Top 5 Best-Selling Products + Payment Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {/* Section 3: Top 5 Products */}
          <TopProductsChart
            products={data.top_products}
            isLoading={isLoading}
          />

          {/* Section 4: Payment Status Breakdown */}
          <PaymentStatusChart
            paymentStatus={data.payment_status}
            isLoading={isLoading}
          />
        </div>

        {/* Section 5: Customer Insights & WhatsApp Behavior */}
        <CustomerInsights
          data={data}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

export default function AnalyticsPage({ vendorId = 'demo_vendor' }: { vendorId?: string }) {
  return (
    <AnalyticsProvider>
      <AnalyticsContent vendorId={vendorId} />
    </AnalyticsProvider>
  );
}
