/**
 * Authentication & session management for ShopPal
 * Handles JWT tokens, refresh rotation, logout, and vendor identity credentials.
 */

const ACCESS_TOKEN_KEY = 'shoppal_access_token';
const REFRESH_TOKEN_KEY = 'shoppal_refresh_token';
const VENDOR_ID_KEY = 'shoppal_vendor_id';
const ACCOUNT_ID_KEY = 'shoppal_account_id';
const USER_EMAIL_KEY = 'shoppal_user_email';
const USER_ROLE_KEY = 'shoppal_user_role';
const VENDOR_NAME_KEY = 'shoppal_vendor_name';
const BUSINESS_NAME_KEY = 'shoppal_business_name';
const VENDOR_PHONE_KEY = 'shoppal_vendor_phone';
const API_KEY_STORAGE = 'shoppal_frontend_api_key';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  vendor_id?: string;
  account_id?: string;
  email?: string;
  role?: string;
  name?: string;
  business_name?: string;
  phone?: string;
}

export interface UserSession {
  accessToken: string | null;
  refreshToken: string | null;
  vendorId: string | null;
  accountId: string | null;
  email: string | null;
  role: string | null;
  name: string | null;
  businessName: string | null;
  phone: string | null;
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
    name: localStorage.getItem(VENDOR_NAME_KEY) || undefined,
    business_name: localStorage.getItem(BUSINESS_NAME_KEY) || undefined,
    phone: localStorage.getItem(VENDOR_PHONE_KEY) || undefined,
  };
}

/**
 * Persist tokens & session info into localStorage
 */
export function setStoredTokens(tokens: Partial<AuthTokens>): void {
  if (typeof window === 'undefined') return;

  if (tokens.access_token !== undefined) {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  }
  if (tokens.refresh_token !== undefined) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }
  if (tokens.vendor_id !== undefined) {
    localStorage.setItem(VENDOR_ID_KEY, tokens.vendor_id);
  }
  if (tokens.account_id !== undefined) {
    localStorage.setItem(ACCOUNT_ID_KEY, tokens.account_id);
  }
  if (tokens.email !== undefined) {
    localStorage.setItem(USER_EMAIL_KEY, tokens.email);
  }
  if (tokens.role !== undefined) {
    localStorage.setItem(USER_ROLE_KEY, tokens.role);
  }
  if (tokens.name !== undefined) {
    localStorage.setItem(VENDOR_NAME_KEY, tokens.name);
  }
  if (tokens.business_name !== undefined) {
    localStorage.setItem(BUSINESS_NAME_KEY, tokens.business_name);
  }
  if (tokens.phone !== undefined) {
    localStorage.setItem(VENDOR_PHONE_KEY, tokens.phone);
  }

  window.dispatchEvent(new Event('shoppal-auth-changed'));
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
  localStorage.removeItem(VENDOR_NAME_KEY);
  localStorage.removeItem(BUSINESS_NAME_KEY);
  localStorage.removeItem(VENDOR_PHONE_KEY);
  window.dispatchEvent(new Event('shoppal-auth-changed'));
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
  // The shared API key is injected by the server-side proxy. Never bundle it
  // into browser JavaScript through a NEXT_PUBLIC_ variable.
  return '';
}

/**
 * Set custom frontend API key
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
    name: tokens.name || null,
    businessName: tokens.business_name || null,
    phone: tokens.phone || null,
    isAuthenticated: Boolean(tokens.access_token || tokens.vendor_id),
  };
}
