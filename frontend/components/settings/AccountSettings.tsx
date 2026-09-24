'use client';

import React, { useState } from 'react';
import EditableField from '../common/EditableField';
import { PersonalInfo, AccountStatusInfo } from './types';
import { accountsApi } from '../../lib/api';

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
  if (!val.trim()) return null;
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

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPassword, setStaffPassword] = useState('StaffTemp2025!');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<
    Array<{
      id: string;
      email: string;
      phone: string;
      role: string;
      status: string;
    }>
  >([]);

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail.trim() || !staffPhone.trim() || !staffPassword.trim()) {
      setInviteError('Please fill in all staff details');
      return;
    }
    const cleanPhone = staffPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 11) {
      setInviteError('Staff phone must be an 11-digit Nigerian number');
      return;
    }
    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const res = await accountsApi.inviteStaff({
        email: staffEmail.trim(),
        phone: cleanPhone,
        temp_password: staffPassword.trim(),
      });

      if (res.data?.account_id || res.status === 200 || res.status === 201) {
        const newMember = {
          id: res.data?.account_id || `acc_${Date.now()}`,
          email: staffEmail.trim(),
          phone: staffPhone.trim(),
          role: res.data?.role || 'Staff / Assistant',
          status: res.data?.status || 'Invited',
        };
        setTeamMembers((prev) => [...prev, newMember]);
        setInviteSuccess(`Invitation sent to ${staffEmail.trim()}`);
        onShowToast(`Staff member invited: ${staffEmail.trim()}`, 'success');
        setStaffEmail('');
        setStaffPhone('');
        setTimeout(() => {
          setShowInviteModal(false);
          setInviteSuccess(null);
        }, 1500);
      } else {
        setInviteError(res.error || 'Failed to dispatch staff invitation.');
      }
    } catch (err: any) {
      setInviteError(err?.message || 'Failed to dispatch staff invitation.');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section: Personal Information */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Personal Information</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your merchant contacts and store identity.
          </p>
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
              onShowToast('Full name updated successfully');
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
              onShowToast('Phone number updated successfully');
            }}
          />

          <EditableField
            id="whatsapp-number"
            label="WhatsApp Number"
            value={personalInfo.whatsappNumber}
            type="tel"
            autoFormat={formatNigerianPhone}
            validate={validatePhone}
            hint="WhatsApp phone number"
            onSave={async (newVal) => {
              await onUpdatePersonalInfo('whatsappNumber', newVal);
              onShowToast('WhatsApp number updated successfully');
            }}
          />

          <EditableField
            id="business-name"
            label="Business Name"
            value={personalInfo.businessName}
            validate={validateBusinessName}
            maxLength={100}
            hint="Store name displayed in WhatsApp chat"
            onSave={async (newVal) => {
              await onUpdatePersonalInfo('businessName', newVal);
              onShowToast('Business name updated successfully');
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
              hint="Used for order notifications and account access"
              onSave={async (newVal) => {
                await onUpdatePersonalInfo('email', newVal);
                onShowToast('Email address updated successfully');
              }}
            />
          </div>
        </div>
      </div>

      {/* Section: Account Status */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Account Status</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            System verification, assigned vendor ID, and bot connection.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="border border-slate-200 rounded p-4 bg-slate-50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Status
            </span>
            <div className="mt-1">
              <span className="inline-block px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Active
              </span>
            </div>
          </div>

          <div className="border border-slate-200 rounded p-4 bg-slate-50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Account Created
            </span>
            <span className="text-sm font-semibold text-slate-900 block mt-1">
              {accountStatus.accountCreated}
            </span>
          </div>

          <div className="border border-slate-200 rounded p-4 bg-slate-50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Vendor ID
            </span>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-sm font-mono font-bold text-slate-900">
                {accountStatus.vendorId}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(accountStatus.vendorId, true)}
                title="Copy Vendor ID"
                className="text-xs font-medium text-slate-700 bg-white border border-slate-300 px-2 py-0.5 rounded transition"
              >
                {copiedVendorId ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded p-4 bg-slate-50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Bot Number
            </span>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-sm font-mono font-bold text-slate-900">
                {accountStatus.botWhatsAppNumber}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(accountStatus.botWhatsAppNumber, false)}
                title="Copy Bot WhatsApp Number"
                className="text-xs font-medium text-slate-700 bg-white border border-slate-300 px-2 py-0.5 rounded transition"
              >
                {copiedBotNumber ? 'Copied' : 'Copy'}
              </button>

            </div>
          </div>
        </div>
      </div>

      {/* Section: Store Team & Staff */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Store Team &amp; Staff</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Invite assistants to manage orders and stock.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-2 rounded transition self-start sm:self-auto"
          >
            Invite Staff Member
          </button>
        </div>

        {teamMembers.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 mt-4">
            No additional team members invited yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 mt-4">
            {teamMembers.map((member) => (
              <div key={member.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <p className="font-bold text-slate-900">{member.email}</p>
                  <p className="text-slate-500 font-mono">{member.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {member.role}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    {member.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Staff Modal */}
      {showInviteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg max-w-md w-full p-6 border border-slate-200 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Invite Store Staff</h3>
                <p className="text-xs text-slate-500">Provide credentials for your store assistant</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteError(null);
                  setInviteSuccess(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 p-1 border border-slate-200 rounded"
              >
                Close
              </button>
            </div>

            {inviteSuccess && (
              <div className="mb-4 p-3 bg-slate-100 border border-slate-300 rounded text-slate-800 text-xs font-medium">
                {inviteSuccess}
              </div>
            )}

            {inviteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs font-medium">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInviteStaff} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Staff Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="assistant@example.com"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Staff Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  maxLength={14}
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(formatNigerianPhone(e.target.value))}
                  placeholder="0803 123 4567"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Temporary Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Temporary password"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900 font-mono"
                />
                <p className="mt-1 text-[11px] text-slate-400">Staff will be asked to change this password on first login.</p>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  disabled={isInviting}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded transition"
                >
                  {isInviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
