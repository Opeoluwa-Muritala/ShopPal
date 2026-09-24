'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LucideIcon, ArrowUpRight, HelpCircle, Info } from 'lucide-react';

export interface StatsCardProps {
  title: string;
  subtitle?: string;
  value: string;
  period?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  href?: string;
  tooltip?: string;
  testId?: string;
}

export default function StatsCard({
  title,
  subtitle,
  value,
  period = 'This Week',
  trend,
  trendDirection = 'up',
  icon: Icon,
  iconBgColor = 'bg-emerald-50',
  iconColor = 'text-emerald-600',
  href,
  tooltip,
  testId,
}: StatsCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const content = (
    <div
      data-testid={testId}
      className="relative bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full group"
    >
      {/* Top Header: Title + Period + Icon */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block truncate">
              {title}
            </span>
            {tooltip && (
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowTooltip((v) => !v);
                  }}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="text-slate-400 hover:text-slate-600 focus:outline-hidden"
                  aria-label="More information"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                {showTooltip && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-900 text-white text-[11px] rounded-lg shadow-lg z-50 pointer-events-none text-center">
                    {tooltip}
                  </div>
                )}
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className={`w-10 h-10 rounded-xl ${iconBgColor} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="mt-3">
        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {value}
        </div>
        <div className="text-[11px] font-semibold text-slate-400 mt-0.5">{period}</div>
      </div>

      {/* Trend Indicator & Link Hint */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        {trend ? (
          <div
            className={`flex items-center gap-1 font-bold ${
              trendDirection === 'up'
                ? 'text-emerald-700'
                : trendDirection === 'down'
                ? 'text-rose-600'
                : 'text-slate-600'
            }`}
          >
            {trendDirection === 'up' && <span>↑</span>}
            {trendDirection === 'down' && <span>↓</span>}
            <span>{trend}</span>
          </div>
        ) : (
          <span className="text-slate-400 text-[11px]">Consistent performance</span>
        )}

        {href && (
          <span className="text-slate-400 group-hover:text-emerald-600 transition flex items-center gap-0.5 text-[11px] font-semibold">
            <span>View</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full focus:outline-hidden focus:ring-2 focus:ring-emerald-500 rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
}
