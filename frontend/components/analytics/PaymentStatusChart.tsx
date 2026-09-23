'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { CreditCard, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { PaymentStatus } from './types';

interface PaymentStatusChartProps {
  paymentStatus?: PaymentStatus;
  isLoading?: boolean;
}

const DEFAULT_PAYMENT_STATUS: PaymentStatus = {
  paid: 38,
  pending: 5,
  failed: 2,
};

const STATUS_CONFIG = {
  paid: {
    label: 'Paid & Settled',
    color: '#22c55e', // Emerald Green
    icon: CheckCircle2,
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  pending: {
    label: 'Pending Payment',
    color: '#f59e0b', // Amber
    icon: Clock,
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  failed: {
    label: 'Failed / Abandoned',
    color: '#ef4444', // Red
    icon: XCircle,
    badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
  },
};

export default function PaymentStatusChart({
  paymentStatus = DEFAULT_PAYMENT_STATUS,
  isLoading = false,
}: PaymentStatusChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs animate-pulse">
        <div className="h-5 bg-slate-200 rounded-md w-36 mb-6" />
        <div className="h-64 bg-slate-100 rounded-xl w-full" />
      </div>
    );
  }

  const { paid = 38, pending = 5, failed = 2 } = paymentStatus;
  const total = paid + pending + failed;

  const data = [
    {
      name: 'Paid',
      key: 'paid' as const,
      value: paid,
      color: STATUS_CONFIG.paid.color,
      percent: total > 0 ? Math.round((paid / total) * 100) : 0,
    },
    {
      name: 'Pending',
      key: 'pending' as const,
      value: pending,
      color: STATUS_CONFIG.pending.color,
      percent: total > 0 ? Math.round((pending / total) * 100) : 0,
    },
    {
      name: 'Failed',
      key: 'failed' as const,
      value: failed,
      color: STATUS_CONFIG.failed.color,
      percent: total > 0 ? Math.round((failed / total) * 100) : 0,
    },
  ];

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Payment Status
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {total} total orders
          </span>
        </div>

        {/* Donut Chart with Center Metric */}
        <div className="relative w-full h-52 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={(val: any, name: any, item: any) => [
                  `${val} orders (${item.payload.percent}%)`,
                  name,
                ]}
                contentStyle={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  borderRadius: '0.75rem',
                  border: 'none',
                  fontSize: '12px',
                }}
              />
              <Pie
                data={data}
                innerRadius={60}
                outerRadius={88}
                paddingAngle={4}
                dataKey="value"
                animationDuration={800}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centered Total KPI Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-2xl font-black text-slate-900 leading-tight">
              {paid}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Paid ({total > 0 ? Math.round((paid / total) * 100) : 0}%)
            </span>
          </div>
        </div>

        {/* Legend / Breakdown List */}
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
          {data.map((item) => {
            const config = STATUS_CONFIG[item.key];
            const Icon = config.icon;
            return (
              <div
                key={item.key}
                className="flex items-center justify-between text-xs py-1"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <span>{config.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{item.value} orders</span>
                  <span className="text-slate-400">({item.percent}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paystack settlement note */}
      <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Settled directly via Paystack</span>
        <span className="font-bold text-emerald-600">98% payout rate</span>
      </div>
    </div>
  );
}
