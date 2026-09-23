'use client';

import React from 'react';
import { CreditCard, Landmark, ExternalLink, ArrowRight, ArrowLeft, ShieldCheck, Info } from 'lucide-react';

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
    <form onSubmit={handleSubmit} className="space-y-5 animate-fadeIn">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Payment &amp; Payout Setup</h2>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
            Optional for MVP
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Connect your Paystack account to receive direct customer payments into your Nigerian bank account.
        </p>
      </div>

      {/* Skip Notice Banner */}
      <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">💡 Skip for now. Add later in Settings.</span>
          <p className="text-emerald-700 mt-0.5">
            You can test the WhatsApp bot immediately with demo checkout links and configure your live Paystack keys whenever you are ready.
          </p>
        </div>
      </div>

      {/* Paystack Public Key */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="paystackKey" className="block text-xs sm:text-sm font-semibold text-slate-700">
            Paystack Public Key <span className="text-slate-400 font-normal">(optional for demo)</span>
          </label>
          <a
            href="https://dashboard.paystack.com/#/settings/developer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
          >
            <span>Get key from Paystack</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <CreditCard className="w-4 h-4" />
          </div>
          <input
            id="paystackKey"
            type="text"
            placeholder="pk_test_xxxxxxxxxxxxxxxxxxxxxxxx"
            value={data.paystack_key}
            onChange={(e) => onChange({ paystack_key: e.target.value })}
            className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Bank Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Bank Name */}
        <div>
          <label htmlFor="bankName" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
            Bank Name <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Landmark className="w-4 h-4" />
            </div>
            <select
              id="bankName"
              value={data.bank_name}
              onChange={(e) => onChange({ bank_name: e.target.value })}
              className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800"
            >
              <option value="">Select your bank...</option>
              {nigerianBanks.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Account Number */}
        <div>
          <label htmlFor="accountNumber" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
            Account Number <span className="text-slate-400 font-normal">(10 digits)</span>
          </label>
          <input
            id="accountNumber"
            type="text"
            maxLength={10}
            placeholder="0123456789"
            value={data.bank_account}
            onChange={(e) => onChange({ bank_account: e.target.value.replace(/\D/g, '') })}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Account Name */}
      <div>
        <label htmlFor="accountName" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
          Account Holder Name <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          id="accountName"
          type="text"
          placeholder="e.g. Tunde Alabi Ventures"
          value={data.account_name}
          onChange={(e) => onChange({ account_name: e.target.value })}
          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {/* Trust reassurance */}
      <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>Your banking keys are encrypted and stored safely via Paystack.</span>
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
        <button
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto px-5 h-12 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold text-sm transition flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <button
          type="submit"
          className="w-full sm:flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition flex items-center justify-center gap-2"
        >
          <span>Continue to Product Upload</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          className="text-xs text-slate-500 hover:text-emerald-700 font-semibold underline sm:hidden py-1"
        >
          Skip this step
        </button>
      </div>
    </form>
  );
}
