'use client';

import React, { useState } from 'react';
import {
  ShoppingCart,
  Wallet,
  BarChart3,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { AnalyticsData } from './types';
import { formatNaira } from '../../lib/utils';

interface SummaryCardsProps {
  data?: AnalyticsData;
  isLoading?: boolean;
  periodLabel?: string;
}

export default function SummaryCards({
  data,
  isLoading = false,
  periodLabel = 'Last 30 days',
}: SummaryCardsProps) {
  const [showCommissionTooltip, setShowCommissionTooltip] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs animate-pulse space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 bg-slate-200 rounded-md w-24" />
              <div className="w-8 h-8 rounded-xl bg-slate-100" />
            </div>
            <div className="h-8 bg-slate-200 rounded-md w-36" />
            <div className="h-4 bg-slate-100 rounded-md w-48" />
          </div>
        ))}
      </div>
    );
  }

  const {
    total_orders = 45,
    total_revenue = 450000,
    commission = 9000,
    avg_order_value = 10000,
    repeat_customers = 12,
    unique_customers = 52,
    orders_trend = { value: 12, is_positive: true },
    revenue_trend = { value: 50000, is_positive: true },
    aov_trend = { value: 500, is_positive: true },
    repeat_customers_trend = { value: 3, is_positive: true },
  } = data;

  const vendorEarnings = Math.max(0, total_revenue - commission);
  const repeatCustomerPercentage =
    unique_customers > 0 ? Math.round((repeat_customers / unique_customers) * 100) : 12;

  // Mini sparkline SVG points for orders trend
  const sparklinePoints = '0,24 15,20 30,22 45,15 60,18 75,8 90,4';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
      {/* Card 1: Total Orders */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Orders
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {total_orders}
            </div>
            {/* Sparkline mini chart */}
            <div className="w-24 h-8 flex items-center" title="7-day order trend">
              <svg viewBox="0 0 90 28" className="w-full h-full overflow-visible">
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={sparklinePoints}
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">{periodLabel}</span>
          <div
            className={`flex items-center gap-1 font-bold ${
              orders_trend.is_positive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {orders_trend.is_positive ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            <span>
              {orders_trend.is_positive ? `+${orders_trend.value}` : `-${orders_trend.value}`} vs last month
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: Total Revenue */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:shadow-sm transition relative">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Revenue
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold text-emerald-600 tracking-tight">
              {formatNaira(total_revenue)}
            </div>
            {/* Commission Breakdown Value Prop */}
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
              <span>
                You keep <strong className="text-emerald-700 font-bold">{formatNaira(vendorEarnings)}</strong> (2% commission)
              </span>
              <div
                className="relative inline-block"
                onMouseEnter={() => setShowCommissionTooltip(true)}
                onMouseLeave={() => setShowCommissionTooltip(false)}
                onClick={() => setShowCommissionTooltip(!showCommissionTooltip)}
              >
                <button
                  type="button"
                  className="text-slate-400 hover:text-emerald-600 transition"
                  aria-label="View commission breakdown"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>

                {showCommissionTooltip && (
                  <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-xs rounded-xl shadow-xl pointer-events-none">
                    <p className="font-bold text-slate-200 mb-1">Commission Breakdown</p>
                    <div className="space-y-1 text-slate-300">
                      <div className="flex justify-between">
                        <span>Gross Sales:</span>
                        <span>{formatNaira(total_revenue)}</span>
                      </div>
                      <div className="flex justify-between text-rose-300">
                        <span>ShopPal Fee (2%):</span>
                        <span>-{formatNaira(commission)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-400 pt-1 border-t border-slate-700">
                        <span>Net Payout:</span>
                        <span>{formatNaira(vendorEarnings)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">{periodLabel}</span>
          <div
            className={`flex items-center gap-1 font-bold ${
              revenue_trend.is_positive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {revenue_trend.is_positive ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            <span>
              {revenue_trend.is_positive ? `+${formatNaira(revenue_trend.value)}` : `-${formatNaira(revenue_trend.value)}`} vs last month
            </span>
          </div>
        </div>
      </div>

      {/* Card 3: Average Order Value */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Avg Order Value
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatNaira(avg_order_value)}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Calculated as Total Revenue / Total Orders
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">{periodLabel}</span>
          <div
            className={`flex items-center gap-1 font-bold ${
              aov_trend.is_positive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {aov_trend.is_positive ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            <span>
              {aov_trend.is_positive ? `+${formatNaira(aov_trend.value)}` : `-${formatNaira(aov_trend.value)}`} vs last month
            </span>
          </div>
        </div>
      </div>

      {/* Card 4: Repeat Customers */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:shadow-sm transition">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Repeat Customers
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {repeat_customers}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {repeatCustomerPercentage}% of your customers
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">{periodLabel}</span>
          <div className="flex items-center gap-1 font-bold text-emerald-600">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{repeat_customers_trend.value} new repeat customers this month</span>
          </div>
        </div>
      </div>
    </div>
  );
}
