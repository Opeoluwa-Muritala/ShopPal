'use client';

import React, { useState } from 'react';
import {
  Bell,
  Mail,
  Smartphone,
  PackageX,
  MessageCircle,
  Megaphone,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { NotificationSettingsData } from './types';

export interface NotificationsSettingsProps {
  notifications: NotificationSettingsData;
  accountEmail: string;
  onSaveNotifications: (updated: NotificationSettingsData) => Promise<boolean | void> | boolean | void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export default function NotificationsSettings({
  notifications,
  accountEmail,
  onSaveNotifications,
  onShowToast,
  onDirtyChange,
}: NotificationsSettingsProps) {
  const [formData, setFormData] = useState<NotificationSettingsData>(notifications);
  const [isSaving, setIsSaving] = useState(false);

  const updateField = <K extends keyof NotificationSettingsData>(
    field: K,
    val: NotificationSettingsData[K]
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: val };
      if (onDirtyChange) {
        onDirtyChange(JSON.stringify(next) !== JSON.stringify(notifications));
      }
      return next;
    });
  };

  const handleSaveAll = async () => {
    try {
      setIsSaving(true);
      await onSaveNotifications(formData);
      if (onDirtyChange) {
        onDirtyChange(false);
      }
      onShowToast('✅ Notification settings saved!');
    } catch {
      onShowToast('Failed to save notifications', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Section: Order Notifications */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Order Notifications</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Get immediate alerts when customers place new orders or inventory runs low.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 mt-4">
          {/* Email on new order */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-500" />
                Email on new order
              </span>
              <p className="text-xs text-slate-500">
                Email address: <span className="font-semibold text-slate-700">{accountEmail}</span>{' '}
                <span className="text-slate-400">(read-only, tied to account)</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('emailOnOrder', !formData.emailOnOrder)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                formData.emailOnOrder ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={formData.emailOnOrder}
              aria-label="Toggle Email on new order"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.emailOnOrder ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Push notification on new order */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-slate-500" />
                Push notification on new order
              </span>
              <p className="text-xs text-slate-500">
                Instant browser notification when an incoming order is confirmed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('pushOnOrder', !formData.pushOnOrder)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                formData.pushOnOrder ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={formData.pushOnOrder}
              aria-label="Toggle Push notification on new order"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.pushOnOrder ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Low stock alert */}
          <div className="py-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PackageX className="w-4 h-4 text-slate-500" />
                  Low stock alert
                </span>
                <p className="text-xs text-slate-500">
                  Receive an early warning before products go out of stock on WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateField('lowStockAlert', !formData.lowStockAlert)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                  formData.lowStockAlert ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={formData.lowStockAlert}
                aria-label="Toggle Low stock alert"
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.lowStockAlert ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {formData.lowStockAlert && (
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="low-stock-threshold"
                    className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5"
                  >
                    Alert when stock falls below:
                  </label>
                  <input
                    id="low-stock-threshold"
                    type="number"
                    min={1}
                    max={100}
                    value={formData.lowStockThreshold}
                    onChange={(e) =>
                      updateField('lowStockThreshold', Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-full text-sm font-mono border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="low-stock-frequency"
                    className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5"
                  >
                    Frequency:
                  </label>
                  <select
                    id="low-stock-frequency"
                    value={formData.lowStockFrequency}
                    onChange={(e) =>
                      updateField('lowStockFrequency', e.target.value as any)
                    }
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                  >
                    <option value="Immediate">Immediate</option>
                    <option value="Daily">Daily Summary</option>
                    <option value="Weekly">Weekly Digest</option>
                  </select>
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                    Channels:
                  </span>
                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-700 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.lowStockChannels.email}
                        onChange={(e) =>
                          updateField('lowStockChannels', {
                            ...formData.lowStockChannels,
                            email: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Email</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.lowStockChannels.push}
                        onChange={(e) =>
                          updateField('lowStockChannels', {
                            ...formData.lowStockChannels,
                            push: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Push</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Chat Notifications */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Chat Notifications</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              WhatsApp customer inquiry alerts and live chat escalations.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 mt-4">
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-900">
                Message from customer
              </span>
              <p className="text-xs text-slate-500">
                Notify when a customer asks a question that requires merchant intervention.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('chatCustomerMessage', !formData.chatCustomerMessage)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                formData.chatCustomerMessage ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={formData.chatCustomerMessage}
              aria-label="Toggle Message from customer"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.chatCustomerMessage ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-900">
                Order update notification
              </span>
              <p className="text-xs text-slate-500">
                Notify when payment is received or delivery address is confirmed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('chatOrderUpdate', !formData.chatOrderUpdate)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                formData.chatOrderUpdate ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={formData.chatOrderUpdate}
              aria-label="Toggle Order update notification"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.chatOrderUpdate ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Section: Marketing (Optional) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Marketing & Growth Tips</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Actionable insights on retail best-sellers and new Naija Marketplace features.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 mt-4">
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-900">
                Product recommendations
              </span>
              <p className="text-xs text-slate-500">
                We&apos;ll send you tips on best-sellers &amp; trending products in your category.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('marketingRecommendations', !formData.marketingRecommendations)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                formData.marketingRecommendations ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={formData.marketingRecommendations}
              aria-label="Toggle Product recommendations"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.marketingRecommendations ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-900">
                Promotional emails
              </span>
              <p className="text-xs text-slate-500">
                Updates on new features, seller webinars, and special promotional offers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('marketingPromoEmails', !formData.marketingPromoEmails)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                formData.marketingPromoEmails ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={formData.marketingPromoEmails}
              aria-label="Toggle Promotional emails"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.marketingPromoEmails ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Save All Notifications button */}
      <div className="flex items-center justify-end pt-2">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving}
          className="inline-flex items-center gap-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-xl shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>Save All Notifications</span>
        </button>
      </div>
    </div>
  );
}
