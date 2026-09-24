/**
 * Authentication & session management for Naija Marketplace
 * Handles JWT tokens, refresh rotation, logout, and credentials storage.
 */

const ACCESS_TOKEN_KEY = 'nm_access_token';
const REFRESH_TOKEN_KEY = 'nm_refresh_token';
const VENDOR_ID_KEY = 'nm_vendor_id';
const ACCOUNT_ID_KEY = 'nm_account_id';
const USER_EMAIL_KEY = 'nm_user_email';
const USER_ROLE_KEY = 'nm_user_role';
const API_KEY_STORAGE = 'nm_frontend_api_key';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  vendor_id?: string;
  account_id?: string;
  email?: string;
  role?: string;
}

export interface UserSession {
  accessToken: string | null;
  refreshToken: string | null;
  vendorId: string | null;
  accountId: string | null;
  email: string | null;
  role: string | null;
  isAuthenticated: boolean;
}

/**
 * Retrieve saved tokens from localStorage safely
 */
export function getStoredTokens(): AuthTokens {
  if (typeof window === 'undefined') {
    return { access_token: '', refresh_token: '' };
  }
  return {
    access_token: localStorage.getItem(ACCESS_TOKEN_KEY) || '',
    refresh_token: localStorage.getItem(REFRESH_TOKEN_KEY) || '',
    vendor_id: localStorage.getItem(VENDOR_ID_KEY) || undefined,
    account_id: localStorage.getItem(ACCOUNT_ID_KEY) || undefined,
    email: localStorage.getItem(USER_EMAIL_KEY) || undefined,
    role: localStorage.getItem(USER_ROLE_KEY) || 'owner',
  };
}

/**
 * Persist tokens & session info into localStorage
 */
export function setStoredTokens(tokens: Partial<AuthTokens>): void {
  if (typeof window === 'undefined') return;

  if (tokens.access_token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  }
  if (tokens.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }
  if (tokens.vendor_id) {
    localStorage.setItem(VENDOR_ID_KEY, tokens.vendor_id);
  }
  if (tokens.account_id) {
    localStorage.setItem(ACCOUNT_ID_KEY, tokens.account_id);
  }
  if (tokens.email) {
    localStorage.setItem(USER_EMAIL_KEY, tokens.email);
  }
  if (tokens.role) {
    localStorage.setItem(USER_ROLE_KEY, tokens.role);
  }

  // Dispatch custom event for reactive UI updates across tabs/components
  window.dispatchEvent(new Event('nm-auth-changed'));
}

/**
 * Clear stored auth session
 */
export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(VENDOR_ID_KEY);
  localStorage.removeItem(ACCOUNT_ID_KEY);
  localStorage.removeItem(USER_EMAIL_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  window.dispatchEvent(new Event('nm-auth-changed'));
}

/**
 * Get configured Frontend API Key (X-API-Key)
 */
export function getFrontendApiKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(API_KEY_STORAGE);
    if (saved) return saved;
  }
  return process.env.NEXT_PUBLIC_FRONTEND_API_KEY || 'frontend-default-key';
}

/**
 * Set custom frontend API key (e.g. from Settings or Diagnostics)
 */
export function setFrontendApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(API_KEY_STORAGE, key);
}

/**
 * Get current user session snapshot
 */
export function getCurrentSession(): UserSession {
  const tokens = getStoredTokens();
  return {
    accessToken: tokens.access_token || null,
    refreshToken: tokens.refresh_token || null,
    vendorId: tokens.vendor_id || null,
    accountId: tokens.account_id || null,
    email: tokens.email || null,
    role: tokens.role || null,
    isAuthenticated: Boolean(tokens.access_token),
  };
}
