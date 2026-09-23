'use client';

import React, { useState } from 'react';
import { User, Phone, MessageSquare, Store, Tag, ArrowRight, AlertCircle } from 'lucide-react';

export interface Step1Data {
  name: string;
  phone: string;
  whatsapp_number: string;
  business_name: string;
  category: string;
}

interface Step1Props {
  data: Step1Data;
  onChange: (data: Partial<Step1Data>) => void;
  onNext: () => void;
}

export default function Step1Business({ data, onChange, onNext }: Step1Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasSyncWhatsApp, setHasSyncWhatsApp] = useState(true);

  // Auto-format phone to 11 digits: "0701 234 5678"
  const formatPhone = (val: string): string => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 4) return raw;
    if (raw.length <= 7) return `${raw.slice(0, 4)} ${raw.slice(4)}`;
    return `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    const updates: Partial<Step1Data> = { phone: formatted };
    if (hasSyncWhatsApp) {
      updates.whatsapp_number = formatted;
    }
    onChange(updates);
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: '' }));
    }
  };

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasSyncWhatsApp(false);
    const formatted = formatPhone(e.target.value);
    onChange({ whatsapp_number: formatted });
    if (errors.whatsapp_number) {
      setErrors((prev) => ({ ...prev, whatsapp_number: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!data.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (data.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    } else if (data.name.trim().length > 50) {
      newErrors.name = 'Name must not exceed 50 characters';
    }

    // Phone validation (11 digits: clean non-digits)
    const rawPhone = data.phone.replace(/\D/g, '');
    if (!rawPhone) {
      newErrors.phone = '❌ Phone number is required';
    } else if (rawPhone.length !== 11) {
      newErrors.phone = '❌ Phone must be 11 digits';
    } else if (!/^(07|08|09)/.test(rawPhone)) {
      newErrors.phone = '❌ Phone must begin with 07, 08, or 09 (Nigerian format)';
    }

    // WhatsApp validation
    const rawWA = data.whatsapp_number.replace(/\D/g, '');
    if (rawWA && rawWA.length !== 11) {
      newErrors.whatsapp_number = '❌ WhatsApp number must be 11 digits';
    }

    if (data.business_name && data.business_name.length > 100) {
      newErrors.business_name = 'Business name must not exceed 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fadeIn">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900">Create Vendor Account</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Tell us about your business to launch your 24/7 automated WhatsApp storefront.
        </p>
      </div>

      {/* Full Name */}
      <div>
        <label htmlFor="fullName" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
          Full Name <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <User className="w-4 h-4" />
          </div>
          <input
            id="fullName"
            type="text"
            placeholder="e.g. Tunde Alabi"
            value={data.name}
            onChange={(e) => {
              onChange({ name: e.target.value });
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
            }}
            className={`w-full pl-10 pr-3.5 py-2.5 bg-white border rounded-xl text-sm transition focus:outline-none focus:ring-2 ${
              errors.name
                ? 'border-red-400 focus:ring-red-400 bg-red-50/30'
                : 'border-slate-300 focus:ring-emerald-500 focus:border-emerald-500'
            }`}
          />
        </div>
        {errors.name && (
          <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errors.name}</span>
          </p>
        )}
      </div>

      {/* Phone Number */}
      <div>
        <label htmlFor="phoneNumber" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Phone className="w-4 h-4" />
          </div>
          <input
            id="phoneNumber"
            type="tel"
            placeholder="0803 123 4567"
            value={data.phone}
            onChange={handlePhoneChange}
            maxLength={13}
            className={`w-full pl-10 pr-3.5 py-2.5 bg-white border rounded-xl text-sm transition focus:outline-none focus:ring-2 font-mono ${
              errors.phone
                ? 'border-red-400 focus:ring-red-400 bg-red-50/30'
                : 'border-slate-300 focus:ring-emerald-500 focus:border-emerald-500'
            }`}
          />
        </div>
        {errors.phone ? (
          <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errors.phone}</span>
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-400">Nigerian format (11 digits: 070..., 080..., 090...)</p>
        )}
      </div>

      {/* WhatsApp Number */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="whatsappNumber" className="block text-xs sm:text-sm font-semibold text-slate-700">
            WhatsApp Number
          </label>
          <button
            type="button"
            onClick={() => {
              onChange({ whatsapp_number: data.phone });
              setHasSyncWhatsApp(true);
            }}
            className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
          >
            Same as phone
          </button>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
            <MessageSquare className="w-4 h-4" />
          </div>
          <input
            id="whatsappNumber"
            type="tel"
            placeholder="0803 123 4567"
            value={data.whatsapp_number}
            onChange={handleWhatsAppChange}
            maxLength={13}
            className={`w-full pl-10 pr-3.5 py-2.5 bg-white border rounded-xl text-sm transition focus:outline-none focus:ring-2 font-mono ${
              errors.whatsapp_number
                ? 'border-red-400 focus:ring-red-400 bg-red-50/30'
                : 'border-slate-300 focus:ring-emerald-500 focus:border-emerald-500'
            }`}
          />
        </div>
        {errors.whatsapp_number && (
          <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errors.whatsapp_number}</span>
          </p>
        )}
      </div>

      {/* Business Name */}
      <div>
        <label htmlFor="businessName" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
          Store / Business Name <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Store className="w-4 h-4" />
          </div>
          <input
            id="businessName"
            type="text"
            placeholder="e.g. Lagos Wears &amp; Kicks"
            value={data.business_name}
            onChange={(e) => {
              onChange({ business_name: e.target.value });
              if (errors.business_name) setErrors((prev) => ({ ...prev, business_name: '' }));
            }}
            className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        {errors.business_name && (
          <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errors.business_name}</span>
          </p>
        )}
      </div>

      {/* Business Category */}
      <div>
        <label htmlFor="businessCategory" className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
          Business Category <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Tag className="w-4 h-4" />
          </div>
          <select
            id="businessCategory"
            value={data.category}
            onChange={(e) => onChange({ category: e.target.value })}
            className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800"
          >
            <option value="Clothing">Clothing &amp; Fashion</option>
            <option value="Food">Food &amp; Provisions</option>
            <option value="Electronics">Electronics &amp; Gadgets</option>
            <option value="Beauty">Beauty &amp; Personal Care</option>
            <option value="Other">Other Retail</option>
          </select>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-3">
        <button
          type="submit"
          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          <span>Continue to Payment Setup</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
