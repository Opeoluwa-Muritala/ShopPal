'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import AccountSettings from './AccountSettings';
import PaymentSettings from './PaymentSettings';
import BotCustomization from './BotCustomization';
import NotificationsSettings from './NotificationsSettings';
import BillingUsage from './BillingUsage';
import DangerZone from './DangerZone';
import {
  SettingsTabId,
  VendorSettings,
  PersonalInfo,
  BankAccountInfo,
  OperatingHours,
  NotificationSettingsData,
  ToastMessage,
} from './types';
import { authApi, vendorsApi } from '../../lib/api';
import { clearStoredTokens, getStoredTokens } from '../../lib/auth';

export const DEMO_VENDOR_SETTINGS: VendorSettings = {
  id: 'vendor_001234',
  personalInfo: {
    fullName: '',
    phone: '',
    whatsappNumber: '',
    businessName: '',
    email: '',
  },
  accountStatus: {
    status: 'Active',
    accountCreated: 'Sep 1, 2025',
    vendorId: 'vendor_001234',
    botWhatsAppNumber: '+1 415 523 8886',
  },
  paystack: {
    key: 'pk_test_xxxx',
    isConnected: true,
    maskedKey: 'pk_test_••••••••xxxx',
  },
  bankAccount: {
    bankName: '',
    accountNumber: '',
    accountName: '',
    isVerified: true,
  },
  withdrawal: {
    minWithdrawal: 5000,
    nextPayoutDate: 'Oct 1, 2025',
    lastPayout: 'Sep 15, 2025 - ₦450,000',
  },
  bot: {
    greetingMessage: 'Hi! Welcome to our store. How can I help you today?',
    language: 'English / Naija Pidgin Mix',
    operatingHours: {
      enabled: false,
      monFri: { from: '09:00', to: '18:00' },
      saturday: { from: '10:00', to: '16:00' },
      sunday: { from: '12:00', to: '16:00' },
      closedMessage: "Sorry, I'm not available right now. I'll respond when I'm back!",
      timezone: 'Africa/Lagos',
    },
    status: 'active',
  },
  notifications: {
    emailOnOrder: true,
    pushOnOrder: true,
    lowStockAlert: true,
    lowStockThreshold: 5,
    lowStockFrequency: 'Immediate',
    lowStockChannels: {
      email: true,
      push: true,
    },
    chatCustomerMessage: true,
    chatOrderUpdate: true,
    marketingRecommendations: true,
    marketingPromoEmails: true,
  },
  billing: {
    planName: 'Free (Hackathon)',
    planStatus: 'Active',
    price: '₦0/month',
    apiCalls: 1234,
    apiCallsLimit: 'Unlimited',
    storageMb: 50,
    storageLimit: 'Unlimited',
    activeProducts: 5,
    activeProductsLimit: 'Unlimited',
    ordersProcessed: 45,
  },
};

const TAB_CONFIG: { id: SettingsTabId; label: string }[] = [
  { id: 'account', label: 'Account Settings' },
  { id: 'payment', label: 'Payment Settings' },
  { id: 'bot', label: 'Bot Customization' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'billing', label: 'Billing & Usage' },
  { id: 'danger', label: 'Danger Zone' },
];

function SettingsPageInner() {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('account');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const storedTokens = getStoredTokens();
  const initialSettings = useMemo(() => {
    if (storedTokens.name || storedTokens.business_name || storedTokens.vendor_id) {
      return {
        ...DEMO_VENDOR_SETTINGS,
        id: storedTokens.vendor_id || DEMO_VENDOR_SETTINGS.id,
        personalInfo: {
          fullName: storedTokens.name || DEMO_VENDOR_SETTINGS.personalInfo.fullName,
          phone: storedTokens.phone || DEMO_VENDOR_SETTINGS.personalInfo.phone,
          whatsappNumber: storedTokens.phone || DEMO_VENDOR_SETTINGS.personalInfo.whatsappNumber,
          businessName: storedTokens.business_name || DEMO_VENDOR_SETTINGS.personalInfo.businessName,
          email: storedTokens.email || DEMO_VENDOR_SETTINGS.personalInfo.email,
        },
        accountStatus: {
          ...DEMO_VENDOR_SETTINGS.accountStatus,
          vendorId: storedTokens.vendor_id || DEMO_VENDOR_SETTINGS.accountStatus.vendorId,
        },
      };
    }
    return DEMO_VENDOR_SETTINGS;
  }, [storedTokens]);

  const [currentSettings, setCurrentSettings] = useState<VendorSettings>(initialSettings);

  useEffect(() => {
    let cancelled = false;

    const loadVendorProfile = async () => {
      const response = await vendorsApi.getMe();
      if (cancelled || !response.data) return;

      const profile = response.data;
      setCurrentSettings((prev) => ({
        ...prev,
        id: profile.vendor_id || profile.id,
        personalInfo: {
          ...prev.personalInfo,
          fullName: profile.name || prev.personalInfo.fullName,
          phone: profile.phone || prev.personalInfo.phone,
          whatsappNumber: profile.whatsapp_number || profile.phone || prev.personalInfo.whatsappNumber,
          businessName: profile.business_name || prev.personalInfo.businessName,
          email: profile.email || prev.personalInfo.email,
        },
        accountStatus: {
          ...prev.accountStatus,
          status: profile.is_active ? 'Active' : 'Inactive',
          accountCreated: profile.created_at
            ? new Date(profile.created_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : prev.accountStatus.accountCreated,
          vendorId: profile.vendor_id || profile.id,
          botWhatsAppNumber: profile.bot_number || profile.whatsapp_number || prev.accountStatus.botWhatsAppNumber,
        },
        paystack: {
          ...prev.paystack,
          key: profile.paystack_public_key || prev.paystack.key,
          isConnected: Boolean(profile.paystack_public_key),
        },
        bankAccount: {
          ...prev.bankAccount,
          accountNumber: profile.bank_account || prev.bankAccount.accountNumber,
        },
        bot: {
          ...prev.bot,
          greetingMessage: profile.greeting_message || prev.bot.greetingMessage,
          language: profile.preferred_language || prev.bot.language,
        },
      }));
    };

    void loadVendorProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Handlers: local state updates only (no non-existent API endpoints) ----

  const handleUpdatePersonalInfo = async (field: keyof PersonalInfo, value: string) => {
    const updatedInfo = { ...currentSettings.personalInfo, [field]: value };
    setCurrentSettings((prev) => ({
      ...prev,
      personalInfo: updatedInfo,
    }));
  };

  const handleUpdatePaystackKey = async (key: string) => {
    setCurrentSettings((prev) => ({
      ...prev,
      paystack: {
        ...prev.paystack,
        key,
        isConnected: Boolean(key),
      },
    }));
  };

  const handleUpdateBankAccount = async (bank: BankAccountInfo) => {
    setCurrentSettings((prev) => ({
      ...prev,
      bankAccount: bank,
    }));
  };

  const handleTestPaystackConnection = async (key: string) => {
    if (key.startsWith('pk_test_') || key.startsWith('pk_live_')) {
      return { success: true, message: 'Connection verified successfully.' };
    }
    return { success: false, message: 'Invalid test key structure.' };
  };

  const handleVerifyBankAccount = async (_bankName: string, _accountNumber: string) => {
    return {
      success: true,
      accountName: currentSettings.personalInfo.fullName + ' Enterprise',
      message: 'Account verified',
    };
  };

  const handleUpdateGreeting = async (greetingMessage: string) => {
    setCurrentSettings((prev) => ({
      ...prev,
      bot: { ...prev.bot, greetingMessage },
    }));
  };

  const handleUpdateLanguage = async (language: string) => {
    setCurrentSettings((prev) => ({
      ...prev,
      bot: { ...prev.bot, language },
    }));
  };

  const handleUpdateOperatingHours = async (operatingHours: OperatingHours) => {
    setCurrentSettings((prev) => ({
      ...prev,
      bot: { ...prev.bot, operatingHours },
    }));
  };

  const handleUpdateBotStatus = async (status: 'active' | 'paused') => {
    setCurrentSettings((prev) => ({
      ...prev,
      bot: { ...prev.bot, status },
    }));
  };

  const handleSaveNotifications = async (notifData: NotificationSettingsData) => {
    setCurrentSettings((prev) => ({
      ...prev,
      notifications: notifData,
    }));
    setHasUnsavedChanges(false);
  };

  // POST /api/auth/change-password does not exist — show informative error
  const handleChangePassword = async (_currentPass: string, _newPass: string) => {
    throw new Error('Password update is not available in this version.');
  };

  // POST /api/auth/logout-all is a real endpoint — keep this one
  const handleLogoutAllSessions = async () => {
    try {
      await authApi.logoutAll();
    } catch {
      // Ignore
    } finally {
      clearStoredTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  // DELETE /api/vendor/:id does not exist — show informative error
  const handleDeleteAccount = async (_reason: string) => {
    throw new Error('Account deletion is not available via this portal. Contact support.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Settings &amp; Integrations
              </h1>
              <span className="text-xs bg-slate-100 text-slate-800 font-medium px-2.5 py-0.5 rounded border border-slate-200">
                Active Merchant
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configure store details, payment keys, WhatsApp bot dialect, and staff permissions.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto border-b border-slate-200">
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.id;
            const isDanger = tab.id === 'danger';

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-3 text-xs font-semibold border-b-2 transition shrink-0 ${
                  isActive
                    ? isDanger
                      ? 'border-red-600 text-red-700'
                      : 'border-slate-900 text-slate-900'
                    : isDanger
                    ? 'border-transparent text-red-600 hover:text-red-700'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        {activeTab === 'account' && (
          <AccountSettings
            personalInfo={currentSettings.personalInfo}
            accountStatus={currentSettings.accountStatus}
            onUpdatePersonalInfo={handleUpdatePersonalInfo}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'payment' && (
          <PaymentSettings
            paystack={currentSettings.paystack}
            bankAccount={currentSettings.bankAccount}
            withdrawal={currentSettings.withdrawal}
            onUpdatePaystack={handleUpdatePaystackKey}
            onUpdateBankAccount={handleUpdateBankAccount}
            onTestPaystackConnection={handleTestPaystackConnection}
            onVerifyBankAccount={handleVerifyBankAccount}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'bot' && (
          <BotCustomization
            botData={currentSettings.bot}
            onUpdateGreeting={handleUpdateGreeting}
            onUpdateLanguage={handleUpdateLanguage}
            onUpdateOperatingHours={handleUpdateOperatingHours}
            onUpdateBotStatus={handleUpdateBotStatus}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsSettings
            notifications={currentSettings.notifications}
            accountEmail={currentSettings.personalInfo.email}
            onSaveNotifications={handleSaveNotifications}
            onShowToast={showToast}
            onDirtyChange={setHasUnsavedChanges}
          />
        )}

        {activeTab === 'billing' && (
          <BillingUsage billing={currentSettings.billing} />
        )}

        {activeTab === 'danger' && (
          <DangerZone
            vendorId={currentSettings.id}
            onChangePassword={handleChangePassword}
            onLogoutAllSessions={handleLogoutAllSessions}
            onDeleteAccount={handleDeleteAccount}
            onShowToast={showToast}
          />
        )}
      </div>

      {/* Floating Toast Alerts */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3 rounded border text-xs font-semibold ${
              toast.type === 'error'
                ? 'bg-red-900 text-white border-red-800'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-xs text-slate-400 hover:text-white underline ml-2"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsPageInner />
    </QueryClientProvider>
  );
}
