'use client';

import React, { useState } from 'react';
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

    try {
      setIsChangingPassword(true);
      setPasswordError(null);
      await onChangePassword(currentPassword, newPassword);
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onShowToast('Password updated successfully');
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
      onShowToast('All active sessions revoked');
    } catch {
      onShowToast('Failed to log out all sessions', 'error');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleConfirmDelete = async () => {
    const finalReason = deleteReason === 'Other' ? customReason : deleteReason;
    try {
      setIsDeleting(true);
      await onDeleteAccount(finalReason || 'Unspecified reason');
      setIsDeleteModalOpen(false);
      onShowToast('Account scheduled for deletion');
    } catch {
      onShowToast('Failed to delete account', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Change Password Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Update your merchant dashboard login password.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsPasswordModalOpen(true);
              setPasswordError(null);
            }}
            className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition self-start sm:self-auto"
          >
            Change Password
          </button>
        </div>
      </div>

      {/* Log Out All Sessions Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Log Out All Sessions</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Revoke all active tokens across devices (`POST /api/auth/logout-all`).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition self-start sm:self-auto"
          >
            Log Out All Sessions
          </button>
        </div>
      </div>

      {/* Delete Account Card */}
      <div className="bg-white border border-red-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-red-900">Delete Account</h3>
            <p className="text-xs text-red-600 mt-0.5">
              Permanently remove your store catalog, credentials, and order history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="text-xs font-semibold text-white bg-red-700 hover:bg-red-800 px-3 py-1.5 rounded transition self-start sm:self-auto"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg max-w-md w-full p-6 border border-slate-200 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Change Password</h3>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-800 p-1 border border-slate-200 rounded"
              >
                Close
              </button>
            </div>

            {passwordError && (
              <p className="text-xs text-red-600 font-medium mb-3">{passwordError}</p>
            )}

            <form onSubmit={handleSubmitPasswordChange} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={isChangingPassword}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded transition"
                >
                  {isChangingPassword ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout All Sessions Modal */}
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

      {/* Delete Account Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Are you sure? This is permanent."
        description="This will permanently delete your store account and revoke access to all WhatsApp bot integrations."
        confirmText="Permanently Delete Account"
        cancelText="Cancel"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      >

        <div className="space-y-2 mt-3">
          <label className="block text-xs font-semibold text-slate-700">
            Please tell us why you are leaving:
          </label>
          <select
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
          >
            <option value="No longer need">No longer need</option>
            <option value="Switching platforms">Switching platforms</option>
            <option value="Temporary closure">Temporary closure</option>
            <option value="Other">Other</option>
          </select>
          {deleteReason === 'Other' && (
            <textarea
              rows={2}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Your feedback..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
            />
          )}
        </div>
      </ConfirmationModal>
    </div>
  );
}
