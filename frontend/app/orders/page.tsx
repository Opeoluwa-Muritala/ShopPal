'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Phone,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Filter,
  DollarSign,
  PackageCheck,
  XCircle,
} from 'lucide-react';
import { ordersApi } from '../../lib/api';
import { formatNaira } from '../../lib/utils';

export type OrderStatus = 'new' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'paid' | 'pending' | 'failed';

export interface OrderItemRecord {
  id: string;
  order_code: string;
  customer_phone: string;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  items: Array<{
    name: string;
    quantity: number;
    unit_price?: number;
  }>;
  created_at?: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItemRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const res = await ordersApi.list();
      if (res.data && Array.isArray(res.data.orders)) {
        const mapped: OrderItemRecord[] = res.data.orders.map((o) => ({
          id: o.id,
          order_code: o.order_code || `ORD-${o.id.slice(0, 4).toUpperCase()}`,
          customer_phone: o.customer_phone,
          total: typeof o.total === 'string' ? parseFloat(o.total) || 0 : Number(o.total) || 0,
          status: (o.status as OrderStatus) || 'new',
          payment_status: (o.payment_status as PaymentStatus) || 'paid',
          items: Array.isArray(o.items) ? o.items : [{ name: 'WhatsApp Cart Order', quantity: 1 }],
          created_at: 'Just now',
        }));
        setOrders(mapped);
        setIsBackendConnected(true);
      } else {
        setOrders([]);
        setIsBackendConnected(Boolean(res.data));
      }
    } catch {
      setOrders([]);
      setIsBackendConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Update order status handler
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    const prevOrders = [...orders];
    // Optimistic local update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    try {
      const res = await ordersApi.updateStatus(orderId, newStatus);
      if (res.data?.updated || res.status === 200) {
        showNotification(`✅ Order status updated to "${newStatus}"!`);
      } else {
        setOrders(prevOrders);
        showNotification(res.error || 'Failed to update order status', 'error');
      }
    } catch (err: any) {
      setOrders(prevOrders);
      showNotification(err?.message || 'Network error updating order status', 'error');
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        o.order_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customer_phone.includes(searchTerm) ||
        o.items.some((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter !== 'all' && o.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [orders, searchTerm, statusFilter]);

  // KPIs
  const totalRevenue = useMemo(
    () => orders.filter((o) => o.payment_status === 'paid').reduce((acc, o) => acc + o.total, 0),
    [orders]
  );
  const pendingFulfillmentCount = useMemo(
    () => orders.filter((o) => o.status === 'new' || o.status === 'processing').length,
    [orders]
  );
  const deliveredCount = useMemo(
    () => orders.filter((o) => o.status === 'delivered').length,
    [orders]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-800'
              : 'bg-rose-900 text-white border-rose-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Orders
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isBackendConnected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isBackendConnected ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              {isBackendConnected ? 'Live API (v0.6.0)' : 'Orders (Offline / Empty)'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time incoming customer orders placed through AI WhatsApp chat and verified via Paystack.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadOrders}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition shadow-xs"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>Refresh</span>
          </button>
          <Link
            href="/dashboard/analytics"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-sm"
          >
            <span>View Analytics</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Total Orders</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-slate-900">{orders.length}</span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">WhatsApp customer chats</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Settled Revenue</span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg sm:text-xl font-black text-slate-900">
              {formatNaira(totalRevenue)}
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Verified by Paystack</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Awaiting Dispatch</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-amber-600">
              {pendingFulfillmentCount}
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">New or packaging</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Delivered</span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-emerald-700">{deliveredCount}</span>
            <PackageCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Fulfilled successfully</span>
        </div>
      </div>

      {/* Search & Status Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-xs">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by Order ID, phone number (+234...), or item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'new', label: 'New' },
              { id: 'processing', label: 'Processing' },
              { id: 'shipped', label: 'Shipped' },
              { id: 'delivered', label: 'Delivered' },
              { id: 'cancelled', label: 'Cancelled' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer Phone</th>
                <th className="py-3 px-4">Items Ordered</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status &amp; Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No customer orders found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Orders placed via WhatsApp chat will automatically display here.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isPaid = order.payment_status === 'paid';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition">
                      {/* Order Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {order.order_code}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{order.customer_phone}</span>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 max-w-xs">
                          {order.items.map((item, idx) => (
                            <p key={idx} className="text-xs text-slate-700 truncate">
                              <strong>{item.quantity}x</strong> {item.name}
                            </p>
                          ))}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {formatNaira(order.total)}
                      </td>

                      {/* Payment */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isPaid ? 'bg-emerald-600' : 'bg-amber-500'
                            }`}
                          />
                          {order.payment_status.toUpperCase()}
                        </span>
                      </td>

                      {/* Status Selector (`PATCH /api/orders/{order_id}`) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={order.status}
                            onChange={(e) =>
                              handleUpdateStatus(order.id, e.target.value as OrderStatus)
                            }
                            className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${
                              order.status === 'delivered'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : order.status === 'shipped'
                                ? 'bg-sky-50 text-sky-800 border-sky-300'
                                : order.status === 'processing'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : order.status === 'cancelled'
                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                : 'bg-slate-50 text-slate-800 border-slate-300'
                            }`}
                          >
                            <option value="new">New</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
