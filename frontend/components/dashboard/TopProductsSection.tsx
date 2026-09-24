'use client';

import React from 'react';
import Link from 'next/link';
import { Package, ArrowRight, TrendingUp, Sparkles } from 'lucide-react';
import { formatNaira } from '../../lib/utils';

export interface TopProduct {
  id: string;
  name: string;
  category: string;
  ordersCount: number;
  revenue: number;
  stock: number;
  emoji?: string;
}

interface TopProductsSectionProps {
  products?: TopProduct[];
  isLoading?: boolean;
}

export default function TopProductsSection({
  products = [],
  isLoading = false,
}: TopProductsSectionProps) {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Best-Selling Products</h2>
              <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                Top 3
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Highest revenue items generating conversions in WhatsApp chats
            </p>
          </div>

          <Link
            href="/products"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition shrink-0"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Content */}
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-12 h-12 bg-slate-200 rounded-xl shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-10 px-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No products uploaded yet</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                Upload your products or CSV catalog to allow your WhatsApp bot to start selling.
              </p>
              <Link
                href="/products"
                className="mt-3 inline-block bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Upload First Product
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {products.slice(0, 3).map((prod, index) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/20 transition-all duration-150"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/70 flex items-center justify-center text-2xl shrink-0">
                      <span>{prod.emoji || '📦'}</span>
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{prod.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {prod.ordersCount} orders •{' '}
                        <span className="text-emerald-700 font-semibold">{prod.stock} in stock</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-3">
                    <span className="text-xs font-extrabold text-slate-900 block">
                      {formatNaira(prod.revenue)}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Earned
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Catalog Insights Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Synced with WhatsApp Catalog</span>
        </span>
        <span className="font-semibold text-slate-700">Updated Real-Time</span>
      </div>
    </div>
  );
}
