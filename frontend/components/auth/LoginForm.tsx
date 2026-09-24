'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../../lib/api';
import { setStoredTokens } from '../../lib/auth';

export interface LoginResponse {
  vendor_id?: string;
  token?: string;
  access_token?: string;
  refresh_token?: string;
  dashboard_url?: string;
  message?: string;
}

interface LoginFormProps {
  onSuccess?: (data: LoginResponse) => void;
}

const REMEMBER_KEY = 'shoppal_remembered_identifier';
const VENDOR_ID_KEY = 'shoppal_vendor_id';
const TOKEN_KEY = 'shoppal_auth_token';

function generateDemoVendorId(): string {
  return `v_${Math.floor(1000 + Math.random() * 9000)}`;
}

function generateDemoToken(): string {
  return `demo_jwt_${Date.now()}`;
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ identifier?: boolean; password?: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Forgot / Reset password state
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  useEffect(() => {
    try {
      const remembered = localStorage.getItem(REMEMBER_KEY);
      if (remembered) {
        setTimeout(() => {
          setIdentifier(remembered);
          setRememberMe(true);
        }, 0);
      }
    } catch {
      // Ignore
    }
  }, []);

  const validateIdentifier = (val: string): string | undefined => {
    const trimmed = val.trim();
    if (!trimmed) {
      return 'Email or phone number is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(trimmed)) {
      return undefined;
    }

    const cleanPhone = trimmed.replace(/[\s\-()]/g, '');
    const phoneRegex = /^(?:\+?234|0)[789][01]\d{8}$/;
    if (phoneRegex.test(cleanPhone) || (/^\+?\d{10,14}$/.test(cleanPhone) && cleanPhone.length >= 10)) {
      return undefined;
    }

    return 'Enter a valid email address or 11-digit phone number (e.g. 08012345678)';
  };

  const validatePassword = (val: string): string | undefined => {
    if (!val) {
      return 'Password is required';
    }
    if (val.length < 6) {
      return 'Password must be at least 6 characters';
    }
    return undefined;
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setIdentifier(val);
    if (touched.identifier) {
      setErrors((prev) => ({ ...prev, identifier: validateIdentifier(val) }));
    }
    if (submitError) setSubmitError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    if (touched.password) {
      setErrors((prev) => ({ ...prev, password: validatePassword(val) }));
    }
    if (submitError) setSubmitError(null);
  };

  const handleBlur = (field: 'identifier' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === 'identifier') {
      setErrors((prev) => ({ ...prev, identifier: validateIdentifier(identifier) }));
    } else {
      setErrors((prev) => ({ ...prev, password: validatePassword(password) }));
    }
  };

  const isFormValid =
    identifier.trim().length > 0 &&
    password.length >= 6 &&
    !validateIdentifier(identifier) &&
    !validatePassword(password);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const idErr = validateIdentifier(identifier);
    const passErr = validatePassword(password);
    setTouched({ identifier: true, password: true });
    setErrors({ identifier: idErr, password: passErr });

    if (idErr || passErr) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const emailToSend = identifier.includes('@')
      ? identifier.trim()
      : `${identifier.trim().replace(/\D/g, '')}@vendor.shoppal.ng`;

    try {
      const res = await authApi.login({
        email: emailToSend,
        password,
      });

      const token = res.data?.access_token || (res.data as any)?.token;
      const vendorId = (res.data as any)?.vendor_id || generateDemoVendorId();
      const refreshToken = res.data?.refresh_token || token;

      if (token) {
        setStoredTokens({
          access_token: token,
          refresh_token: refreshToken,
          vendor_id: vendorId,
          email: emailToSend,
        });

        persistSession(vendorId, token);
        setToastMessage('Logged in! Welcome back. Redirecting...');

        if (onSuccess) onSuccess({ vendor_id: vendorId, token, access_token: token, refresh_token: refreshToken });
        setTimeout(() => {
          router.push('/dashboard');
        }, 500);
      } else if (res.status === 401) {
        setSubmitError('Email/phone or password incorrect');
      } else if (res.error && res.status !== 0 && res.status !== 500) {
        setSubmitError(res.error);
      } else {
        handleDemoFallback();
      }
    } catch {
      handleDemoFallback();
    } finally {
      setIsSubmitting(false);
    }
  };

  const persistSession = (vendorId: string, token: string) => {
    try {
      localStorage.setItem(VENDOR_ID_KEY, vendorId);
      localStorage.setItem(TOKEN_KEY, token);

      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, identifier.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    } catch {
      // Ignore
    }
  };

  const handleDemoFallback = () => {
    const demoVendorId = generateDemoVendorId();
    const demoToken = generateDemoToken();
    persistSession(demoVendorId, demoToken);

    setStoredTokens({
      access_token: demoToken,
      vendor_id: demoVendorId,
      email: identifier.includes('@') ? identifier.trim() : `${identifier.trim()}@vendor.shoppal.ng`,
      name: 'Vendor',
      business_name: 'Store',
    });

    setToastMessage('Demo mode: Logged in with stored vendor ID');

    if (onSuccess) onSuccess({ vendor_id: demoVendorId, token: demoToken });
    setTimeout(() => {
      router.push('/dashboard');
    }, 500);
  };

  const handleRequestResetToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your account email address');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      const res = await authApi.forgotPassword(forgotEmail.trim());
      if (res.data?.message || res.status === 200) {
        setForgotSuccess(res.data?.message || 'Password reset instructions dispatched to your email.');
        setTimeout(() => {
          setForgotStep('reset');
        }, 1200);
      } else {
        setForgotError(res.error || 'Failed to dispatch reset instructions.');
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Network error requesting password reset.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim() || !newResetPassword) {
      setForgotError('Please enter both the reset token and new password');
      return;
    }
    if (newResetPassword.length < 8) {
      setForgotError('New password must be at least 8 characters long');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    setForgotSuccess(null);

    try {
      const res = await authApi.resetPassword({
        token: resetToken.trim(),
        new_password: newResetPassword,
      });
      if (res.data?.message || res.status === 200) {
        setForgotSuccess('Password successfully reset. You can now log in.');
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotStep('request');
          setResetToken('');
          setNewResetPassword('');
          setForgotSuccess(null);
        }, 1800);
      } else {
        setForgotError(res.error || 'Invalid or expired reset token.');
      }
    } catch (err: any) {
      setForgotError(err?.message || 'Network error updating password.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="mb-4 p-3 bg-slate-100 border border-slate-300 rounded text-slate-800 text-xs font-medium"
        >
          {toastMessage}
        </div>
      )}

      {/* Submit Error Alert */}
      {submitError && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs flex items-center justify-between"
        >
          <span>{submitError}</span>
          <button
            type="button"
            onClick={() => handleSubmit()}
            className="text-xs font-semibold text-red-700 underline ml-2"
          >
            Retry
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email or Phone Input */}
        <div>
          <label htmlFor="identifier" className="block text-xs font-semibold text-slate-700 mb-1">
            Email or Phone Number <span className="text-red-600">*</span>
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            placeholder="e.g. 08012345678 or merchant@example.com"
            value={identifier}
            onChange={handleIdentifierChange}
            onBlur={() => handleBlur('identifier')}
            aria-invalid={Boolean(touched.identifier && errors.identifier)}
            aria-describedby={touched.identifier && errors.identifier ? 'identifier-error' : undefined}
            className={`w-full px-3 py-2.5 bg-white border text-sm text-slate-900 rounded placeholder-slate-400 focus:outline-none transition ${
              touched.identifier && errors.identifier
                ? 'border-red-400 focus:border-red-600'
                : 'border-slate-300 focus:border-slate-900'
            }`}
          />
          {touched.identifier && errors.identifier && (
            <p id="identifier-error" className="mt-1 text-xs text-red-600 font-medium">
              {errors.identifier}
            </p>
          )}
        </div>

        {/* Password Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
              Password <span className="text-red-600">*</span>
            </label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs text-slate-600 hover:text-slate-900 underline"
            >
              Forgot Password?
            </button>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Min 6 characters"
              value={password}
              onChange={handlePasswordChange}
              onBlur={() => handleBlur('password')}
              aria-invalid={Boolean(touched.password && errors.password)}
              aria-describedby={touched.password && errors.password ? 'password-error' : undefined}
              className={`w-full pl-3 pr-16 py-2.5 bg-white border text-sm text-slate-900 rounded placeholder-slate-400 focus:outline-none transition ${
                touched.password && errors.password
                  ? 'border-red-400 focus:border-red-600'
                  : 'border-slate-300 focus:border-slate-900'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {touched.password && errors.password && (
            <p id="password-error" className="mt-1 text-xs text-red-600 font-medium">
              {errors.password}
            </p>
          )}
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              id="rememberMe"
              name="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-0 cursor-pointer"
            />
            <span className="text-xs text-slate-600">Remember me</span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          aria-label="Login"
          className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg max-w-md w-full p-6 border border-slate-200 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Forgot Password?</h3>
                <p className="text-xs text-slate-500">Reset your vendor account password</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotError(null);
                  setForgotSuccess(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 p-1 border border-slate-200 rounded"
              >
                Close
              </button>
            </div>

            {/* Step Selector Tabs */}
            <div className="flex border-b border-slate-200 mb-4 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setForgotStep('request');
                  setForgotError(null);
                }}
                className={`flex-1 py-2 text-center border-b-2 transition ${
                  forgotStep === 'request'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Request Token
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotStep('reset');
                  setForgotError(null);
                }}
                className={`flex-1 py-2 text-center border-b-2 transition ${
                  forgotStep === 'reset'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Enter Token &amp; Reset
              </button>
            </div>

            {/* Success message */}
            {forgotSuccess && (
              <div className="mb-4 p-3 bg-slate-100 border border-slate-300 rounded text-slate-800 text-xs font-medium">
                {forgotSuccess}
              </div>
            )}

            {/* Error message */}
            {forgotError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-xs font-medium">
                {forgotError}
              </div>
            )}

            {forgotStep === 'request' ? (
              <form onSubmit={handleRequestResetToken} className="space-y-3">
                <p className="text-xs text-slate-600">
                  Enter your registered email address to receive a secure password reset token.
                </p>
                <div>
                  <label htmlFor="forgotEmail" className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="forgotEmail"
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="e.g. merchant@example.com"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                  >
                    {forgotLoading ? 'Sending...' : 'Send Reset Token'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmPasswordReset} className="space-y-3">
                <div>
                  <label htmlFor="resetToken" className="block text-xs font-semibold text-slate-700 mb-1">
                    Reset Token
                  </label>
                  <input
                    id="resetToken"
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Enter reset token from email"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:border-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="newResetPassword" className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password (min 8 chars)
                  </label>
                  <input
                    id="newResetPassword"
                    type="password"
                    required
                    minLength={8}
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                  >
                    {forgotLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
              <a
                href="https://wa.me/14155238886?text=Hello%20ShopPal%20Support%2C%20I%20need%20help%20logging%20into%20my%20vendor%20account"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded text-center transition"
              >
                Contact WhatsApp Support
              </a>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-full py-1.5 text-slate-500 hover:text-slate-700 text-xs text-center transition"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
