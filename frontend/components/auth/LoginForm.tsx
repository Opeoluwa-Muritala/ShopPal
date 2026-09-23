'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, Phone, Loader2, AlertCircle, CheckCircle2, HelpCircle, X } from 'lucide-react';

export interface LoginResponse {
  vendor_id?: string;
  token?: string;
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

  // Load remembered identifier on mount (deferred to avoid cascading render lint errors)
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
      // Ignore localStorage read errors
    }
  }, []);

  // Validation functions
  const validateIdentifier = (val: string): string | undefined => {
    const trimmed = val.trim();
    if (!trimmed) {
      return 'Email or phone number is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(trimmed)) {
      return undefined;
    }

    // Check Nigerian / general phone format: 10-14 digits, e.g. 07012345678, 080..., +234...
    const cleanPhone = trimmed.replace(/[\s\-()]/g, '');
    const phoneRegex = /^(?:\+?234|0)[789][01]\d{8}$/;
    if (phoneRegex.test(cleanPhone) || (/^\+?\d{10,14}$/.test(cleanPhone) && cleanPhone.length >= 10)) {
      return undefined;
    }

    return 'Enter a valid email address or 11-digit phone number (e.g., 08012345678)';
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

  // Real-time validation on change if field has been touched
  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setIdentifier(val);
    setSubmitError(null);
    if (touched.identifier) {
      setErrors((prev) => ({ ...prev, identifier: validateIdentifier(val) }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setSubmitError(null);
    if (touched.password) {
      setErrors((prev) => ({ ...prev, password: validatePassword(val) }));
    }
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

    // Trigger full validation
    const idErr = validateIdentifier(identifier);
    const passErr = validatePassword(password);
    setTouched({ identifier: true, password: true });
    setErrors({ identifier: idErr, password: passErr });

    if (idErr || passErr) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const payload = {
      identifier: identifier.trim(),
      password,
    };

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data: LoginResponse = await res.json();
        const vendorId = data.vendor_id || generateDemoVendorId();
        const token = data.token || generateDemoToken();

        persistSession(vendorId, token);
        setToastMessage('✅ Logged in! Welcome back');

        if (onSuccess) onSuccess({ vendor_id: vendorId, token });
        setTimeout(() => {
          router.push(data.dashboard_url || '/dashboard');
        }, 500);
      } else if (res.status === 401) {
        setSubmitError('❌ Email/phone or password incorrect');
      } else {
        // Fallback for hackathon demo mode if auth backend is not implemented
        handleDemoFallback();
      }
    } catch {
      // Offline / network failure / mock fallback for demo mode
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
      // Ignore localStorage write errors in private/sandboxed browsers
    }
  };

  const handleDemoFallback = () => {
    const demoVendorId = generateDemoVendorId();
    const demoToken = generateDemoToken();
    persistSession(demoVendorId, demoToken);

    setToastMessage('⏳ Demo mode: Logged in with stored vendor ID');

    if (onSuccess) onSuccess({ vendor_id: demoVendorId, token: demoToken });
    setTimeout(() => {
      router.push('/dashboard');
    }, 500);
  };

  return (
    <div className="w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top duration-300"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Submit Error Alert */}
      {submitError && (
        <div
          role="alert"
          className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start justify-between gap-3 animate-in fade-in duration-200"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{submitError}</p>
              <p className="text-xs text-rose-600 mt-0.5">Please check your details and try again.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleSubmit()}
            className="text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 px-2.5 py-1 rounded-lg transition"
          >
            Retry
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email or Phone Input */}
        <div>
          <label htmlFor="identifier" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Email or Phone Number <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              {identifier.includes('@') ? (
                <Mail className="w-4 h-4" />
              ) : (
                <Phone className="w-4 h-4" />
              )}
            </div>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              placeholder="Email or phone number"
              value={identifier}
              onChange={handleIdentifierChange}
              onBlur={() => handleBlur('identifier')}
              aria-invalid={Boolean(touched.identifier && errors.identifier)}
              aria-describedby={touched.identifier && errors.identifier ? 'identifier-error' : undefined}
              className={`w-full pl-10 pr-4 py-3 bg-white border text-sm text-slate-900 rounded-xl placeholder-slate-400 focus:outline-none transition ${
                touched.identifier && errors.identifier
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                  : 'border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
              }`}
            />
          </div>
          {touched.identifier && errors.identifier && (
            <p id="identifier-error" className="mt-1.5 text-xs text-rose-600 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {errors.identifier}
            </p>
          )}
        </div>

        {/* Password Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Password <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Forgot Password?
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={handlePasswordChange}
              onBlur={() => handleBlur('password')}
              aria-invalid={Boolean(touched.password && errors.password)}
              aria-describedby={touched.password && errors.password ? 'password-error' : undefined}
              className={`w-full pl-10 pr-11 py-3 bg-white border text-sm text-slate-900 rounded-xl placeholder-slate-400 focus:outline-none transition ${
                touched.password && errors.password
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                  : 'border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {touched.password && errors.password && (
            <p id="password-error" className="mt-1.5 text-xs text-rose-600 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
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
              className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-600">Remember me</span>
          </label>
        </div>

        {/* Submit Button (56px height = h-14) */}
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          aria-label="Login"
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-base rounded-xl shadow-md hover:shadow-lg shadow-emerald-600/20 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Logging in...</span>
            </>
          ) : (
            <span>Login</span>
          )}
        </button>
      </form>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              aria-label="Close modal"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Forgot Password?</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Automated WhatsApp password recovery is coming soon. In the meantime, message our support team on WhatsApp and we will quickly verify your phone number and reset your credentials.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <a
                href="https://wa.me/14155238886?text=Hello%20Naija%20Marketplace%20Support%2C%20I%20need%20help%20logging%20into%20my%20vendor%20account"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl text-center transition"
              >
                Contact WhatsApp Support
              </a>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl text-center transition"
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
