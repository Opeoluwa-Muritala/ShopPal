'use client';

import React, { useState } from 'react';

export interface Step1Data {
  name: string;
  phone: string;
  whatsapp_number: string;
  business_name: string;
  category: string;
  email: string;
  password?: string;
}

interface Step1Props {
  data: Step1Data;
  onChange: (data: Partial<Step1Data>) => void;
  onNext: () => void;
}

export default function Step1Business({ data, onChange, onNext }: Step1Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const formatPhone = (val: string): string => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 4) return raw;
    if (raw.length <= 7) return `${raw.slice(0, 4)} ${raw.slice(4)}`;
    return `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    const updates: Partial<Step1Data> = { phone: formatted };
    if (!data.whatsapp_number || data.whatsapp_number === data.phone) {
      updates.whatsapp_number = formatted;
    }
    onChange(updates);
    if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
  };

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    onChange({ whatsapp_number: formatted });
    if (errors.whatsapp_number) setErrors((prev) => ({ ...prev, whatsapp_number: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (data.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    const cleanPhone = data.phone.replace(/\D/g, '');
    if (!cleanPhone) {
      newErrors.phone = 'Phone number is required';
    } else if (cleanPhone.length !== 11) {
      newErrors.phone = 'Phone must be 11 digits';
    } else if (!/^(07|08|09)/.test(cleanPhone)) {
      newErrors.phone = 'Phone must begin with 07, 08, or 09 (Nigerian format)';
    }

    const cleanWA = data.whatsapp_number.replace(/\D/g, '');
    if (cleanWA && cleanWA.length !== 11) {
      newErrors.whatsapp_number = 'WhatsApp number must be 11 digits';
    }

    if (data.email && data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (data.password && data.password.length > 0 && data.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      if (!data.whatsapp_number) {
        onChange({ whatsapp_number: data.phone });
      }
      onNext();
    }
  };

  return (
    <form onSubmit={handleContinue} className="space-y-5" noValidate>
      <div>
        <h2 className="text-xl font-bold text-slate-900">Create Vendor Account</h2>
        <p className="text-xs text-slate-600 mt-1">
          Set up your ShopPal merchant identity to start selling on WhatsApp.
        </p>
      </div>

      {/* Full Name */}
      <div>
        <label htmlFor="fullName" className="block text-xs font-semibold text-slate-900 mb-1">
          Full Name <span className="text-red-600">*</span>
        </label>
        <input
          id="fullName"
          type="text"
          placeholder="Your Full Name"
          value={data.name}
          onChange={(e) => {
            onChange({ name: e.target.value });
            if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
          }}
          className={`w-full px-3 py-2 bg-white border rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ${
            errors.name ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
          }`}
        />
        {errors.name && <p className="mt-1 text-xs text-red-600 font-medium">{errors.name}</p>}
      </div>

      {/* Phone Number */}
      <div>
        <label htmlFor="phoneNumber" className="block text-xs font-semibold text-slate-900 mb-1">
          Phone Number <span className="text-red-600">*</span>
        </label>
        <input
          id="phoneNumber"
          type="tel"
          placeholder="0803 123 4567"
          value={data.phone}
          onChange={handlePhoneChange}
          maxLength={13}
          className={`w-full px-3 py-2 bg-white border rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono ${
            errors.phone ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
          }`}
        />
        {errors.phone ? (
          <p className="mt-1 text-xs text-red-600 font-medium">{errors.phone}</p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500">11 digits starting with 0 (e.g. 080..., 070...)</p>
        )}
      </div>

      {/* WhatsApp Number */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="whatsappNumber" className="block text-xs font-semibold text-slate-900">
            WhatsApp Number
          </label>
          <button
            type="button"
            onClick={() => {
              onChange({ whatsapp_number: data.phone });
            }}
            className="text-[11px] font-medium text-slate-600 hover:text-slate-900 underline"
          >
            Same as phone
          </button>
        </div>
        <input
          id="whatsappNumber"
          type="tel"
          placeholder="0803 123 4567"
          value={data.whatsapp_number}
          onChange={handleWhatsAppChange}
          maxLength={13}
          className={`w-full px-3 py-2 bg-white border rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono ${
            errors.whatsapp_number ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
          }`}
        />
        {errors.whatsapp_number && (
          <p className="mt-1 text-xs text-red-600 font-medium">{errors.whatsapp_number}</p>
        )}
      </div>

      {/* Business Name */}
      <div>
        <label htmlFor="businessName" className="block text-xs font-semibold text-slate-900 mb-1">
          Store / Business Name <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <input
          id="businessName"
          type="text"
          placeholder="Your Business Name"
          value={data.business_name}
          onChange={(e) => {
            onChange({ business_name: e.target.value });
            if (errors.business_name) setErrors((prev) => ({ ...prev, business_name: '' }));
          }}
          className={`w-full px-3 py-2 bg-white border rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ${
            errors.business_name ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
          }`}
        />
        {errors.business_name && (
          <p className="mt-1 text-xs text-red-600 font-medium">{errors.business_name}</p>
        )}
      </div>

      {/* Business Category */}
      <div>
        <label htmlFor="businessCategory" className="block text-xs font-semibold text-slate-900 mb-1">
          Business Category <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <select
          id="businessCategory"
          value={data.category}
          onChange={(e) => onChange({ category: e.target.value })}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        >
          <option value="Clothing">Clothing &amp; Fashion</option>
          <option value="Food">Food &amp; Groceries</option>
          <option value="Electronics">Electronics &amp; Gadgets</option>
          <option value="Beauty">Beauty &amp; Personal Care</option>
          <option value="Other">Other Retail</option>
        </select>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-xs font-semibold text-slate-900 mb-1">
          Account Email Address <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <input
          id="email"
          type="email"
          placeholder="vendor@example.com"
          value={data.email}
          onChange={(e) => {
            onChange({ email: e.target.value });
            if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
          }}
          className={`w-full px-3 py-2 bg-white border rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 ${
            errors.email ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
          }`}
        />
        {errors.email ? (
          <p className="mt-1 text-xs text-red-600 font-medium">{errors.email}</p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500">Used for signing in and receiving payment receipts.</p>
        )}
      </div>

      {/* Password */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="passwordField" className="block text-xs font-semibold text-slate-900">
            Password <span className="text-slate-500 font-normal">(optional)</span>
          </label>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium"
          >
            {showPassword ? 'Hide password' : 'Show password'}
          </button>
        </div>
        <input
          id="passwordField"
          type={showPassword ? 'text' : 'password'}
          placeholder="Min 8 chars, 1 number, 1 symbol"
          value={data.password || ''}
          onChange={(e) => {
            onChange({ password: e.target.value });
            if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
          }}
          className={`w-full px-3 py-2 bg-white border rounded text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono ${
            errors.password ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
          }`}
        />
        {errors.password && (
          <p className="mt-1 text-xs text-red-600 font-medium">{errors.password}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded transition"
        >
          Continue to Payment Setup
        </button>
      </div>
    </form>
  );
}
