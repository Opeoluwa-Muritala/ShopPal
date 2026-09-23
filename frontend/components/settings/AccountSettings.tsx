'use client';

import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  Copy,
  Check,
  Calendar,
  Smartphone,
  Store,
  Hash,
} from 'lucide-react';
import EditableField from '../common/EditableField';
import { PersonalInfo, AccountStatusInfo } from './types';

export interface AccountSettingsProps {
  personalInfo: PersonalInfo;
  accountStatus: AccountStatusInfo;
  onUpdatePersonalInfo: (field: keyof PersonalInfo, value: string) => Promise<boolean | void> | boolean | void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const formatNigerianPhone = (val: string): string => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 11)}`;
};

export const validateName = (val: string): string | null => {
  const trimmed = val.trim();
  if (!trimmed || trimmed.length < 2) return 'Full name must be at least 2 characters';
  if (trimmed.length > 100) return 'Full name must not exceed 100 characters';
  return null;
};

export const validatePhone = (val: string): string | null => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return 'Phone number is required';
  if (digits.length !== 11) return 'Nigerian phone number must be exactly 11 digits (e.g. 0701 234 5678)';
  if (!digits.startsWith('0')) return 'Nigerian phone number must begin with 0';
  return null;
};

export const validateBusinessName = (val: string): string | null => {
  if (val && val.length > 100) return 'Business name must not exceed 100 characters';
  return null;
};

export const validateEmail = (val: string): string | null => {
  if (!val.trim()) return null; // optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(val.trim()) ? null : 'Please enter a valid email address';
};

export default function AccountSettings({
  personalInfo,
  accountStatus,
  onUpdatePersonalInfo,
  onShowToast,
}: AccountSettingsProps) {
  const [copiedVendorId, setCopiedVendorId] = useState(false);
  const [copiedBotNumber, setCopiedBotNumber] = useState(false);

  const copyToClipboard = async (text: string, isVendorId: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isVendorId) {
        setCopiedVendorId(true);
        setTimeout(() => setCopiedVendorId(false), 2000);
      } else {
        setCopiedBotNumber(true);
        setTimeout(() => setCopiedBotNumber(false), 2000);
      }
      onShowToast('Copied to clipboard!', 'info');
    } catch {
      onShowToast('Failed to copy', 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Section: Personal Information */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Personal Information</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Manage your personal contacts and store identity visible on customer receipts.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <EditableField
            id="full-name"
            label="Full Name"
            value={personalInfo.fullName}
            validate={validateName}
            maxLength={100}
            hint="Min 2 characters, max 100"
            onSave={async (newVal) => {
              await onUpdatePersonalInfo('fullName', newVal);
              onShowToast('✅ Full name updated successfully');
            }}
          />

          <EditableField
            id="phone-number"
            label="Phone Number"
            value={personalInfo.phone}
            type="tel"
            autoFormat={formatNigerianPhone}
            validate={validatePhone}
            hint="Nigerian 11-digit mobile number"
            onSave={async (newVal) => {
              await onUpdatePersonalInfo('phone', newVal);
              onShowToast('✅ Phone number updated successfully');
            }}
          />

          <EditableField
            id="whatsapp-number"
            label="WhatsApp Number"
            value={personalInfo.whatsappNumber}
            type="tel"
            autoFormat={formatNigerianPhone}
            validate={validatePhone}
            hint="Can be identical to phone or separate"
            onSave={async (newVal) => {
              await onUpdatePersonalInfo('whatsappNumber', newVal);
              onShowToast('✅ WhatsApp number updated successfully');
            }}
          />

          <EditableField
            id="business-name"
            label="Business Name"
            value={personalInfo.businessName}
            validate={validateBusinessName}
            maxLength={100}
            hint="Your brand displayed in WhatsApp chat"
            onSave={async (newVal) => {
              await onUpdatePersonalInfo('businessName', newVal);
              onShowToast('✅ Business name updated successfully');
            }}
          />

          <div className="md:col-span-2">
            <EditableField
              id="email-address"
              label="Email Address"
              value={personalInfo.email}
              type="email"
              validate={validateEmail}
              placeholder="e.g. vendor@example.com"
              hint="Used for critical order receipts and account recovery"
              onSave={async (newVal) => {
                await onUpdatePersonalInfo('email', newVal);
                onShowToast('✅ Email address updated successfully');
              }}
            />
          </div>
        </div>
      </div>

      {/* Section: Account Status */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Account Status</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              System verification status, assigned vendor identifier, and bot connection.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Status Badge */}
          <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
              Account Status
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                ✅ Active
              </span>
            </div>
          </div>

          {/* Account Created */}
          <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
              Account Created
            </span>
            <div className="flex items-center gap-2 mt-1 text-sm font-semibold text-slate-900">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>{accountStatus.accountCreated}</span>
            </div>
          </div>

          {/* Vendor ID */}
          <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
              Vendor ID
            </span>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-sm font-mono font-bold text-slate-900">
                {accountStatus.vendorId}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(accountStatus.vendorId, true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-700 bg-white border border-slate-200 hover:border-emerald-300 px-2 py-1 rounded-lg transition"
                title="Copy Vendor ID"
              >
                {copiedVendorId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedVendorId ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Bot WhatsApp Number */}
          <div className="border border-slate-200/90 rounded-xl p-4 bg-slate-50/50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
              Bot WhatsApp Number
            </span>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-sm font-mono font-bold text-slate-900">
                {accountStatus.botWhatsAppNumber}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(accountStatus.botWhatsAppNumber, false)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-700 bg-white border border-slate-200 hover:border-emerald-300 px-2 py-1 rounded-lg transition"
                title="Copy Bot Number"
              >
                {copiedBotNumber ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedBotNumber ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
