'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  KeyRound,
  LogOut,
  Trash2,
  Lock,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import ConfirmationModal from '../common/ConfirmationModal';

export interface DangerZoneProps {
  vendorId: string;
  onChangePassword: (currentPass: string, newPass: string) => Promise<boolean | void> | boolean | void;
  onLogoutAllSessions: () => Promise<boolean | void> | boolean | void;
  onDeleteAccount: (reason: string) => Promise<boolean | void> | boolean | void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function DangerZone({
  vendorId,
  onChangePassword,
  onLogoutAllSessions,
  onDeleteAccount,
  onShowToast,
}: DangerZoneProps) {
  // Password modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Logout modal state
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('No longer need');
  const [customReason, setCustomReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSubmitPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setPasswordError(null);

    try {
      setIsChangingPassword(true);
      await onChangePassword(currentPassword, newPassword);
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onShowToast('✅ Password changed successfully');
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to update password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleConfirmLogoutAll = async () => {
    try {
      setIsLoggingOut(true);
      await onLogoutAllSessions();
      setIsLogoutModalOpen(false);
      onShowToast('✅ Logged out of all sessions');
    } catch {
      onShowToast('Failed to log out sessions', 'error');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleConfirmDelete = async () => {
    const finalReason = deleteReason === 'Other' ? customReason : deleteReason;
    try {
      setIsDeleting(true);
      await onDeleteAccount(finalReason);
      setIsDeleteModalOpen(false);
      onShowToast('✅ Account deleted. Redirecting...', 'info');
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch {
      onShowToast('Failed to delete account', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="bg-red-50/50 border border-red-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-5 border-b border-red-100">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-950">Danger Zone</h2>
            <p className="text-xs sm:text-sm text-red-700">
              Irreversible and security-critical actions regarding your merchant account credentials.
            </p>
          </div>
        </div>

        <div className="divide-y divide-red-100 mt-4">
          {/* Change Password */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
              <p className="text-xs text-slate-600">
                Update your account password to maintain security.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPasswordError(null);
                setIsPasswordModalOpen(true);
              }}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 px-4 py-2.5 rounded-xl transition shadow-xs shrink-0"
            >
              <KeyRound className="w-4 h-4 text-slate-600" />
              <span>Change Password</span>
            </button>
          </div>

          {/* Log Out All Sessions */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Log Out All Sessions</h3>
              <p className="text-xs text-slate-600">
                Revoke access from all browsers and devices currently signed into this vendor account.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-900 bg-amber-100/80 hover:bg-amber-200 border border-amber-300 px-4 py-2.5 rounded-xl transition shadow-xs shrink-0"
            >
              <LogOut className="w-4 h-4 text-amber-700" />
              <span>Log Out All Sessions</span>
            </button>
          </div>

          {/* Delete Account */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-red-950">Delete Account</h3>
              <p className="text-xs text-red-800">
                Permanently delete your vendor store, products, and WhatsApp bot configuration. This cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-600/20 px-4 py-2.5 rounded-xl transition shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Change Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPasswordChange} className="space-y-3.5 pt-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                  placeholder="••••••••"
                />
              </div>

              {passwordError && (
                <p className="text-xs font-semibold text-red-600 pt-1">{passwordError}</p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={isChangingPassword}
                  className="text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 rounded-xl transition disabled:opacity-50"
                >
                  {isChangingPassword ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Out All Sessions Confirmation Modal */}
      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        title="Log out of all devices?"
        description="Are you sure you want to end all active login sessions? You will need to sign in again on all your devices."
        confirmText="Log Out All Sessions"
        cancelText="Cancel"
        isDanger={false}
        isLoading={isLoggingOut}
        onConfirm={handleConfirmLogoutAll}
        onCancel={() => setIsLogoutModalOpen(false)}
      />

      {/* Delete Account Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Are you sure? This is permanent."
        description="Your shop will close immediately. All catalog products, WhatsApp bot connections, order records, and settings will be permanently wiped."
        confirmText="Yes, Delete My Account"
        cancelText="Keep My Account"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      >
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Please tell us why you are leaving:
            </label>
            <select
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
            >
              <option value="No longer need">No longer need</option>
              <option value="Moving to another platform">Moving to another platform</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {deleteReason === 'Other' && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Reason Details:
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Give us a brief reason..."
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
              />
            </div>
          )}
        </div>
      </ConfirmationModal>
    </div>
  );
}
