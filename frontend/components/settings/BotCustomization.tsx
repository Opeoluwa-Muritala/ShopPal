'use client';

import React, { useState } from 'react';
import {
  Bot,
  MessageSquare,
  Languages,
  Clock,
  Power,
  Pencil,
  Check,
  X,
  Loader2,
  CheckCheck,
  AlertTriangle,
} from 'lucide-react';
import { BotCustomizationData, OperatingHours } from './types';

export interface BotCustomizationProps {
  botData: BotCustomizationData;
  onUpdateGreeting: (greeting: string) => Promise<boolean | void> | boolean | void;
  onUpdateLanguage: (lang: string) => Promise<boolean | void> | boolean | void;
  onUpdateOperatingHours: (hours: OperatingHours) => Promise<boolean | void> | boolean | void;
  onUpdateBotStatus: (status: 'active' | 'paused') => Promise<boolean | void> | boolean | void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function BotCustomization({
  botData,
  onUpdateGreeting,
  onUpdateLanguage,
  onUpdateOperatingHours,
  onUpdateBotStatus,
  onShowToast,
}: BotCustomizationProps) {
  // Greeting state
  const [isEditingGreeting, setIsEditingGreeting] = useState(false);
  const [greetingText, setGreetingText] = useState(botData.greetingMessage);
  const [isSavingGreeting, setIsSavingGreeting] = useState(false);
  const [greetingError, setGreetingError] = useState<string | null>(null);

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState(botData.language);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);

  // Operating hours state
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(botData.operatingHours);
  const [isSavingHours, setIsSavingHours] = useState(false);

  // Bot status state
  const [botStatus, setBotStatus] = useState<'active' | 'paused'>(botData.status);
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const handleSaveGreeting = async () => {
    if (!greetingText.trim()) {
      setGreetingError('Greeting message cannot be empty');
      return;
    }
    if (greetingText.length > 200) {
      setGreetingError('Greeting message cannot exceed 200 characters');
      return;
    }
    setGreetingError(null);
    try {
      setIsSavingGreeting(true);
      await onUpdateGreeting(greetingText.trim());
      setIsEditingGreeting(false);
      onShowToast('✅ Bot greeting updated!');
    } catch {
      setGreetingError('Failed to save greeting message');
    } finally {
      setIsSavingGreeting(false);
    }
  };

  const handleSaveLanguage = async () => {
    try {
      setIsSavingLanguage(true);
      await onUpdateLanguage(selectedLanguage);
      onShowToast('✅ Bot language updated!');
    } catch {
      onShowToast('Failed to save bot language', 'error');
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const handleSaveOperatingHours = async () => {
    try {
      setIsSavingHours(true);
      await onUpdateOperatingHours(operatingHours);
      onShowToast('✅ Operating hours updated!');
    } catch {
      onShowToast('Failed to save operating hours', 'error');
    } finally {
      setIsSavingHours(false);
    }
  };

  const handleToggleBotStatus = async () => {
    const nextStatus = botStatus === 'active' ? 'paused' : 'active';
    try {
      setIsSavingStatus(true);
      await onUpdateBotStatus(nextStatus);
      setBotStatus(nextStatus);
      onShowToast('✅ Bot status updated!');
    } catch {
      onShowToast('Failed to update bot status', 'error');
    } finally {
      setIsSavingStatus(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Section: Bot Status */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                botStatus === 'active'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              <Power className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bot Status</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Turn your WhatsApp bot on or pause incoming automated customer responses.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  botStatus === 'active'
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-amber-500'
                }`}
              />
              <span className="text-xs sm:text-sm font-bold text-slate-800">
                {botStatus === 'active' ? 'Bot Active' : 'Bot Paused'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleBotStatus}
              disabled={isSavingStatus}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                botStatus === 'active' ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={botStatus === 'active'}
              aria-label="Toggle Bot Active"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  botStatus === 'active' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {botStatus === 'paused' && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200/90 rounded-xl flex items-center gap-3 text-xs sm:text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Note:</strong> Your bot is currently paused. Customers who message your WhatsApp number will see: <em>&quot;Shop is currently closed&quot;</em>.
            </span>
          </div>
        )}
      </div>

      {/* Section: Greeting Message */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Greeting Message</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                First response sent to every new shopper who initiates a WhatsApp conversation.
              </p>
            </div>
          </div>

          {!isEditingGreeting && (
            <button
              type="button"
              onClick={() => {
                setGreetingText(botData.greetingMessage);
                setIsEditingGreeting(true);
                setGreetingError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Greeting</span>
            </button>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {isEditingGreeting ? (
            <div className="border border-emerald-200 bg-emerald-50/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="bot-greeting-textarea"
                  className="text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Custom Greeting (Max 200 characters)
                </label>
                <span className="text-xs font-mono text-slate-500">
                  {greetingText.length}/200
                </span>
              </div>
              <textarea
                id="bot-greeting-textarea"
                rows={3}
                maxLength={200}
                value={greetingText}
                onChange={(e) => setGreetingText(e.target.value)}
                className="w-full text-sm text-slate-900 border border-slate-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition resize-none"
                placeholder="Hi! Welcome to Ilorin Fashion. What can I help you with? 😊"
              />
              {greetingError && (
                <p className="text-xs font-semibold text-red-600">{greetingError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingGreeting(false);
                    setGreetingText(botData.greetingMessage);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveGreeting}
                  disabled={isSavingGreeting}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSavingGreeting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Greeting</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                Current Active Greeting
              </span>
              <p className="text-sm font-medium text-slate-900 leading-relaxed">
                &quot;{botData.greetingMessage}&quot;
              </p>
            </div>
          )}

          {/* WhatsApp Preview Bubble */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-100/60">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
              Your customers will see:
            </span>
            <div className="max-w-md bg-[#DCF8C6] border border-emerald-200/60 rounded-2xl rounded-tl-sm p-3 shadow-xs space-y-1">
              <p className="text-xs sm:text-sm text-slate-900 font-sans leading-relaxed">
                {isEditingGreeting ? greetingText : botData.greetingMessage}
              </p>
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500">
                <span>12:00 PM</span>
                <CheckCheck className="w-3.5 h-3.5 text-sky-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Bot Language */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
            <Languages className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Bot Language</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Preferred default dialect for automated WhatsApp customer conversations.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4 max-w-lg">
          <div>
            <label
              htmlFor="bot-language-select"
              className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5"
            >
              Select Dialect
            </label>
            <select
              id="bot-language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            >
              <option value="English / Naija Pidgin Mix">English / Naija Pidgin Mix (Recommended)</option>
              <option value="English">English</option>
              <option value="Pidgin">Pidgin</option>
              <option value="Yoruba" disabled>
                Yoruba (Coming soon)
              </option>
              <option value="Hausa" disabled>
                Hausa (Coming soon)
              </option>
              <option value="Igbo" disabled>
                Igbo (Coming soon)
              </option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500">
              Current: <strong>{botData.language}</strong>
            </span>
            <button
              type="button"
              onClick={handleSaveLanguage}
              disabled={isSavingLanguage || selectedLanguage === botData.language}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {isSavingLanguage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Save Language</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section: Operating Hours */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Operating Hours</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Specify scheduled shop working hours. Outside these hours, an automated closed notice is dispatched.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm font-semibold text-slate-700">
              Enable operating hours
            </span>
            <button
              type="button"
              onClick={() =>
                setOperatingHours((prev) => ({ ...prev, enabled: !prev.enabled }))
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                operatingHours.enabled ? 'bg-amber-600' : 'bg-slate-300'
              }`}
              role="switch"
              aria-checked={operatingHours.enabled}
              aria-label="Enable operating hours"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  operatingHours.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {operatingHours.enabled && (
          <div className="mt-6 space-y-4 border border-amber-200 bg-amber-50/20 rounded-xl p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Mon - Fri */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                  Monday – Friday
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={operatingHours.monFri.from}
                    onChange={(e) =>
                      setOperatingHours((prev) => ({
                        ...prev,
                        monFri: { ...prev.monFri, from: e.target.value },
                      }))
                    }
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="time"
                    value={operatingHours.monFri.to}
                    onChange={(e) =>
                      setOperatingHours((prev) => ({
                        ...prev,
                        monFri: { ...prev.monFri, to: e.target.value },
                      }))
                    }
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                  />
                </div>
              </div>

              {/* Saturday */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                  Saturday
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={operatingHours.saturday.from}
                    onChange={(e) =>
                      setOperatingHours((prev) => ({
                        ...prev,
                        saturday: { ...prev.saturday, from: e.target.value },
                      }))
                    }
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="time"
                    value={operatingHours.saturday.to}
                    onChange={(e) =>
                      setOperatingHours((prev) => ({
                        ...prev,
                        saturday: { ...prev.saturday, to: e.target.value },
                      }))
                    }
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                  />
                </div>
              </div>

              {/* Sunday */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                  Sunday
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={operatingHours.sunday.from}
                    onChange={(e) =>
                      setOperatingHours((prev) => ({
                        ...prev,
                        sunday: { ...prev.sunday, from: e.target.value },
                      }))
                    }
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="time"
                    value={operatingHours.sunday.to}
                    onChange={(e) =>
                      setOperatingHours((prev) => ({
                        ...prev,
                        sunday: { ...prev.sunday, to: e.target.value },
                      }))
                    }
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 bg-white text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Closed message */}
            <div className="pt-2">
              <label
                htmlFor="closed-message-input"
                className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5"
              >
                Closed Message
              </label>
              <input
                id="closed-message-input"
                type="text"
                value={operatingHours.closedMessage}
                onChange={(e) =>
                  setOperatingHours((prev) => ({ ...prev, closedMessage: e.target.value }))
                }
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
              />
            </div>

            {/* Timezone (Read only for MVP) */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Timezone: <strong>{operatingHours.timezone}</strong> (WAT, UTC+1)
              </span>
              <button
                type="button"
                onClick={handleSaveOperatingHours}
                disabled={isSavingHours}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                {isSavingHours ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Operating Hours</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
