'use client';

import React, { useState } from 'react';
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
      onShowToast('Notification settings saved');
    } catch {
      onShowToast('Failed to save notifications', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section: Order Notifications */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Order Notifications</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Receive alerts when customers place new orders or inventory runs low.
          </p>
        </div>

        <div className="divide-y divide-slate-100 mt-4">
          {/* Email on new order */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">
                Email on new order
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Notifications sent to: <span className="font-medium text-slate-800">{accountEmail}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('emailOnOrder', !formData.emailOnOrder)}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                formData.emailOnOrder ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              role="switch"
              aria-checked={formData.emailOnOrder}
              aria-label="Toggle Email on new order"
            >
              {formData.emailOnOrder ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Push notification on new order */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">
                Push notification on new order
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Instant browser notification when an incoming order is confirmed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('pushOnOrder', !formData.pushOnOrder)}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                formData.pushOnOrder ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              role="switch"
              aria-checked={formData.pushOnOrder}
              aria-label="Toggle Push notification on new order"
            >
              {formData.pushOnOrder ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Low stock alert */}
          <div className="py-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-sm font-semibold text-slate-900 block">
                  Low stock alert
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Receive an early warning before products go out of stock on WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateField('lowStockAlert', !formData.lowStockAlert)}
                className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                  formData.lowStockAlert ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
                role="switch"
                aria-checked={formData.lowStockAlert}
                aria-label="Toggle Low stock alert"
              >
                {formData.lowStockAlert ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {formData.lowStockAlert && (
              <div className="bg-slate-50 border border-slate-200 rounded p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="low-stock-threshold"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-1"
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
                    className="w-full text-sm font-mono border border-slate-300 rounded p-2 bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="low-stock-frequency"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-1"
                  >
                    Frequency:
                  </label>
                  <select
                    id="low-stock-frequency"
                    value={formData.lowStockFrequency}
                    onChange={(e) =>
                      updateField('lowStockFrequency', e.target.value as any)
                    }
                    className="w-full text-sm border border-slate-300 rounded p-2 bg-white text-slate-900"
                  >
                    <option value="Immediate">Immediate</option>
                    <option value="Daily">Daily Summary</option>
                    <option value="Weekly">Weekly Digest</option>
                  </select>
                </div>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 block mb-1">
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
                        className="rounded border-slate-300 text-slate-900 focus:ring-0"
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
                        className="rounded border-slate-300 text-slate-900 focus:ring-0"
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
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Chat Notifications</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            WhatsApp customer inquiry alerts and live chat escalations.
          </p>
        </div>

        <div className="divide-y divide-slate-100 mt-4">
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">
                Message from customer
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Notify when a customer asks a question that requires merchant intervention.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('chatCustomerMessage', !formData.chatCustomerMessage)}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                formData.chatCustomerMessage ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              role="switch"
              aria-checked={formData.chatCustomerMessage}
              aria-label="Toggle Message from customer"
            >
              {formData.chatCustomerMessage ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">
                Order update notification
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Notify when payment is received or delivery address is confirmed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('chatOrderUpdate', !formData.chatOrderUpdate)}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                formData.chatOrderUpdate ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              role="switch"
              aria-checked={formData.chatOrderUpdate}
              aria-label="Toggle Order update notification"
            >
              {formData.chatOrderUpdate ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>

      {/* Section: Marketing */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Marketing & Growth Tips</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Actionable insights on retail best-sellers and new ShopPal features.
          </p>
        </div>

        <div className="divide-y divide-slate-100 mt-4">
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">
                Product recommendations
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Tips on best-sellers and trending items in your category.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('marketingRecommendations', !formData.marketingRecommendations)}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                formData.marketingRecommendations ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              role="switch"
              aria-checked={formData.marketingRecommendations}
              aria-label="Toggle Product recommendations"
            >
              {formData.marketingRecommendations ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-slate-900 block">
                Promotional emails
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Updates on new features and special promotional offers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateField('marketingPromoEmails', !formData.marketingPromoEmails)}
              className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                formData.marketingPromoEmails ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              role="switch"
              aria-checked={formData.marketingPromoEmails}
              aria-label="Toggle Promotional emails"
            >
              {formData.marketingPromoEmails ? 'Enabled' : 'Disabled'}
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
          className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-6 py-2.5 rounded transition disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save All Notifications'}
        </button>
      </div>
    </div>
  );
}
