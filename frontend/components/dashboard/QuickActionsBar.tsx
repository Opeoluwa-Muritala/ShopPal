'use client';

import React from 'react';
import Link from 'next/link';
import {
  Plus,
  MessageSquare,
  Share2,
  Megaphone,
  ExternalLink,
  Check,
} from 'lucide-react';

interface QuickActionsBarProps {
  onShareShop?: () => void;
  onOpenBroadcast?: () => void;
  botLink?: string;
  isCopied?: boolean;
}

export default function QuickActionsBar({
  onShareShop,
  onOpenBroadcast,
  botLink = 'https://wa.me/2348120007890?text=Hi%2C%20I%20want%20to%20buy',
  isCopied = false,
}: QuickActionsBarProps) {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
          <p className="text-xs text-slate-500">Fast shortcuts to manage your shop and grow sales</p>
        </div>
        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 self-start sm:self-center">
          Instant WhatsApp Sync
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Action 1: Add Product */}
        <Link
          href="/products"
          className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
            <Plus className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-emerald-700">
              Add Product
            </span>
            <span className="text-[11px] text-slate-400 block truncate">Single or CSV batch</span>
          </div>
        </Link>

        {/* Action 2: View Bot */}
        <a
          href={botLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-emerald-700 flex items-center gap-1">
              <span>View Bot</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </span>
            <span className="text-[11px] text-slate-400 block truncate">Test in WhatsApp</span>
          </div>
        </a>

        {/* Action 3: Share Shop Link */}
        <button
          type="button"
          onClick={onShareShop}
          className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            {isCopied ? <Check className="w-5 h-5 text-emerald-600" /> : <Share2 className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-emerald-700">
              {isCopied ? 'Link Copied!' : 'Share Shop Link'}
            </span>
            <span className="text-[11px] text-slate-400 block truncate">
              {isCopied ? 'Ready to paste' : 'Copy store URL'}
            </span>
          </div>
        </button>

        {/* Action 4: Customer Broadcast */}
        <button
          type="button"
          onClick={onOpenBroadcast}
          className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-emerald-700">
              Customer Broadcast
            </span>
            <span className="text-[11px] text-slate-400 block truncate">Send announcement</span>
          </div>
        </button>
      </div>
    </div>
  );
}
