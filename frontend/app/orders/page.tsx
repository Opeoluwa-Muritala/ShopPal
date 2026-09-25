'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ordersApi } from '../../lib/api';
import { formatNaira } from '../../lib/utils';

export type OrderStatus = 'pending' | 'new' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
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
  created_at?: string | null;
  is_cart?: boolean;
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
          created_at: o.created_at,
          is_cart: Boolean(o.is_cart),
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

  const handleUpdateStatus = async (
    orderId: string,
    newStatus: Exclude<OrderStatus, 'pending'>
  ) => {
    const prevOrders = [...orders];
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    try {
      const res = await ordersApi.updateStatus(orderId, newStatus);
      if (res.data?.updated || res.status === 200) {
        showNotification(`Order status updated to "${newStatus}".`);
      } else {
        setOrders(prevOrders);
        showNotification(res.error || 'Failed to update order status', 'error');
      }
    } catch (err: any) {
      setOrders(prevOrders);
      showNotification(err?.message || 'Network error updating order status', 'error');
    }
  };

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

  const totalRevenue = useMemo(
    () => orders.filter((o) => o.payment_status === 'paid').reduce((acc, o) => acc + o.total, 0),
    [orders]
  );
  const pendingFulfillmentCount = useMemo(
    () => orders.filter((o) => o.status === 'pending' || o.status === 'new' || o.status === 'processing').length,
    [orders]
  );
  const deliveredCount = useMemo(
    () => orders.filter((o) => o.status === 'delivered').length,
    [orders]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 p-4 rounded border text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-red-900 text-white border-red-800'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Orders
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-semibold border ${
                isBackendConnected
                  ? 'bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {isBackendConnected ? 'Backend Connected' : 'Orders Ready'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Customer orders placed through WhatsApp chat and verified via Paystack.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={loadOrders}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded transition"
          >
            Refresh Orders
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500 block mb-1">Total Orders</span>
          <span className="text-2xl font-bold text-slate-900">{orders.length}</span>
          <span className="text-[11px] text-slate-400 mt-1 block">WhatsApp customer chats</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500 block mb-1">Settled Revenue</span>
          <span className="text-xl font-bold text-slate-900">{formatNaira(totalRevenue)}</span>
          <span className="text-[11px] text-slate-400 mt-1 block">Verified by Paystack</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500 block mb-1">Pending Fulfillment</span>
          <span className="text-2xl font-bold text-slate-900">{pendingFulfillmentCount}</span>
          <span className="text-[11px] text-slate-400 mt-1 block">New or packaging</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500 block mb-1">Delivered</span>
          <span className="text-2xl font-bold text-slate-900">{deliveredCount}</span>
          <span className="text-[11px] text-slate-400 mt-1 block">Fulfilled successfully</span>
        </div>
      </div>

      {/* Search & Status Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-lg">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by Order ID, phone number, or item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending' },
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
              className={`px-3 py-1.5 rounded text-xs font-medium transition shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer Phone</th>
                <th className="py-3 px-4">Items Ordered</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status &amp; Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    <p className="font-semibold text-slate-800">No customer orders found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Orders placed via WhatsApp chat will automatically display here.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isPaid = order.payment_status === 'paid';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50">
                      {/* Order Code */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {order.order_code}
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {order.customer_phone}
                      </td>

                      {/* Items */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5 max-w-xs">
                          {order.items.map((item, idx) => (
                            <p key={idx} className="text-slate-700 truncate">
                              <strong>{item.quantity}x</strong> {item.name}
                            </p>
                          ))}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {formatNaira(order.total)}
                      </td>

                      {/* Payment */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {order.payment_status.toUpperCase()}
                        </span>
                      </td>

                      {/* Status Selector */}
                      <td className="py-3 px-4">
                        {order.is_cart ? (
                          <span className="inline-flex px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                            Pending cart
                          </span>
                        ) : (
                          <select
                            value={order.status}
                            onChange={(e) =>
                              handleUpdateStatus(
                                order.id,
                                e.target.value as Exclude<OrderStatus, 'pending'>
                              )
                            }
                            className="text-xs font-medium rounded px-2 py-1 bg-white border border-slate-300 focus:outline-none focus:border-slate-900 cursor-pointer"
                          >
                            <option value="new">New</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}
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
