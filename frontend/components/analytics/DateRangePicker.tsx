'use client';

import React, { useState } from 'react';
import { Calendar, RefreshCw, Clock } from 'lucide-react';
import { DateRangeKey, DateRangeOption } from './types';

interface DateRangePickerProps {
  selectedRange: DateRangeKey;
  onRangeChange: (range: DateRangeKey) => void;
  customFrom?: string;
  customTo?: string;
  onCustomDatesChange?: (from: string, to: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdatedText?: string;
}

const RANGE_OPTIONS: DateRangeOption[] = [
  { key: '7days', label: 'Last 7 Days' },
  { key: '30days', label: 'Last 30 Days' },
  { key: 'this_month', label: 'This Month' },
  { key: 'all_time', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
];

export default function DateRangePicker({
  selectedRange,
  onRangeChange,
  customFrom = '',
  customTo = '',
  onCustomDatesChange,
  onRefresh,
  isRefreshing = false,
  lastUpdatedText = 'Last updated: 2 minutes ago',
}: DateRangePickerProps) {
  const [localFrom, setLocalFrom] = useState(customFrom);
  const [localTo, setLocalTo] = useState(customTo);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (onCustomDatesChange && localFrom && localTo) {
      onCustomDatesChange(localFrom, localTo);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs">
      {/* Date Range Options */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
        {RANGE_OPTIONS.map((opt) => {
          const isActive = selectedRange === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onRangeChange(opt.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
                isActive
                  ? 'bg-white text-emerald-700 shadow-xs font-bold border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Auto-update message & Refresh button */}
      <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5" title="Analytics auto-refreshes periodically">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{lastUpdatedText}</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-emerald-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition disabled:opacity-50"
          aria-label="Refresh analytics data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Custom Date Range Popover/Inputs */}
      {selectedRange === 'custom' && (
        <form
          onSubmit={handleApplyCustom}
          className="w-full sm:w-auto flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100"
        >
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              aria-label="Start Date"
              value={localFrom}
              onChange={(e) => setLocalFrom(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              aria-label="End Date"
              value={localTo}
              onChange={(e) => setLocalTo(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
          >
            Apply
          </button>
        </form>
      )}
    </div>
  );
}
