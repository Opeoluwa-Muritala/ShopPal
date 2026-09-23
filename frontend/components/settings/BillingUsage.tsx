'use client';

import React from 'react';
import {
  CreditCard,
  Zap,
  HardDrive,
  ShoppingBag,
  TrendingUp,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { BillingUsageData } from './types';

export interface BillingUsageProps {
  billing: BillingUsageData;
}

export default function BillingUsage({ billing }: BillingUsageProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Section: Subscription Plan */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Subscription Plan</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Current tier details and billing cycles for your vendor workspace.
              </p>
            </div>
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5" />
              {billing.planName}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-slate-200/90 rounded-xl p-5 bg-slate-50/50 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Current Plan Price
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-slate-900">{billing.price}</span>
              <span className="text-xs text-slate-500">during hackathon</span>
            </div>
            <p className="text-xs text-emerald-700 font-semibold">
              {billing.planStatus}
            </p>
          </div>

          <div className="md:col-span-2 border border-slate-200/90 rounded-xl p-5 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Plan Inclusions
              </span>
              <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full">
                100% Unlocked
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>AI WhatsApp Commerce Bot</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Unlimited Catalog Imports</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Direct Paystack Settlement</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Real-time Order Dashboard</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Enjoy full platform capabilities throughout the evaluation period.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">
              Keep using free plan
            </span>
            <button
              type="button"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition"
            >
              Upgrade Plan →
            </button>
          </div>
        </div>
      </div>

      {/* Section: Usage This Month */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Usage This Month</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Real-time resource utilization and throughput across your store.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* API Calls */}
          <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">API Calls</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900">
                {billing.apiCalls.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">/ {billing.apiCallsLimit}</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full w-[25%]" />
            </div>
          </div>

          {/* Storage */}
          <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Storage</span>
              <HardDrive className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900">
                {billing.storageMb} MB
              </span>
              <span className="text-xs text-slate-500">/ {billing.storageLimit}</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full w-[10%]" />
            </div>
          </div>

          {/* Active Products */}
          <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Products</span>
              <ShoppingBag className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900">
                {billing.activeProducts}
              </span>
              <span className="text-xs text-slate-500">/ {billing.activeProductsLimit}</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-[15%]" />
            </div>
          </div>

          {/* Orders Processed */}
          <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Orders Processed</span>
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900">
                {billing.ordersProcessed}
              </span>
              <span className="text-xs text-slate-500">completed</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-full w-[45%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
