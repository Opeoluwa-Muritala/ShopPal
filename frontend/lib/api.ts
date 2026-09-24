/**
 * API client for ShopPal with automatic authentication,
 * token refresh rotation, and typed backend endpoint callers.
 */

import {
  getStoredTokens,
  setStoredTokens,
  clearStoredTokens,
  getFrontendApiKey,
} from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status?: number;
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Enhanced fetch client with header injection, auto token refresh, and error handling
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const apiKey = getFrontendApiKey();
  const tokens = getStoredTokens();

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const defaultHeaders: Record<string, string> = {
    'X-API-Key': apiKey,
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
  };

  if (tokens.access_token) {
    defaultHeaders['Authorization'] = `Bearer ${tokens.access_token}`;
  }

  const finalOptions: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    let response = await fetch(`${API_BASE_URL}${endpoint}`, finalOptions);

    // Auto token refresh on 401 (if access token expired and refresh token exists)
    if (response.status === 401 && tokens.refresh_token && !endpoint.includes('/api/auth/')) {
      if (isRefreshing) {
        try {
          const newToken = await new Promise<string>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          const retryHeaders = {
            ...defaultHeaders,
            ...options.headers,
            Authorization: `Bearer ${newToken}`,
          };
          response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: retryHeaders,
          });
        } catch {
          // Token refresh failed, continue with original 401 response
        }
      } else {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
            body: JSON.stringify({ refresh_token: tokens.refresh_token }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newAccess = refreshData.access_token;
            const newRefresh = refreshData.refresh_token || tokens.refresh_token;

            setStoredTokens({
              access_token: newAccess,
              refresh_token: newRefresh,
            });

            processQueue(null, newAccess);

            // Retry original request with fresh access token
            const retryHeaders = {
              ...defaultHeaders,
              ...options.headers,
              Authorization: `Bearer ${newAccess}`,
            };
            response = await fetch(`${API_BASE_URL}${endpoint}`, {
              ...options,
              headers: retryHeaders,
            });
          } else {
            clearStoredTokens();
            processQueue(new Error('Refresh token invalid'));
          }
        } catch (refreshErr) {
          clearStoredTokens();
          processQueue(refreshErr);
        } finally {
          isRefreshing = false;
        }
      }
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson.detail) {
          errorMessage = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        } else if (errJson.error) {
          errorMessage = errJson.error;
        }
      } catch {
        // Response is not JSON
      }
      return { error: errorMessage, status: response.status };
    }

    const data = await response.json();
    return { data, status: response.status };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown network error',
      status: 0,
    };
  }
}

// ============================================================================
// Typed Endpoints Callers
// ============================================================================

export const authApi = {
  login: async (body: { email: string; password: string }) => {
    return apiClient<{ access_token: string; refresh_token: string; token_type: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  },

  refresh: async (refreshToken: string) => {
    return apiClient<{ access_token: string; refresh_token: string; token_type: string }>(
      '/api/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    );
  },

  logout: async (refreshToken: string) => {
    return apiClient<{ message: string }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  logoutAll: async () => {
    return apiClient<{ message: string }>('/api/auth/logout-all', {
      method: 'POST',
    });
  },

  forgotPassword: async (email: string) => {
    return apiClient<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: async (body: { token: string; new_password: string }) => {
    return apiClient<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export const accountsApi = {
  inviteStaff: async (body: { email: string; phone: string; temp_password: string }) => {
    return apiClient<{
      account_id: string;
      vendor_id: string;
      email: string;
      role: string;
      status: string;
      message: string;
    }>('/api/accounts/invite-staff', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export const vendorsApi = {
  signup: async (body: {
    name: string;
    phone: string;
    whatsapp_number: string;
    business_name?: string;
    email: string;
    password: string;
    preferred_language?: string;
    bank_account?: string;
  }) => {
    return apiClient<{
      vendor_id: string;
      account_id: string;
      name: string;
      business_name: string;
      email: string;
      phone: string;
      role: string;
    }>('/api/vendors/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export const productsApi = {
  list: async () => {
    return apiClient<{
      vendor_id: string;
      count: number;
      products: Array<{
        id: string;
        name: string;
        price: string | number;
        stock: number;
        image_url: string;
        status?: string;
        description?: string;
      }>;
    }>('/api/products');
  },

  create: async (body: {
    name: string;
    price: number;
    stock: number;
    image_url: string;
    description?: string;
  }) => {
    return apiClient<{
      id: string;
      name: string;
      price: string;
      stock: number;
      status: string;
    }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  uploadCsv: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient<{
      vendor_id: string;
      imported_rows: number;
      products_created: number;
      status: string;
    }>('/api/products/upload-csv', {
      method: 'POST',
      body: formData,
    });
  },
};

export const ordersApi = {
  list: async () => {
    return apiClient<{
      vendor_id: string;
      count: number;
      orders: Array<{
        id: string;
        order_code: string;
        customer_phone: string;
        total: string;
        status: string;
        payment_status: string;
        items: any[];
      }>;
    }>('/api/orders');
  },

  updateStatus: async (
    orderId: string,
    status: 'new' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  ) => {
    return apiClient<{
      id: string;
      order_code: string;
      status: string;
      updated: boolean;
    }>(`/api/orders/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

export const diagnosticsApi = {
  getRecentLogs: async (limit = 50, level?: string, customKey?: string) => {
    const key = customKey || getFrontendApiKey();
    const query = new URLSearchParams({ limit: limit.toString() });
    if (level) query.set('level', level);

    return apiClient<{
      count: number;
      total_buffered: number;
      logs: Array<{
        timestamp?: string;
        level?: string;
        message?: string;
        route?: string;
        status_code?: number;
        latency_ms?: number;
        [key: string]: any;
      }>;
    }>(`/api/logs/recent?${query.toString()}`, {
      headers: {
        'X-Vendor-API-Key': key,
        'X-Admin-API-Key': key,
      },
    });
  },

  getHealth: async () => {
    return apiClient<{ status: string }>('/api/health');
  },
};
