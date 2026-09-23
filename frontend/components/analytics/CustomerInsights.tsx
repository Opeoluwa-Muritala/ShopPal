'use client';

import React from 'react';
import {
  Users,
  Repeat,
  UserPlus,
  BadgePercent,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { AnalyticsData } from './types';
import { formatNaira } from '../../lib/utils';

interface CustomerInsightsProps {
  data?: AnalyticsData;
  isLoading?: boolean;
}

export default function CustomerInsights({
  data,
  isLoading = false,
}: CustomerInsightsProps) {
  if (isLoading || !data) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs animate-pulse space-y-4">
        <div className="h-5 bg-slate-200 rounded-md w-44" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const {
    unique_customers = 52,
    repeat_purchase_rate = 0.23,
    customer_acquisition = 8,
    avg_customer_lifetime_value = 18500,
  } = data;

  const repeatPercent = Math.round(repeat_purchase_rate * 100);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
            Customer Behavior & WhatsApp Insights
          </h3>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 self-start sm:self-auto">
          High Retention Rate ({repeatPercent}%)
        </span>
      </div>

      {/* 4 Core Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Unique Customers */}
        <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Total Customers</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {unique_customers}
          </div>
          <span className="text-[11px] text-slate-500">Unique phone contacts</span>
        </div>

        {/* Metric 2: Repeat Purchase Rate */}
        <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Repeat Rate</span>
            <Repeat className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600">
            {repeatPercent}%
          </div>
          <span className="text-[11px] text-slate-500">Bought 2+ times</span>
        </div>

        {/* Metric 3: Customer Acquisition */}
        <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Acquisition</span>
            <UserPlus className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            +{customer_acquisition}
          </div>
          <span className="text-[11px] text-slate-500">New buyers this month</span>
        </div>

        {/* Metric 4: Avg Customer Lifetime Value */}
        <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Avg Lifetime Value</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">
            {formatNaira(avg_customer_lifetime_value)}
          </div>
          <span className="text-[11px] text-slate-500">Per active buyer</span>
        </div>
      </div>

      {/* Actionable Performance Alerts & WhatsApp Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
        <div className="flex items-start gap-3 p-3.5 bg-amber-50/80 border border-amber-200/70 rounded-xl text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">Inventory Alert:</strong> Red Kicks is selling slower this week (only 2 orders in 7 days). Consider featuring it on your WhatsApp broadcast or offering a 10% discount promo code.
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 bg-emerald-50/80 border border-emerald-200/70 rounded-xl text-xs text-emerald-900">
          <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">WhatsApp Bot Performance:</strong> 84% of orders were completed without human assistance. Customers ask mostly between 7 PM - 10 PM.
          </div>
        </div>
      </div>
    </div>
  );
}
