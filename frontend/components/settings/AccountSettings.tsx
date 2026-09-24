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
  Users,
  UserPlus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
} from 'lucide-react';
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
        setInviteSuccess(`✅ Invitation sent to ${staffEmail.trim()}!`);
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

      {/* Section: Store Team & Staff */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Store Team &amp; Staff</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Invite store assistants to manage orders and answer WhatsApp queries (`POST /api/accounts/invite-staff`).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 rounded-xl transition shadow-xs self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Staff Member</span>
          </button>
        </div>

        {/* Team Members List */}
        {teamMembers.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 border border-slate-100 rounded-xl mt-4">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No additional team members</p>
            <p className="text-xs text-slate-400 mt-1">
              Invite store assistants or dispatch clerks to manage orders and stock.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 mt-4">
            {teamMembers.map((member) => (
              <div key={member.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase">
                    {member.email.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{member.email}</p>
                    <p className="text-xs text-slate-500 font-mono">{member.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {member.role}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
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
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              type="button"
              onClick={() => {
                setShowInviteModal(false);
                setInviteError(null);
                setInviteSuccess(null);
              }}
              aria-label="Close modal"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              ✕
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Invite Store Staff</h3>
                <p className="text-xs text-slate-500">Provide credentials for your store assistant</p>
              </div>
            </div>

            {inviteSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{inviteSuccess}</span>
              </div>
            )}

            {inviteError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleInviteStaff} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Staff Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="assistant@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Staff Nigerian Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={14}
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(formatNigerianPhone(e.target.value))}
                    placeholder="0803 123 4567"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Temporary Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    placeholder="Temporary password"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Staff will be asked to change this password on first login.</p>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  disabled={isInviting}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Send Invitation</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
