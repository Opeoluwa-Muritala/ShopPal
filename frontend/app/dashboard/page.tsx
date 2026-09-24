import React, { useState, useEffect } from 'react';
import DashboardHome from '../../components/dashboard/DashboardHome';

import Link from 'next/link';
import { formatNaira } from '../../lib/utils';
import { ordersApi, productsApi } from '../../lib/api';
import { getCurrentSession, UserSession } from '../../lib/auth';

export default function DashboardPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(getCurrentSession());

    const handleAuthChange = () => {
      setSession(getCurrentSession());
    };

    window.addEventListener('shoppal-auth-changed', handleAuthChange);
    return () => window.removeEventListener('shoppal-auth-changed', handleAuthChange);
  }, []);

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true);
      try {
        const [ordersRes, productsRes] = await Promise.allSettled([
          ordersApi.list(),
          productsApi.list(),
        ]);

        if (ordersRes.status === 'fulfilled' && ordersRes.value.data?.orders) {
          setOrders(ordersRes.value.data.orders);
        }
        if (productsRes.status === 'fulfilled' && productsRes.value.data?.products) {
          setProducts(productsRes.value.data.products);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const totalSales = orders.reduce((sum, o) => {
    const isPaid = (o.payment_status || '').toLowerCase() === 'paid';
    const amount = typeof o.total === 'string' ? parseFloat(o.total) || 0 : Number(o.total) || 0;
    return isPaid ? sum + amount : sum;
  }, 0);

  const totalOrdersCount = orders.length;
  const completedOrdersCount = orders.filter(
    (o) => (o.status || '').toLowerCase() === 'delivered' || (o.status || '').toLowerCase() === 'completed'
  ).length;
  const pendingOrdersCount = orders.filter(
    (o) => (o.status || '').toLowerCase() === 'new' || (o.status || '').toLowerCase() === 'processing'
  ).length;
  const totalCatalogStock = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);

  const vendorDisplayName = session?.name || session?.businessName || 'Vendor';
  const businessDisplayName = session?.businessName || 'ShopPal Store';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vendor Dashboard</h1>
            <span className="text-xs bg-slate-100 text-slate-800 font-medium px-2.5 py-0.5 rounded border border-slate-200">
              {businessDisplayName}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Welcome, <strong>{vendorDisplayName}</strong>. WhatsApp automated sales and catalog management.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/products"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm transition"
          >
            Add Product
          </Link>
          <Link
            href="/orders"
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-medium rounded transition"
          >
            Manage Orders
          </Link>
        </div>
      </div>

      {/* 3 Minimalist KPI Metric Cards for the project */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Sales */}
        <div className="bg-white border border-emerald-200 bg-emerald-50/10 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 uppercase tracking-wider">
            <span>Total Sales</span>
            <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 text-[11px] font-bold">
              Paystack
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 my-2">
            {formatNaira(totalSales)}
          </div>
          <div className="text-xs text-slate-500">
            Verified payouts from completed customer orders
          </div>
        </div>

        {/* Active Orders */}
        <div className="bg-white border border-blue-200 bg-blue-50/10 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-800 uppercase tracking-wider">
            <span>Orders</span>
            <span className="text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full text-xs font-bold">{totalOrdersCount} Total</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 my-2">
            {totalOrdersCount}
          </div>
          <div className="text-xs text-slate-500">
            {completedOrdersCount} completed • {pendingOrdersCount} pending
          </div>
        </div>

        {/* Catalog Items */}
        <div className="bg-white border border-purple-200 bg-purple-50/10 rounded-xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-800 uppercase tracking-wider">
            <span>Catalog Items</span>
            <span className="text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full text-xs font-bold">{products.length} Products</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 my-2">
            {products.length}
          </div>
          <div className="text-xs text-slate-500">
            {totalCatalogStock} total units in stock
          </div>
        </div>
      </div>


      {/* Main Content: Recent Orders & Catalog Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Recent Orders
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Orders received via WhatsApp storefront
              </p>
            </div>
            <Link
              href="/orders"
              className="text-xs font-semibold text-slate-900 hover:underline"
            >
              View all orders
            </Link>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No orders recorded yet. When customers order on WhatsApp, they will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-2 px-3">Order ID</th>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3">Amount</th>
                    <th className="py-2 px-3">Payment</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.slice(0, 6).map((order) => {
                    const amount =
                      typeof order.total === 'string'
                        ? parseFloat(order.total) || 0
                        : Number(order.total) || 0;
                    const isPaid = (order.payment_status || '').toLowerCase() === 'paid';

                    return (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                          {order.order_code || (order.id ? order.id.slice(0, 8) : 'ORD-NEW')}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {order.customer_phone || 'Customer'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {formatNaira(amount)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {(order.payment_status || 'PENDING').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 capitalize">
                          {order.status || 'new'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Catalog Preview (1 col) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Products
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Active in WhatsApp bot
              </p>
            </div>
            <Link
              href="/products"
              className="text-xs font-semibold text-slate-900 hover:underline"
            >
              Manage
            </Link>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No products found in catalog.
            </div>
          ) : (
            <div className="space-y-3">
              {products.slice(0, 5).map((product) => {
                const price =
                  typeof product.price === 'string'
                    ? parseFloat(product.price) || 0
                    : Number(product.price) || 0;

                return (
                  <div
                    key={product.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs"
                  >
                    <div className="truncate pr-2">
                      <span className="font-semibold text-slate-900 block truncate">
                        {product.name}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        {product.stock} units available
                      </span>
                    </div>
                    <span className="font-bold text-slate-900 whitespace-nowrap">
                      {formatNaira(price)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
