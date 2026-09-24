'use client';

import React from 'react';

export interface Step2Data {
  paystack_key: string;
  bank_account: string;
  bank_name: string;
  account_name: string;
}

interface Step2Props {
  data: Step2Data;
  onChange: (data: Partial<Step2Data>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2Payment({ data, onChange, onNext, onBack }: Step2Props) {
  const nigerianBanks = [
    'Access Bank',
    'Guaranty Trust Bank (GTBank)',
    'Zenith Bank',
    'First Bank of Nigeria',
    'United Bank for Africa (UBA)',
    'Kuda Microfinance Bank',
    'OPay Digital Services',
    'Palmpay',
    'Moniepoint MFB',
    'Stanbic IBTC Bank',
    'Fidelity Bank',
    'Wema Bank / ALAT',
    'Union Bank of Nigeria',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Payment &amp; Payout Setup</h2>
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            Optional
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-1">
          Connect your Paystack account to receive direct customer payments into your Nigerian bank account.
        </p>
      </div>

      {/* Skip Notice Banner */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
        <span className="font-semibold block text-slate-900">Optional for setup — Skip for now.</span>
        You can test the WhatsApp bot immediately with test checkout links and configure your live Paystack keys whenever you are ready.
      </div>


      {/* Paystack Public Key */}
      <div>
        <label htmlFor="paystackKey" className="block text-xs font-semibold text-slate-900 mb-1">
          Paystack Public Key <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <input
          id="paystackKey"
          type="text"
          placeholder="pk_test_xxxxxxxx or pk_live_xxxxxxxx"
          value={data.paystack_key}
          onChange={(e) => onChange({ paystack_key: e.target.value })}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Find this in your Paystack Dashboard under Settings &gt; API Keys &amp; Webhooks.
        </p>
      </div>

      {/* Bank Details */}
      <div className="pt-2 border-t border-slate-200 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
          Bank Settlement Account
        </h3>

        {/* Bank Name Dropdown */}
        <div>
          <label htmlFor="bankName" className="block text-xs font-semibold text-slate-900 mb-1">
            Bank Name
          </label>
          <select
            id="bankName"
            value={data.bank_name}
            onChange={(e) => onChange({ bank_name: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">Select your Nigerian Bank...</option>
            {nigerianBanks.map((bank) => (
              <option key={bank} value={bank}>
                {bank}
              </option>
            ))}
          </select>
        </div>

        {/* NUBAN Account Number */}
        <div>
          <label htmlFor="bankAccount" className="block text-xs font-semibold text-slate-900 mb-1">
            NUBAN Account Number (10 digits)
          </label>
          <input
            id="bankAccount"
            type="text"
            maxLength={10}
            placeholder="0123456789"
            value={data.bank_account}
            onChange={(e) => onChange({ bank_account: e.target.value.replace(/\D/g, '') })}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
          />
        </div>

        {/* Account Name */}
        <div>
          <label htmlFor="accountName" className="block text-xs font-semibold text-slate-900 mb-1">
            Account Holder Name
          </label>
          <input
            id="accountName"
            type="text"
            placeholder="Your Business or Personal Account Name"
            value={data.account_name}
            onChange={(e) => onChange({ account_name: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-medium text-sm rounded transition"
        >
          Back
        </button>
        <button
          type="submit"
          className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded transition"
        >
          Continue to Product Upload
        </button>

      </div>
    </form>
  );
}
