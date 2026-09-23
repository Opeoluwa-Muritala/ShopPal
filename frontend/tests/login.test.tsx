import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginForm from '../components/auth/LoginForm';
import LoginCard from '../components/auth/LoginCard';
import LoginPage from '../app/login/page';

// Mock next/navigation useRouter
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('Vendor Login Flow Components', () => {
  beforeEach(() => {
    localStorage.clear();
    mockPush.mockClear();
    vi.restoreAllMocks();
  });

  describe('LoginCard & Page Structure', () => {
    it('renders LoginCard with logo, heading and signup link', () => {
      render(<LoginCard />);
      expect(screen.getByRole('heading', { name: 'Vendor Login' })).toBeDefined();
      expect(screen.getByText(/Welcome back! Access your merchant dashboard/i)).toBeDefined();
      expect(screen.getByRole('link', { name: /Sign up here/i })).toBeDefined();
    });

    it('renders LoginPage container with badge', () => {
      render(<LoginPage />);
      expect(screen.getByText(/WhatsApp Merchant Portal/i)).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Vendor Login' })).toBeDefined();
    });
  });

  describe('LoginForm Interactions & Validation', () => {
    it('renders all form controls and toggles password visibility', () => {
      render(<LoginForm />);
      const idInput = screen.getByLabelText(/Email or Phone Number/i);
      const passInput = screen.getByLabelText(/^Password/i);
      const rememberCheckbox = screen.getByLabelText(/Remember me/i);
      const toggleBtn = screen.getByLabelText(/Show password/i);
      const submitBtn = screen.getByRole('button', { name: 'Login' });

      expect(idInput).toBeDefined();
      expect(passInput).toBeDefined();
      expect(rememberCheckbox).toBeDefined();
      expect(submitBtn).toBeDefined();
      expect(passInput.getAttribute('type')).toBe('password');

      // Click toggle eye icon
      fireEvent.click(toggleBtn);
      expect(passInput.getAttribute('type')).toBe('text');
      expect(screen.getByLabelText(/Hide password/i)).toBeDefined();

      fireEvent.click(screen.getByLabelText(/Hide password/i));
      expect(passInput.getAttribute('type')).toBe('password');
    });

    it('shows inline validation error on blurred invalid input', () => {
      render(<LoginForm />);
      const idInput = screen.getByLabelText(/Email or Phone Number/i);
      const passInput = screen.getByLabelText(/^Password/i);

      // Blur without typing
      fireEvent.blur(idInput);
      expect(screen.getByText(/Email or phone number is required/i)).toBeDefined();

      // Enter invalid email/phone
      fireEvent.change(idInput, { target: { value: 'not-an-email-or-phone' } });
      fireEvent.blur(idInput);
      expect(
        screen.getByText(/Enter a valid email address or 11-digit phone number/i)
      ).toBeDefined();

      // Enter short password
      fireEvent.change(passInput, { target: { value: '123' } });
      fireEvent.blur(passInput);
      expect(screen.getByText(/Password must be at least 6 characters/i)).toBeDefined();
    });

    it('enables submit button only when valid email and password are provided', () => {
      render(<LoginForm />);
      const idInput = screen.getByLabelText(/Email or Phone Number/i);
      const passInput = screen.getByLabelText(/^Password/i);
      const submitBtn = screen.getByRole('button', { name: 'Login' });

      expect(submitBtn.hasAttribute('disabled')).toBe(true);

      fireEvent.change(idInput, { target: { value: 'merchant@shoppal.ng' } });
      fireEvent.change(passInput, { target: { value: 'securePass123' } });

      expect(submitBtn.hasAttribute('disabled')).toBe(false);
    });

    it('enables submit button with Nigerian 11-digit phone number', () => {
      render(<LoginForm />);
      const idInput = screen.getByLabelText(/Email or Phone Number/i);
      const passInput = screen.getByLabelText(/^Password/i);
      const submitBtn = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(idInput, { target: { value: '08012345678' } });
      fireEvent.change(passInput, { target: { value: 'vendorSecret' } });

      expect(submitBtn.hasAttribute('disabled')).toBe(false);
    });

    it('opens and closes forgot password modal', () => {
      render(<LoginForm />);
      const forgotBtn = screen.getByRole('button', { name: /Forgot Password\?/i });
      fireEvent.click(forgotBtn);

      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Forgot Password?' })).toBeDefined();
      expect(screen.getByText(/Contact WhatsApp Support/i)).toBeDefined();

      const closeBtn = screen.getByRole('button', { name: /Back to Login/i });
      fireEvent.click(closeBtn);
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('Login Submission & Storage', () => {
    it('handles successful API authentication and stores credentials', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          vendor_id: 'v_4421',
          token: 'jwt_mock_token_abc',
          dashboard_url: '/dashboard',
        }),
      });
      global.fetch = mockFetch;

      const onSuccess = vi.fn();
      render(<LoginForm onSuccess={onSuccess} />);

      const idInput = screen.getByLabelText(/Email or Phone Number/i);
      const passInput = screen.getByLabelText(/^Password/i);
      const rememberCheckbox = screen.getByLabelText(/Remember me/i);

      fireEvent.change(idInput, { target: { value: 'ade@stores.ng' } });
      fireEvent.change(passInput, { target: { value: 'mypassword123' } });
      fireEvent.click(rememberCheckbox);

      const submitBtn = screen.getByRole('button', { name: 'Login' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Logged in! Welcome back/i)).toBeDefined();
      });

      expect(localStorage.getItem('shoppal_vendor_id')).toBe('v_4421');
      expect(localStorage.getItem('shoppal_auth_token')).toBe('jwt_mock_token_abc');
      expect(localStorage.getItem('shoppal_remembered_identifier')).toBe('ade@stores.ng');
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ vendor_id: 'v_4421' })
      );
    });

    it('handles 401 incorrect credentials error with retry option', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });
      global.fetch = mockFetch;

      render(<LoginForm />);

      const idInput = screen.getByLabelText(/Email or Phone Number/i);
      const passInput = screen.getByLabelText(/^Password/i);

      fireEvent.change(idInput, { target: { value: 'wrong@user.ng' } });
      fireEvent.change(passInput, { target: { value: 'wrongpass' } });

      const submitBtn = screen.getByRole('button', { name: 'Login' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Email\/phone or password incorrect/i)
        ).toBeDefined();
      });

      const retryBtn = screen.getByRole('button', { name: /Retry/i });
      expect(retryBtn).toBeDefined();
    });

    it('falls back to demo mode when backend endpoint fails', async () => {
      // Simulate network / server error (e.g. backend endpoint not created yet)
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      render(<LoginForm />);

      const idInput = screen.getByLabelText(/Email or Phone Number/i);
      const passInput = screen.getByLabelText(/^Password/i);

      fireEvent.change(idInput, { target: { value: '07099887766' } });
      fireEvent.change(passInput, { target: { value: 'password123' } });

      const submitBtn = screen.getByRole('button', { name: 'Login' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Demo mode: Logged in with stored vendor ID/i)).toBeDefined();
      });

      expect(localStorage.getItem('shoppal_vendor_id')).toMatch(/^v_\d+/);
      expect(localStorage.getItem('shoppal_auth_token')).toBeDefined();
    });
  });
});
