'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  Share2,
} from 'lucide-react';

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  actionText?: string;
  actionHref?: string;
  actionFn?: () => void;
}

interface GettingStartedChecklistProps {
  onDismiss?: () => void;
  onShareClick?: () => void;
  hasOrders?: boolean;
  hasProducts?: boolean;
}

const CHECKLIST_STORAGE_KEY = 'shoppal_dashboard_checklist_dismissed';

export default function GettingStartedChecklist({
  onDismiss,
  onShareClick,
  hasOrders = false,
  hasProducts = true,
}: GettingStartedChecklistProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sharedOnWhatsapp, setSharedOnWhatsapp] = useState(false);

  // Check dismissal on mount
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (dismissed === 'true') {
        setTimeout(() => setIsDismissed(true), 0);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, 'true');
    } catch {
      // Ignore
    }
    if (onDismiss) onDismiss();
  };

  const handleShareStep = () => {
    setSharedOnWhatsapp(true);
    if (onShareClick) onShareClick();
  };

  const steps: ChecklistStep[] = [
    {
      id: 'signup',
      title: 'Sign up complete',
      description: 'Your merchant profile and WhatsApp bot sandbox are activated',
      completed: true,
    },
    {
      id: 'products',
      title: 'Products uploaded',
      description: 'Items added so your bot can take orders immediately',
      completed: hasProducts,
      actionText: hasProducts ? undefined : 'Upload Catalog',
      actionHref: '/products',
    },
    {
      id: 'share',
      title: 'Share shop on WhatsApp',
      description: 'Post your bot link to your WhatsApp status or groups',
      completed: sharedOnWhatsapp,
      actionText: sharedOnWhatsapp ? undefined : 'Share Link Now',
      actionFn: handleShareStep,
    },
    {
      id: 'order',
      title: 'First order received',
      description: 'Receive your very first automated customer checkout',
      completed: hasOrders,
      actionText: hasOrders ? undefined : 'View Orders',
      actionHref: '/orders',
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  if (isDismissed) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Getting Started Checklist</h3>
              <span className="text-[11px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                {progressPercent}% Complete
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Follow these simple steps to start receiving continuous sales on WhatsApp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
            aria-label={isCollapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
            aria-label="Dismiss onboarding checklist"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white/10 rounded-full h-2 mt-4 overflow-hidden">
        <div
          className="bg-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Checklist items (collapsible) */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-2">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={`p-3.5 rounded-xl border transition-all ${
                step.completed
                  ? 'bg-white/5 border-emerald-500/30 text-slate-200'
                  : 'bg-white/10 border-white/10 text-white'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {step.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <h4
                    className={`text-xs font-bold leading-tight ${
                      step.completed ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {step.title}
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">
                    {step.description}
                  </p>

                  {/* Step Action Button */}
                  {step.actionText && !step.completed && (
                    <div className="mt-2.5">
                      {step.actionHref ? (
                        <Link
                          href={step.actionHref}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-emerald-200 underline"
                        >
                          <span>{step.actionText}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      ) : step.actionFn ? (
                        <button
                          type="button"
                          onClick={step.actionFn}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-emerald-200 underline"
                        >
                          <span>{step.actionText}</span>
                          <Share2 className="w-3 h-3" />
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
