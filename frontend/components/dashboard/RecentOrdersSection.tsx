'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  ExternalLink,
  MessageCircle,
  Clock,
  ArrowRight,
  Package,
} from 'lucide-react';
import { formatNaira } from '../../lib/utils';

export type OrderStatus = 'New' | 'Processing' | 'Paid' | 'Shipped' | 'Delivered';

export interface DashboardOrder {
  id: string;
  customerPhone: string;
  items: string;
  total: number;
  status: OrderStatus;
  timestamp: string;
  paystackRef?: string;
}

interface RecentOrdersSectionProps {
  orders?: DashboardOrder[];
  isLoading?: boolean;
}

export default function RecentOrdersSection({
  orders = [],
  isLoading = false,
}: RecentOrdersSectionProps) {
  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'New':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            New
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            Processing
          </span>
        );
      case 'Paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Paid
          </span>
        );
      case 'Shipped':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            Shipped
          </span>
        );
      case 'Delivered':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">
            Delivered
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const cleanPhoneForWhatsApp = (phone: string) => {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '234' + clean.slice(1);
    }
    return clean;
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Recent Orders</h2>
            <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
              WhatsApp Sales
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            5 most recent customer orders automatically closed by your bot
          </p>
        </div>

        <Link
          href="/orders"
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition self-start sm:self-center"
        >
          <span>View All Orders</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Content */}
      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between p-3.5 bg-slate-50 rounded-xl">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
                <div className="h-6 bg-slate-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No orders received yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Share your store link on WhatsApp groups or Instagram to receive your very first order!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[580px]">
              <thead>
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Items</th>
                  <th className="py-2.5 px-3">Total</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3 text-right">Quick Chat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {orders.slice(0, 5).map((order) => {
                  const waUrl = `https://wa.me/${cleanPhoneForWhatsApp(
                    order.customerPhone
                  )}?text=${encodeURIComponent(
                    `Hello! Thank you for ordering from us on Naija Marketplace. Regarding your order ${order.id} (${order.items})...`
                  )}`;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {order.id}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700">
                        {order.customerPhone}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-[200px] truncate" title={order.items}>
                        {order.items}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {formatNaira(order.total)}
                      </td>
                      <td className="py-3 px-3">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                        {order.timestamp}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 transition"
                          title={`Chat with customer on WhatsApp (${order.customerPhone})`}
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Chat</span>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
