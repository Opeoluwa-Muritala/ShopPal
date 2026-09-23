'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { RevenueDataPoint } from './types';
import { formatNaira } from '../../lib/utils';

interface RevenueChartProps {
  data?: RevenueDataPoint[];
  isLoading?: boolean;
  title?: string;
}

// Custom Tooltip component for Recharts
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: RevenueDataPoint }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-800 text-xs">
        <p className="text-slate-400 font-medium mb-1">{label}</p>
        <p className="text-base font-extrabold text-emerald-400">
          {formatNaira(item.value)}
        </p>
        {item.payload.orders !== undefined && (
          <p className="text-xs text-slate-300 mt-0.5">
            {item.payload.orders} {item.payload.orders === 1 ? 'order' : 'orders'} completed
          </p>
        )}
      </div>
    );
  }
  return null;
}

// Compact Y-axis formatter (e.g., 50k instead of 50000)
function formatCompactCurrency(val: number): string {
  if (val >= 1000000) {
    return `₦${(val / 1000000).toFixed(1)}M`;
  }
  if (val >= 1000) {
    return `₦${(val / 1000).toFixed(0)}k`;
  }
  return `₦${val}`;
}

export default function RevenueChart({
  data = [],
  isLoading = false,
  title = 'Revenue Over Time',
}: RevenueChartProps) {
  const [chartMode, setChartMode] = useState<'daily' | 'cumulative'>('daily');

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs animate-pulse">
        <div className="h-5 bg-slate-200 rounded-md w-40 mb-6" />
        <div className="h-64 sm:h-72 bg-slate-100 rounded-xl w-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xs text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-700">No revenue data recorded yet</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Revenue charts will display once your customers begin placing orders via your WhatsApp bot.
        </p>
      </div>
    );
  }

  // Calculate cumulative data if mode is active
  let accumulated = 0;
  const processedData = data.map((d) => {
    accumulated += d.revenue;
    return {
      ...d,
      displayRevenue: chartMode === 'cumulative' ? accumulated : d.revenue,
    };
  });

  const totalPeriodRevenue = data.reduce((acc, curr) => acc + curr.revenue, 0);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
      {/* Header with Title and Mode Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              {title}
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200/60">
              Total: {formatNaira(totalPeriodRevenue)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified payouts received from WhatsApp purchases
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setChartMode('daily')}
            className={`px-2.5 py-1 font-semibold rounded-md transition ${
              chartMode === 'daily'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setChartMode('cumulative')}
            className={`px-2.5 py-1 font-semibold rounded-md transition ${
              chartMode === 'cumulative'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cumulative
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={processedData}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="analyticsRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCompactCurrency}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="displayRevenue"
              stroke="#22c55e"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#analyticsRevenueGrad)"
              activeDot={{ r: 6, fill: '#16a34a', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
