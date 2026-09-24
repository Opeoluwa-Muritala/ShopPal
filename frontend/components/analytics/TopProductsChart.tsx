'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { Award, ExternalLink, ArrowRight } from 'lucide-react';
import { TopProduct } from './types';
import { formatNaira } from '../../lib/utils';

interface TopProductsChartProps {
  products?: TopProduct[];
  isLoading?: boolean;
}

const DEFAULT_TOP_PRODUCTS: TopProduct[] = [
  { product_id: 'prod_001', name: 'Blue Sneaker', orders: 12, revenue: 180000 },
  { product_id: 'prod_002', name: 'Red Kicks', orders: 8, revenue: 96000 },
  { product_id: 'prod_003', name: 'Black Formal', orders: 6, revenue: 108000 },
  { product_id: 'prod_004', name: 'Casual Shirt', orders: 5, revenue: 75000 },
  { product_id: 'prod_005', name: 'Denim Jeans', orders: 3, revenue: 72000 },
];

const BAR_COLORS = ['#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6'];

export default function TopProductsChart({
  products = DEFAULT_TOP_PRODUCTS,
  isLoading = false,
}: TopProductsChartProps) {
  const [metricType, setMetricType] = useState<'orders' | 'revenue'>('orders');

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs animate-pulse">
        <div className="h-5 bg-slate-200 rounded-md w-48 mb-6" />
        <div className="h-64 sm:h-72 bg-slate-100 rounded-xl w-full" />
      </div>
    );
  }

  const chartData = products.slice(0, 5).map((p, idx) => ({
    ...p,
    rank: idx + 1,
    fillColor: BAR_COLORS[idx % BAR_COLORS.length],
  }));

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      {/* Header and Toggle */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Top 5 Best-Selling Products
            </h3>
          </div>

          {/* Toggle "By Orders" | "By Revenue" */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMetricType('orders')}
              className={`px-2.5 py-1 font-semibold rounded-md transition ${
                metricType === 'orders'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Orders
            </button>
            <button
              type="button"
              onClick={() => setMetricType('revenue')}
              className={`px-2.5 py-1 font-semibold rounded-md transition ${
                metricType === 'revenue'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Revenue
            </button>
          </div>
        </div>

        {/* Recharts Horizontal Bar Chart */}
        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis
                type="number"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) =>
                  metricType === 'revenue' ? `₦${(val / 1000).toFixed(0)}k` : `${val}`
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#475569"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip
                formatter={(value: any) => [
                  metricType === 'revenue' ? formatNaira(Number(value)) : `${value} orders`,
                  metricType === 'revenue' ? 'Revenue' : 'Orders',
                ]}
                contentStyle={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  borderRadius: '0.75rem',
                  border: 'none',
                  fontSize: '12px',
                }}
              />
              <Bar
                dataKey={metricType}
                radius={[0, 6, 6, 0]}
                barSize={20}
                animationDuration={800}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fillColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Product List with Link to Products Page */}
        <div className="mt-4 pt-3 border-t border-slate-100 divide-y divide-slate-100">
          {chartData.map((item) => (
            <div
              key={item.product_id}
              className="py-2 flex items-center justify-between text-xs hover:bg-slate-50 px-2 rounded-lg transition"
            >
              <div className="flex items-center gap-2">
                <span className="w-4 text-center font-bold text-slate-400">
                  #{item.rank}
                </span>
                <Link
                  href="/products"
                  className="font-bold text-slate-800 hover:text-emerald-700 transition flex items-center gap-1 group"
                  title="View in Products Catalog"
                >
                  <span>{item.name}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 transition" />
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-medium">
                  {item.orders} orders
                </span>
                <strong className="text-emerald-600 font-bold">
                  {formatNaira(item.revenue)}
                </strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Link */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Showing top {chartData.length} items
        </span>
        <Link
          href="/products"
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition"
        >
          <span>Manage Product Catalog</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
