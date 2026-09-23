'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  Share2,
  FileSpreadsheet,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import AnalyticsProvider from './AnalyticsProvider';
import DateRangePicker from './DateRangePicker';
import SummaryCards from './SummaryCards';
import RevenueChart from './RevenueChart';
import TopProductsChart from './TopProductsChart';
import PaymentStatusChart from './PaymentStatusChart';
import CustomerInsights from './CustomerInsights';
import { AnalyticsData, DateRangeKey } from './types';
import { apiClient } from '../../lib/api';

// Fallback initial/demo data for instant render & offline resilience
const FALLBACK_ANALYTICS: AnalyticsData = {
  total_orders: 45,
  total_revenue: 450000,
  commission: 9000,
  avg_order_value: 10000,
  repeat_customers: 12,
  revenue_by_date: [
    { date: 'Sep 01', revenue: 15000, orders: 2 },
    { date: 'Sep 03', revenue: 22000, orders: 2 },
    { date: 'Sep 05', revenue: 35000, orders: 3 },
    { date: 'Sep 08', revenue: 18000, orders: 1 },
    { date: 'Sep 10', revenue: 28000, orders: 3 },
    { date: 'Sep 12', revenue: 42000, orders: 4 },
    { date: 'Sep 14', revenue: 31000, orders: 3 },
    { date: 'Sep 16', revenue: 49000, orders: 5 },
    { date: 'Sep 18', revenue: 38000, orders: 4 },
    { date: 'Sep 20', revenue: 45000, orders: 4 },
    { date: 'Sep 21', revenue: 42000, orders: 4 },
    { date: 'Sep 22', revenue: 65000, orders: 6 },
    { date: 'Sep 23', revenue: 20000, orders: 2 },
  ],
  top_products: [
    { product_id: 'prod_001', name: 'Blue Sneaker', orders: 12, revenue: 180000 },
    { product_id: 'prod_002', name: 'Red Kicks', orders: 8, revenue: 96000 },
    { product_id: 'prod_003', name: 'Black Formal', orders: 6, revenue: 108000 },
    { product_id: 'prod_004', name: 'Casual Shirt', orders: 5, revenue: 75000 },
    { product_id: 'prod_005', name: 'Denim Jeans', orders: 3, revenue: 72000 },
  ],
  payment_status: {
    paid: 38,
    pending: 5,
    failed: 2,
  },
  unique_customers: 52,
  repeat_purchase_rate: 0.23,
  customer_acquisition: 8,
  avg_customer_lifetime_value: 18500,
  orders_trend: { value: 12, is_positive: true },
  revenue_trend: { value: 50000, is_positive: true },
  aov_trend: { value: 500, is_positive: true },
  repeat_customers_trend: { value: 3, is_positive: true },
};

function AnalyticsContent({ vendorId = 'demo_vendor' }: { vendorId?: string }) {
  const [dateRange, setDateRange] = useState<DateRangeKey>('30days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  const queryClient = useQueryClient();

  // React Query Fetcher
  const {
    data = FALLBACK_ANALYTICS,
    isLoading,
    isRefetching,
    refetch,
    isError,
  } = useQuery<AnalyticsData>({
    queryKey: ['analytics', vendorId, dateRange, customFrom, customTo],
    queryFn: async () => {
      let queryParams = `vendor_id=${encodeURIComponent(vendorId)}&date_range=${encodeURIComponent(
        dateRange
      )}`;
      if (dateRange === 'custom' && customFrom && customTo) {
        queryParams += `&from=${encodeURIComponent(customFrom)}&to=${encodeURIComponent(customTo)}`;
      }

      // Try Next.js API route first (supports local standalone & hackathon demo mode)
      try {
        const localRes = await fetch(`/api/analytics?${queryParams}`);
        if (localRes.ok) {
          return await localRes.json();
        }
      } catch {
        // Fall back to backend apiClient
      }

      const res = await apiClient<AnalyticsData>(`/api/analytics?${queryParams}`);
      if (res.data) {
        return res.data;
      }
      return FALLBACK_ANALYTICS;
    },
    initialData: FALLBACK_ANALYTICS,
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
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Analytics
              </h1>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Naija Marketplace
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Monitor your store performance, revenue retention (keep 98%), and WhatsApp sales metrics.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition"
              title="Print or Save Analytics as PDF"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
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
