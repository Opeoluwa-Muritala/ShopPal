'use client';

import React from 'react';
import { BillingUsageData } from './types';

export interface BillingUsageProps {
  billing: BillingUsageData;
}

export default function BillingUsage({ billing }: BillingUsageProps) {
  return (
    <div className="space-y-6">
      {/* Section: Subscription Plan */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Subscription Plan</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Plan details and features for your vendor workspace.
            </p>
          </div>

          <div>
            <span className="px-3 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {billing.planName}
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-slate-200 rounded p-4 bg-slate-50 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Current Plan Price
            </span>
            <div className="text-xl font-bold text-slate-900">{billing.price}</div>
            <p className="text-xs text-emerald-700 font-medium">
              {billing.planStatus}
            </p>
          </div>

          <div className="md:col-span-2 border border-slate-200 rounded p-4 bg-white space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 block">
              Plan Inclusions
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
              <div>• WhatsApp Commerce Storefront</div>
              <div>• Product Catalog Operations</div>
              <div>• Paystack Direct Settlement</div>
              <div>• Real-time Orders Dashboard</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Usage This Month */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Usage This Month</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Resource utilization across your store.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="border border-slate-200 rounded p-4 bg-slate-50 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              API Calls
            </span>
            <div className="text-xl font-bold text-slate-900">
              {billing.apiCalls.toLocaleString()}
            </div>
            <span className="text-xs text-slate-500">/ {billing.apiCallsLimit}</span>
          </div>

          <div className="border border-slate-200 rounded p-4 bg-slate-50 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Storage
            </span>
            <div className="text-xl font-bold text-slate-900">
              {billing.storageMb} MB
            </div>
            <span className="text-xs text-slate-500">/ {billing.storageLimit}</span>
          </div>

          <div className="border border-slate-200 rounded p-4 bg-slate-50 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Active Products
            </span>
            <div className="text-xl font-bold text-slate-900">
              {billing.activeProducts}
            </div>
            <span className="text-xs text-slate-500">/ {billing.activeProductsLimit}</span>
          </div>

          <div className="border border-slate-200 rounded p-4 bg-slate-50 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
              Orders Processed
            </span>
            <div className="text-xl font-bold text-slate-900">
              {billing.ordersProcessed}
            </div>
            <span className="text-xs text-slate-500">completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
