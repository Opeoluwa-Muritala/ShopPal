import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiClient,
  authApi,
  accountsApi,
  vendorsApi,
  productsApi,
  ordersApi,
  diagnosticsApi,
} from '../lib/api';
import {
  getStoredTokens,
  setStoredTokens,
  clearStoredTokens,
  getFrontendApiKey,
  setFrontendApiKey,
  getCurrentSession,
} from '../lib/auth';

describe('Frontend API Integration & Authentication (v0.6.0 Endpoints)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Session & Auth Storage Management (lib/auth.ts)', () => {
    it('stores and retrieves tokens and user session correctly', () => {
      setStoredTokens({
        access_token: 'acc_123',
        refresh_token: 'ref_456',
        vendor_id: 'v_789',
        account_id: 'a_001',
        email: 'merchant@naija.ng',
        role: 'owner',
      });

      const tokens = getStoredTokens();
      expect(tokens.access_token).toBe('acc_123');
      expect(tokens.refresh_token).toBe('ref_456');
      expect(tokens.vendor_id).toBe('v_789');
      expect(tokens.account_id).toBe('a_001');

      const session = getCurrentSession();
      expect(session.isAuthenticated).toBe(true);
      expect(session.email).toBe('merchant@naija.ng');

      clearStoredTokens();
      const clearedSession = getCurrentSession();
      expect(clearedSession.isAuthenticated).toBe(false);
      expect(clearedSession.accessToken).toBeNull();
    });

    it('manages frontend API key in localStorage', () => {
      expect(getFrontendApiKey()).toBeDefined();
      setFrontendApiKey('custom-test-api-key');
      expect(getFrontendApiKey()).toBe('custom-test-api-key');
    });
  });

  describe('Authentication Endpoints (authApi)', () => {
    it('calls POST /api/auth/login with email, password and X-API-Key', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'jwt_access_abc',
          refresh_token: 'jwt_refresh_xyz',
          token_type: 'bearer',
        }),
      });
      global.fetch = mockFetch;

      const res = await authApi.login({
        email: 'tunde@market.ng',
        password: 'Password123!',
      });

      expect(res.data?.access_token).toBe('jwt_access_abc');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': expect.any(String),
          }),
          body: JSON.stringify({ email: 'tunde@market.ng', password: 'Password123!' }),
        })
      );
    });

    it('calls POST /api/auth/refresh with refresh token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'jwt_new_access',
          refresh_token: 'jwt_new_refresh',
          token_type: 'bearer',
        }),
      });
      global.fetch = mockFetch;

      const res = await authApi.refresh('jwt_refresh_xyz');
      expect(res.data?.access_token).toBe('jwt_new_access');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/refresh'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refresh_token: 'jwt_refresh_xyz' }),
        })
      );
    });

    it('calls POST /api/auth/logout and /api/auth/logout-all', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Successfully logged out' }),
      });
      global.fetch = mockFetch;

      const logoutRes = await authApi.logout('token_to_revoke');
      expect(logoutRes.data?.message).toContain('logged out');

      const logoutAllRes = await authApi.logoutAll();
      expect(logoutAllRes.data?.message).toBeDefined();
    });

    it('calls POST /api/auth/forgot-password and POST /api/auth/reset-password', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Reset token dispatched' }),
      });
      global.fetch = mockFetch;

      const forgotRes = await authApi.forgotPassword('vendor@test.ng');
      expect(forgotRes.data?.message).toBe('Reset token dispatched');

      const resetRes = await authApi.resetPassword({
        token: 'token_123',
        new_password: 'NewStrongPassword123!',
      });
      expect(resetRes.data?.message).toBeDefined();
    });
  });

  describe('Accounts & Vendor Onboarding (accountsApi & vendorsApi)', () => {
    it('calls POST /api/accounts/invite-staff with credentials', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          account_id: 'acc_staff_99',
          vendor_id: 'v_123',
          email: 'assistant@store.ng',
          role: 'Staff / Assistant',
          status: 'invited',
          message: 'Staff invitation sent',
        }),
      });
      global.fetch = mockFetch;

      const res = await accountsApi.inviteStaff({
        email: 'assistant@store.ng',
        phone: '08091234567',
        temp_password: 'StaffPass2025!',
      });

      expect(res.data?.account_id).toBe('acc_staff_99');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/accounts/invite-staff'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('calls POST /api/vendors/signup with required vendor schema', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          vendor_id: 'v_555',
          account_id: 'acc_555',
          name: 'Ibrahim Bala',
          business_name: 'Bala Gadgets Hub',
          email: 'ibrahim@balahub.ng',
          phone: '08021112222',
          role: 'owner',
        }),
      });
      global.fetch = mockFetch;

      const res = await vendorsApi.signup({
        name: 'Ibrahim Bala',
        phone: '08021112222',
        whatsapp_number: '08021112222',
        business_name: 'Bala Gadgets Hub',
        email: 'ibrahim@balahub.ng',
        password: 'SecurePass123!',
      });

      expect(res.data?.vendor_id).toBe('v_555');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/vendors/signup'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('Products Catalog Endpoints (productsApi)', () => {
    it('calls GET /api/products to list vendor catalog', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          vendor_id: 'v_123',
          count: 1,
          products: [
            {
              id: 'p_1',
              name: 'Ankara Bag',
              price: 15000,
              stock: 10,
              image_url: 'https://img.ng/1.jpg',
            },
          ],
        }),
      });
      global.fetch = mockFetch;

      const res = await productsApi.list();
      expect(res.data?.products.length).toBe(1);
      expect(res.data?.products[0].name).toBe('Ankara Bag');
    });

    it('calls POST /api/products to create a new product', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'p_new',
          name: 'Silk Caftan',
          price: '22000.00',
          stock: 8,
          status: 'active',
        }),
      });
      global.fetch = mockFetch;

      const res = await productsApi.create({
        name: 'Silk Caftan',
        price: 22000,
        stock: 8,
        image_url: 'https://img.ng/caftan.jpg',
        description: 'Premium Nigerian caftan',
      });

      expect(res.data?.id).toBe('p_new');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('calls POST /api/products/upload-csv with multipart FormData', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          vendor_id: 'v_123',
          imported_rows: 5,
          products_created: 5,
          status: 'success',
        }),
      });
      global.fetch = mockFetch;

      const fakeFile = new File(['name,price,stock\nShoe,1000,5'], 'products.csv', {
        type: 'text/csv',
      });

      const res = await productsApi.uploadCsv(fakeFile);
      expect(res.data?.products_created).toBe(5);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/upload-csv'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });
  });

  describe('Orders Management Endpoints (ordersApi)', () => {
    it('calls GET /api/orders to retrieve live vendor orders', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          vendor_id: 'v_123',
          count: 1,
          orders: [
            {
              id: 'ord_1',
              order_code: 'ORD-9021',
              customer_phone: '+2348031234567',
              total: '24000.00',
              status: 'shipped',
              payment_status: 'paid',
              items: [{ name: 'Chelsea Boots', quantity: 1 }],
            },
          ],
        }),
      });
      global.fetch = mockFetch;

      const res = await ordersApi.list();
      expect(res.data?.orders[0].order_code).toBe('ORD-9021');
    });

    it('calls PATCH /api/orders/{id} to update order fulfillment status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'ord_1',
          order_code: 'ORD-9021',
          status: 'delivered',
          updated: true,
        }),
      });
      global.fetch = mockFetch;

      const res = await ordersApi.updateStatus('ord_1', 'delivered');
      expect(res.data?.updated).toBe(true);
      expect(res.data?.status).toBe('delivered');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/orders/ord_1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'delivered' }),
        })
      );
    });
  });

  describe('Diagnostics & System Telemetry Endpoints (diagnosticsApi)', () => {
    it('calls GET /api/logs/recent with custom headers and filters', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          count: 2,
          total_buffered: 40,
          logs: [
            { timestamp: '2025-09-24 00:00:00', level: 'INFO', message: 'Webhook received' },
          ],
        }),
      });
      global.fetch = mockFetch;

      const res = await diagnosticsApi.getRecentLogs(25, 'INFO', 'vendor-secret-key-123');
      expect(res.data?.count).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/logs/recent?limit=25&level=INFO'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Vendor-API-Key': 'vendor-secret-key-123',
            'X-Admin-API-Key': 'vendor-secret-key-123',
          }),
        })
      );
    });

    it('calls GET /api/health to inspect system status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' }),
      });
      global.fetch = mockFetch;

      const res = await diagnosticsApi.getHealth();
      expect(res.data?.status).toBe('healthy');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/health'),
        expect.anything()
      );
    });
  });

  describe('Automatic 401 JWT Token Refresh in apiClient', () => {
    it('intercepts 401 response and retries request with refreshed token', async () => {
      setStoredTokens({
        access_token: 'expired_access_token',
        refresh_token: 'valid_refresh_token',
      });

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (url.includes('/api/auth/refresh')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'brand_new_access_token',
              refresh_token: 'brand_new_refresh_token',
            }),
          });
        }
        if (callCount === 1) {
          // First attempt to /api/products returns 401
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({ detail: 'Token expired' }),
          });
        }
        // Retry with refreshed token succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ products: [{ name: 'Retried Product' }] }),
        });
      });
      global.fetch = mockFetch;

      const res = await apiClient<any>('/api/products');
      expect(res.status).toBe(200);
      expect(res.data?.products[0].name).toBe('Retried Product');

      const updatedTokens = getStoredTokens();
      expect(updatedTokens.access_token).toBe('brand_new_access_token');
    });
  });
});
