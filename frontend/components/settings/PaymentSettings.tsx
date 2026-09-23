'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Building2,
  Wallet,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  Pencil,
  Check,
  X,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { PaystackConfig, BankAccountInfo, WithdrawalSettings } from './types';

export interface PaymentSettingsProps {
  paystack: PaystackConfig;
  bankAccount: BankAccountInfo;
  withdrawal: WithdrawalSettings;
  onUpdatePaystack: (key: string) => Promise<boolean | void> | boolean | void;
  onUpdateBankAccount: (bank: BankAccountInfo) => Promise<boolean | void> | boolean | void;
  onTestPaystackConnection: (key: string) => Promise<{ success: boolean; message: string }>;
  onVerifyBankAccount: (bankName: string, accountNumber: string) => Promise<{ success: boolean; accountName?: string; message: string }>;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const NIGERIAN_BANKS = [
  'GTBank',
  'Access Bank',
  'Zenith Bank',
  'United Bank for Africa (UBA)',
  'First Bank of Nigeria',
  'Stanbic IBTC Bank',
  'Fidelity Bank',
  'Kuda Bank',
  'OPay',
  'Moniepoint MFB',
  'PalmPay',
  'Other / Custom Bank',
];

export const maskKey = (key: string): string => {
  if (!key) return 'None';
  if (key.length <= 10) return `${key.slice(0, 4)}••••••`;
  return `${key.slice(0, 7)}••••••••${key.slice(-4)}`;
};

export const validatePaystackKey = (key: string): string | null => {
  const trimmed = key.trim();
  if (!trimmed) return 'Paystack public key is required';
  if (!trimmed.startsWith('pk_test_') && !trimmed.startsWith('pk_live_')) {
    return 'Invalid key format: Must begin with "pk_test_" or "pk_live_"';
  }
  if (trimmed.length < 11) {
    return 'Paystack key is too short';
  }
  return null;
};

export const validateAccountNumber = (num: string): string | null => {
  const digits = num.replace(/\D/g, '');
  if (!digits) return 'Account number is required';
  if (digits.length !== 10) return 'Nigerian NUBAN account number must be exactly 10 digits';
  return null;
};

export default function PaymentSettings({
  paystack,
  bankAccount,
  withdrawal,
  onUpdatePaystack,
  onUpdateBankAccount,
  onTestPaystackConnection,
  onVerifyBankAccount,
  onShowToast,
}: PaymentSettingsProps) {
  // Paystack editing state
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [paystackKeyInput, setPaystackKeyInput] = useState(paystack.key);
  const [paystackError, setPaystackError] = useState<string | null>(null);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isTestingPaystack, setIsTestingPaystack] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Bank account editing state
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankName, setBankName] = useState(bankAccount.bankName);
  const [customBank, setCustomBank] = useState('');
  const [accountNumber, setAccountNumber] = useState(bankAccount.accountNumber);
  const [accountName, setAccountName] = useState(bankAccount.accountName);
  const [bankError, setBankError] = useState<string | null>(null);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [isVerifyingBank, setIsVerifyingBank] = useState(false);
  const [bankVerifyResult, setBankVerifyResult] = useState<string | null>(null);

  const handleSavePaystackKey = async () => {
    const err = validatePaystackKey(paystackKeyInput);
    if (err) {
      setPaystackError(err);
      return;
    }
    setPaystackError(null);
    try {
      setIsSavingKey(true);
      await onUpdatePaystack(paystackKeyInput.trim());
      setIsEditingKey(false);
      onShowToast('✅ Paystack public key updated successfully');
    } catch {
      setPaystackError('Failed to save Paystack key');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleTestConnection = async () => {
    const keyToTest = isEditingKey ? paystackKeyInput : paystack.key;
    const err = validatePaystackKey(keyToTest);
    if (err) {
      setPaystackError(err);
      return;
    }
    try {
      setIsTestingPaystack(true);
      setTestResult(null);
      const res = await onTestPaystackConnection(keyToTest.trim());
      setTestResult(res);
      if (res.success) {
        onShowToast('✅ Paystack connection verified!');
      } else {
        onShowToast('❌ Paystack connection failed', 'error');
      }
    } finally {
      setIsTestingPaystack(false);
    }
  };

  const handleSaveBank = async () => {
    const effectiveBankName = bankName === 'Other / Custom Bank' ? customBank : bankName;
    if (!effectiveBankName.trim()) {
      setBankError('Please select or specify a bank name');
      return;
    }
    const accErr = validateAccountNumber(accountNumber);
    if (accErr) {
      setBankError(accErr);
      return;
    }
    if (!accountName.trim()) {
      setBankError('Account name is required');
      return;
    }
    setBankError(null);

    try {
      setIsSavingBank(true);
      await onUpdateBankAccount({
        bankName: effectiveBankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        isVerified: true,
      });
      setIsEditingBank(false);
      onShowToast('✅ Bank details saved successfully');
    } catch {
      setBankError('Failed to save bank details');
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleVerifyBank = async () => {
    const effectiveBankName = bankName === 'Other / Custom Bank' ? customBank : bankName;
    const accErr = validateAccountNumber(accountNumber);
    if (accErr) {
      setBankError(accErr);
      return;
    }
    try {
      setIsVerifyingBank(true);
      setBankVerifyResult(null);
      const res = await onVerifyBankAccount(effectiveBankName, accountNumber);
      if (res.success) {
        if (res.accountName) {
          setAccountName(res.accountName);
        }
        setBankVerifyResult(`✅ Account Verified: ${res.accountName || accountName}`);
        onShowToast(`✅ Account Verified: ${res.accountName || accountName}`);
      } else {
        setBankVerifyResult(`❌ ${res.message}`);
        onShowToast(res.message, 'error');
      }
    } finally {
      setIsVerifyingBank(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Section: Paystack Integration */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Paystack Configuration</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Provide your Paystack public key to receive direct customer payments on WhatsApp.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {paystack.isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ✅ Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" />
                ⏳ Not Connected
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Connected Paystack Account
              </span>
              <div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-800">
                <Lock className="w-4 h-4 text-slate-400" />
                <span>
                  Connected to: {maskKey(paystack.key || 'pk_test_xxxx')}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingPaystack}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3.5 py-2 rounded-xl transition disabled:opacity-50"
              >
                {isTestingPaystack ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Test Connection</span>
              </button>

              {!isEditingKey && (
                <button
                  type="button"
                  onClick={() => {
                    setPaystackKeyInput(paystack.key);
                    setIsEditingKey(true);
                    setPaystackError(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Paystack Key</span>
                </button>
              )}
            </div>
          </div>

          {/* Test connection alert result */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2 animate-in fade-in duration-150 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✅ Connection successful: Live webhook and payment verification operational</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>❌ Invalid key: {testResult.message}</span>
                </>
              )}
            </div>
          )}

          {/* Edit form */}
          {isEditingKey && (
            <div className="border border-emerald-200 bg-emerald-50/20 rounded-xl p-4 space-y-3">
              <label
                htmlFor="paystack-public-key"
                className="text-xs font-bold uppercase tracking-wider text-slate-700 block"
              >
                Paystack Public Key
              </label>
              <input
                id="paystack-public-key"
                type="text"
                value={paystackKeyInput}
                onChange={(e) => setPaystackKeyInput(e.target.value)}
                placeholder="pk_test_xxxxxxxxxxx"
                className="w-full text-sm font-mono border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
              {paystackError && (
                <p className="text-xs font-semibold text-red-600">{paystackError}</p>
              )}
              <div className="flex items-center justify-between gap-3 pt-2">
                <a
                  href="https://dashboard.paystack.com/#/settings/developer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-sky-700 hover:text-sky-800 font-semibold underline"
                >
                  <span>Get your Paystack key: Paystack dashboard</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingKey(false);
                      setPaystackError(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePaystackKey}
                    disabled={isSavingKey}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    {isSavingKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Save Key</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section: Bank Account (for withdrawals) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bank Account (for withdrawals)</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Settlement bank account for your store payouts and daily earnings.
              </p>
            </div>
          </div>

          {!isEditingBank && (
            <button
              type="button"
              onClick={() => {
                setBankName(bankAccount.bankName);
                setAccountNumber(bankAccount.accountNumber);
                setAccountName(bankAccount.accountName);
                setIsEditingBank(true);
                setBankError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Bank Account</span>
            </button>
          )}
        </div>

        {isEditingBank ? (
          <div className="mt-6 space-y-4 border border-purple-200 bg-purple-50/20 rounded-xl p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="bank-name-select"
                  className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5"
                >
                  Bank Name
                </label>
                <select
                  id="bank-name-select"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition"
                >
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {bankName === 'Other / Custom Bank' && (
                <div>
                  <label
                    htmlFor="custom-bank-input"
                    className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5"
                  >
                    Custom Bank Name
                  </label>
                  <input
                    id="custom-bank-input"
                    type="text"
                    value={customBank}
                    onChange={(e) => setCustomBank(e.target.value)}
                    placeholder="Enter custom bank name"
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="account-number-input"
                  className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5"
                >
                  Account Number (10 digits)
                </label>
                <div className="flex gap-2">
                  <input
                    id="account-number-input"
                    type="text"
                    maxLength={10}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="1234567890"
                    className="w-full text-sm font-mono border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyBank}
                    disabled={isVerifyingBank}
                    className="shrink-0 text-xs font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 px-3 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    {isVerifyingBank ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Verify Account'}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="account-name-input"
                  className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1.5"
                >
                  Account Name (Beneficiary)
                </label>
                <input
                  id="account-name-input"
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Tunde Ajayi Enterprise"
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                />
              </div>
            </div>

            {bankVerifyResult && (
              <p className="text-xs font-medium text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                {bankVerifyResult}
              </p>
            )}

            {bankError && (
              <p className="text-xs font-semibold text-red-600">{bankError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditingBank(false);
                  setBankError(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleSaveBank}
                disabled={isSavingBank}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {isSavingBank ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Bank Account</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Bank Name
              </span>
              <p className="text-sm font-bold text-slate-900">{bankAccount.bankName}</p>
            </div>

            <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Account Number
              </span>
              <p className="text-sm font-mono font-bold text-slate-900">
                {bankAccount.accountNumber}
              </p>
            </div>

            <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Account Name
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3 h-3" />
                  Verified
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900">{bankAccount.accountName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Section: Withdrawal Settings */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Withdrawal Settings</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Automated payout cycles and minimum withdrawal criteria.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Minimum Withdrawal
            </span>
            <p className="text-base font-extrabold text-slate-900">
              ₦{withdrawal.minWithdrawal.toLocaleString()}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Automated threshold</span>
          </div>

          <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Next Payment Date
            </span>
            <p className="text-base font-extrabold text-slate-900">
              {withdrawal.nextPayoutDate}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Next scheduled batch</span>
          </div>

          <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Last Payout
            </span>
            <p className="text-base font-extrabold text-slate-900">
              {withdrawal.lastPayout}
            </p>
            <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">Paid out directly to bank</span>
          </div>
        </div>
      </div>
    </div>
  );
}
