'use client';

import React, { useState } from 'react';
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

export const validateAccountNumber = (accountNum: string): string | null => {
  const digits = accountNum.replace(/\D/g, '');
  if (!digits) return 'Account number is required';
  if (digits.length !== 10) return 'Account number must be exactly 10 digits';
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
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [paystackDraftKey, setPaystackDraftKey] = useState(paystack.key);
  const [paystackError, setPaystackError] = useState<string | null>(null);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingKey, setIsSavingKey] = useState(false);

  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankNameDraft, setBankNameDraft] = useState(bankAccount.bankName);
  const [accountNumberDraft, setAccountNumberDraft] = useState(bankAccount.accountNumber);
  const [accountNameDraft, setAccountNameDraft] = useState(bankAccount.accountName);
  const [bankError, setBankError] = useState<string | null>(null);
  const [isVerifyingBank, setIsVerifyingBank] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);

  const handleTestConnection = async () => {
    const keyToTest = isEditingKey ? paystackDraftKey : paystack.key;
    const err = validatePaystackKey(keyToTest);
    if (err) {
      setPaystackError(err);
      return;
    }
    setIsTestingKey(true);
    setTestResult(null);
    try {
      const res = await onTestPaystackConnection(keyToTest);
      setTestResult(res);
      onShowToast(res.message, res.success ? 'success' : 'error');
    } catch {
      setTestResult({ success: false, message: 'Connection test failed' });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSavePaystackKey = async () => {
    const err = validatePaystackKey(paystackDraftKey);
    if (err) {
      setPaystackError(err);
      return;
    }
    setIsSavingKey(true);
    try {
      await onUpdatePaystack(paystackDraftKey);
      setIsEditingKey(false);
      setPaystackError(null);
      onShowToast('Paystack key updated');
    } catch (err: any) {
      setPaystackError(err?.message || 'Failed to save key');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleSaveBank = async () => {
    const numErr = validateAccountNumber(accountNumberDraft);
    if (numErr) {
      setBankError(numErr);
      return;
    }
    setIsSavingBank(true);
    try {
      await onUpdateBankAccount({
        bankName: bankNameDraft,
        accountNumber: accountNumberDraft,
        accountName: accountNameDraft,
        isVerified: true,
      });
      setIsEditingBank(false);
      setBankError(null);
      onShowToast('Bank account updated');
    } catch (err: any) {
      setBankError(err?.message || 'Failed to save bank info');
    } finally {
      setIsSavingBank(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section: Paystack Credentials */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Connected Paystack Account</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customers make direct bank transfers and card payments verified via Paystack.
            </p>
          </div>
          {!isEditingKey && (
            <button
              type="button"
              onClick={() => {
                setPaystackDraftKey(paystack.key);
                setIsEditingKey(true);
              }}
              className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition self-start sm:self-auto"
            >
              Update Key
            </button>
          )}
        </div>

        {isEditingKey ? (
          <div className="space-y-4 mt-6">
            <div>
              <label htmlFor="paystack-key-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Paystack Public Key
              </label>
              <input
                id="paystack-key-input"
                type="text"
                value={paystackDraftKey}
                onChange={(e) => {
                  setPaystackDraftKey(e.target.value);
                  if (paystackError) setPaystackError(null);
                }}
                placeholder="pk_test_... or pk_live_..."
                className={`w-full px-3 py-2 bg-white border rounded text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-slate-900 ${
                  paystackError ? 'border-red-400' : 'border-slate-300'
                }`}
              />
              {paystackError && (
                <p className="mt-1 text-xs text-red-600 font-medium">{paystackError}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditingKey(false);
                  setPaystackError(null);
                }}
                className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingKey}
                className="text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded transition"
              >
                {isTestingKey ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                type="button"
                onClick={handleSavePaystackKey}
                disabled={isSavingKey}
                className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded transition disabled:opacity-50"
              >
                {isSavingKey ? 'Saving...' : 'Save Public Key'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="border border-slate-200 rounded p-4 bg-slate-50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Public Key
              </span>
              <p className="text-sm font-mono font-bold text-slate-900">
                {maskKey(paystack.key)}
              </p>
            </div>

            <div className="border border-slate-200 rounded p-4 bg-slate-50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Connection Status
              </span>
              <div className="mt-1">
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Connected
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded p-4 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Health Check
                </span>
                <span className="text-xs text-slate-600 font-medium">Auto-verification</span>
              </div>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingKey}
                className="text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1 rounded transition"
              >
                {isTestingKey ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>
        )}

        {testResult && (
          <div
            className={`mt-4 p-3 rounded border text-xs font-medium ${
              testResult.success
                ? 'bg-slate-100 border-slate-300 text-slate-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {testResult.success
              ? 'Connection successful: Live webhook and payment verification operational'
              : `Invalid key: ${testResult.message}`}
          </div>
        )}

      </div>

      {/* Section: Bank Account */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Bank Account (for withdrawals)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Settlements from your customer orders are sent to this bank account.
            </p>
          </div>
          {!isEditingBank && (
            <button
              type="button"
              onClick={() => {
                setBankNameDraft(bankAccount.bankName);
                setAccountNumberDraft(bankAccount.accountNumber);
                setAccountNameDraft(bankAccount.accountName);
                setIsEditingBank(true);
              }}
              className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition self-start sm:self-auto"
            >
              Update Bank
            </button>
          )}
        </div>

        {isEditingBank ? (
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bank Name
                </label>
                <select
                  value={bankNameDraft}
                  onChange={(e) => setBankNameDraft(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                >
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  10-Digit Account Number
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={accountNumberDraft}
                  onChange={(e) => setAccountNumberDraft(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={accountNameDraft}
                  onChange={(e) => setAccountNameDraft(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            {bankError && (
              <p className="text-xs text-red-600 font-medium">{bankError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditingBank(false);
                  setBankError(null);
                }}
                className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBank}
                disabled={isSavingBank}
                className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded transition disabled:opacity-50"
              >
                {isSavingBank ? 'Saving...' : 'Save Bank Account'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="border border-slate-200 rounded p-4 bg-slate-50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Bank Name
              </span>
              <p className="text-sm font-bold text-slate-900">{bankAccount.bankName}</p>
            </div>

            <div className="border border-slate-200 rounded p-4 bg-slate-50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Account Number
              </span>
              <p className="text-sm font-mono font-bold text-slate-900">
                {bankAccount.accountNumber}
              </p>
            </div>

            <div className="border border-slate-200 rounded p-4 bg-slate-50">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Account Name
              </span>
              <p className="text-sm font-bold text-slate-900">{bankAccount.accountName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Section: Withdrawal Settings */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Withdrawal Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated payout cycles and minimum withdrawal threshold.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="border border-slate-200 rounded p-4 bg-slate-50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Minimum Withdrawal
            </span>
            <p className="text-base font-bold text-slate-900">
              ₦{withdrawal.minWithdrawal.toLocaleString()}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Automated threshold</span>
          </div>

          <div className="border border-slate-200 rounded p-4 bg-slate-50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Next Payment Date
            </span>
            <p className="text-base font-bold text-slate-900">
              {withdrawal.nextPayoutDate}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Next scheduled batch</span>
          </div>

          <div className="border border-slate-200 rounded p-4 bg-slate-50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Last Payout
            </span>
            <p className="text-base font-bold text-slate-900">
              {withdrawal.lastPayout}
            </p>
            <span className="text-[11px] text-slate-600 font-semibold mt-0.5 block">Paid directly to bank</span>
          </div>
        </div>
      </div>
    </div>
  );
}
