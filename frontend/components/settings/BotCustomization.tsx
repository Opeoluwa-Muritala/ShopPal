'use client';

import React, { useState } from 'react';
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
    setIsSavingGreeting(true);
    setGreetingError(null);
    try {
      await onUpdateGreeting(greetingText.trim());
      setIsEditingGreeting(false);
      onShowToast('Greeting message updated');
    } catch (err: any) {
      setGreetingError(err?.message || 'Failed to update greeting');
    } finally {
      setIsSavingGreeting(false);
    }
  };

  const handleSaveLanguage = async () => {
    setIsSavingLanguage(true);
    try {
      await onUpdateLanguage(selectedLanguage);
      onShowToast(`Language set to ${selectedLanguage}`);
    } catch {
      onShowToast('Failed to update language', 'error');
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const handleToggleOperatingHours = async () => {
    const updated: OperatingHours = {
      ...operatingHours,
      enabled: !operatingHours.enabled,
    };
    setOperatingHours(updated);
    setIsSavingHours(true);
    try {
      await onUpdateOperatingHours(updated);
      onShowToast(updated.enabled ? 'Operating hours enabled' : 'Operating hours disabled');
    } catch {
      onShowToast('Failed to update operating hours', 'error');
    } finally {
      setIsSavingHours(false);
    }
  };

  const handleSaveOperatingHours = async () => {
    setIsSavingHours(true);
    try {
      await onUpdateOperatingHours(operatingHours);
      onShowToast('Operating hours schedule saved');
    } catch {
      onShowToast('Failed to save hours', 'error');
    } finally {
      setIsSavingHours(false);
    }
  };

  const handleToggleBotStatus = async () => {
    const nextStatus = botStatus === 'active' ? 'paused' : 'active';
    setBotStatus(nextStatus);
    setIsSavingStatus(true);
    try {
      await onUpdateBotStatus(nextStatus);
      onShowToast(nextStatus === 'active' ? 'Bot is now Active' : 'Bot is now Paused');
    } catch {
      setBotStatus(botStatus);
      onShowToast('Failed to toggle bot status', 'error');
    } finally {
      setIsSavingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section: Bot Status */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Bot Status</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pause or resume automated replies to customer messages.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Toggle Bot Active"
            aria-checked={botStatus === 'active'}
            onClick={handleToggleBotStatus}
            disabled={isSavingStatus}
            className={`text-xs font-semibold px-4 py-2 rounded transition self-start sm:self-auto ${
              botStatus === 'active'
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {isSavingStatus ? 'Updating...' : botStatus === 'active' ? 'Pause Bot' : 'Activate Bot'}
          </button>

        </div>

        <div className="mt-4">
          <span className="text-xs text-slate-600">
            Current Status:{' '}
            <strong className="text-slate-900 capitalize font-bold">{botStatus}</strong>
          </span>
        </div>
      </div>

      {/* Section: Greeting Message */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Greeting Message</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              The opening message sent when a new shopper messages your WhatsApp number.
            </p>
          </div>
          {!isEditingGreeting && (
            <button
              type="button"
              onClick={() => {
                setGreetingText(botData.greetingMessage);
                setIsEditingGreeting(true);
                setGreetingError(null);
              }}
              className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition self-start sm:self-auto"
            >
              Edit Greeting
            </button>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {isEditingGreeting ? (
            <div className="border border-slate-300 rounded p-4 space-y-3 bg-slate-50">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="bot-greeting-textarea"
                  className="text-xs font-semibold text-slate-700"
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
                className="w-full text-xs sm:text-sm text-slate-900 border border-slate-300 rounded p-2.5 bg-white focus:outline-none focus:border-slate-900 resize-none"
                placeholder="Welcome to our store. How can I help you today?"
              />
              {greetingError && (
                <p className="text-xs text-red-600 font-medium">{greetingError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingGreeting(false);
                    setGreetingText(botData.greetingMessage);
                  }}
                  className="text-xs font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGreeting}
                  disabled={isSavingGreeting}
                  className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded transition disabled:opacity-50"
                >
                  {isSavingGreeting ? 'Saving...' : 'Save Greeting'}
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded p-4 bg-slate-50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Current Active Greeting
              </span>
              <p className="text-sm font-medium text-slate-900">
                &quot;{botData.greetingMessage}&quot;
              </p>
            </div>
          )}

          {/* WhatsApp Preview Bubble */}
          <div className="border border-slate-200 rounded p-4 bg-slate-50">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
              Your customers will see:
            </span>
            <div className="max-w-md bg-white border border-slate-300 rounded p-3 text-xs text-slate-900">
              <p>{isEditingGreeting ? greetingText : botData.greetingMessage}</p>
              <div className="text-right text-[10px] text-slate-400 mt-1">12:00 PM • Delivered</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Bot Language */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Bot Language</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dialect for automated WhatsApp customer conversations.
          </p>
        </div>

        <div className="mt-6 space-y-4 max-w-lg">
          <div>
            <label
              htmlFor="bot-language-select"
              className="text-xs font-semibold text-slate-700 block mb-1"
            >
              Select Dialect
            </label>
            <select
              id="bot-language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full text-xs sm:text-sm border border-slate-300 rounded p-2 bg-white text-slate-900 focus:outline-none focus:border-slate-900"
            >
              <option value="English / Naija Pidgin Mix">English / Naija Pidgin Mix (Recommended)</option>
              <option value="English">English</option>
              <option value="Pidgin">Pidgin</option>
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
              className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded transition disabled:opacity-50"
            >
              {isSavingLanguage ? 'Saving...' : 'Save Language'}
            </button>
          </div>
        </div>
      </div>

      {/* Section: Operating Hours */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Operating Hours</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify store operating hours.
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleOperatingHours}
            disabled={isSavingHours}
            className="text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition self-start sm:self-auto"
          >
            {operatingHours.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {operatingHours.enabled && (
          <div className="mt-6 space-y-4 max-w-lg">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Mon - Fri Hours
              </label>
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="time"
                  value={operatingHours.monFri.from}
                  onChange={(e) =>
                    setOperatingHours({
                      ...operatingHours,
                      monFri: { ...operatingHours.monFri, from: e.target.value },
                    })
                  }
                  className="px-2 py-1.5 border border-slate-300 rounded"
                />
                <span>to</span>
                <input
                  type="time"
                  value={operatingHours.monFri.to}
                  onChange={(e) =>
                    setOperatingHours({
                      ...operatingHours,
                      monFri: { ...operatingHours.monFri, to: e.target.value },
                    })
                  }
                  className="px-2 py-1.5 border border-slate-300 rounded"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveOperatingHours}
                disabled={isSavingHours}
                className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded transition disabled:opacity-50"
              >
                {isSavingHours ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
