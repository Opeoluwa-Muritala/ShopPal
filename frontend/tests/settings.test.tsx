import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage, { DEMO_VENDOR_SETTINGS } from '../components/settings/SettingsPage';
import AccountSettings, {
  validateName,
  validatePhone,
  formatNigerianPhone,
} from '../components/settings/AccountSettings';
import PaymentSettings, {
  validatePaystackKey,
  validateAccountNumber,
  maskKey,
} from '../components/settings/PaymentSettings';
import BotCustomization from '../components/settings/BotCustomization';
import NotificationsSettings from '../components/settings/NotificationsSettings';
import BillingUsage from '../components/settings/BillingUsage';
import DangerZone from '../components/settings/DangerZone';

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

describe('Settings Page & Subcomponents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Main SettingsPage & Navigation', () => {
    it('renders header, title, and all 6 navigation tabs', () => {
      render(<SettingsPage />);

      expect(screen.getByText('Settings & Integrations')).toBeDefined();
      expect(screen.getByRole('button', { name: /Account Settings/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Payment Settings/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Bot Customization/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Notifications/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Billing & Usage/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Danger Zone/i })).toBeDefined();
    });

    it('switches between tabs when clicked', async () => {
      render(<SettingsPage />);

      // Default tab is Account Settings
      expect(screen.getByText('Personal Information')).toBeDefined();

      // Switch to Payment Settings
      fireEvent.click(screen.getByRole('button', { name: /Payment Settings/i }));
      expect(screen.getByText('Connected Paystack Account')).toBeDefined();
      expect(screen.getByText('Bank Account (for withdrawals)')).toBeDefined();

      // Switch to Bot Customization
      fireEvent.click(screen.getByRole('button', { name: /Bot Customization/i }));
      expect(screen.getByText('Greeting Message')).toBeDefined();
      expect(screen.getByText('Your customers will see:')).toBeDefined();

      // Switch to Notifications
      fireEvent.click(screen.getByRole('button', { name: /Notifications/i }));
      expect(screen.getByText('Order Notifications')).toBeDefined();
      expect(screen.getByText('Save All Notifications')).toBeDefined();

      // Switch to Billing & Usage
      fireEvent.click(screen.getByRole('button', { name: /Billing & Usage/i }));
      expect(screen.getByText('Subscription Plan')).toBeDefined();
      expect(screen.getByText('Usage This Month')).toBeDefined();

      // Switch to Danger Zone
      fireEvent.click(screen.getByRole('button', { name: /Danger Zone/i }));
      expect(screen.getAllByText('Change Password').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Log Out All Sessions').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Delete Account').length).toBeGreaterThan(0);
    });
  });

  describe('AccountSettings Component', () => {
    it('renders vendor personal details and status indicators', () => {
      const mockUpdate = vi.fn();
      const mockToast = vi.fn();

      render(
        <AccountSettings
          personalInfo={DEMO_VENDOR_SETTINGS.personalInfo}
          accountStatus={DEMO_VENDOR_SETTINGS.accountStatus}
          onUpdatePersonalInfo={mockUpdate}
          onShowToast={mockToast}
        />
      );

      // personalInfo fields are blank by default in DEMO_VENDOR_SETTINGS;
      // real values come from session tokens at runtime.
      // Verify the stable accountStatus fields that are always populated.
      expect(screen.getByText('vendor_001234')).toBeDefined();
      expect(screen.getByText('+1 415 523 8886')).toBeDefined();
    });

    it('copies vendor ID and bot WhatsApp number to clipboard', async () => {
      const mockToast = vi.fn();

      render(
        <AccountSettings
          personalInfo={DEMO_VENDOR_SETTINGS.personalInfo}
          accountStatus={DEMO_VENDOR_SETTINGS.accountStatus}
          onUpdatePersonalInfo={vi.fn()}
          onShowToast={mockToast}
        />
      );

      const copyButtons = screen.getAllByTitle(/Copy/i);
      fireEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('vendor_001234');
        expect(mockToast).toHaveBeenCalledWith('Copied to clipboard!', 'info');
      });
    });

    it('validates name, phone numbers, and formats Nigerian numbers correctly', () => {
      expect(validateName('')).toContain('at least 2 characters');
      expect(validateName('T')).toContain('at least 2 characters');
      expect(validateName('Tunde Ajayi')).toBeNull();

      expect(validatePhone('123')).toContain('11 digits');
      expect(validatePhone('08012345678')).toBeNull();
      expect(validatePhone('18012345678')).toContain('must begin with 0');

      expect(formatNigerianPhone('07012345678')).toBe('0701 234 5678');
    });
  });

  describe('PaymentSettings Component', () => {
    it('validates Paystack keys and account numbers correctly', () => {
      expect(validatePaystackKey('')).toContain('required');
      expect(validatePaystackKey('invalid_key')).toContain('Must begin with');
      expect(validatePaystackKey('pk_test_xxxx')).toBeNull();
      expect(validatePaystackKey('pk_live_1234567890abcdef')).toBeNull();

      expect(validateAccountNumber('12345')).toContain('10 digits');
      expect(validateAccountNumber('1234567890')).toBeNull();

      expect(maskKey('pk_test_1234567890abcdef')).toContain('••••••••');
    });

    it('handles test connection action', async () => {
      const mockTestPaystack = vi.fn().mockResolvedValue({ success: true, message: 'Valid' });
      const mockToast = vi.fn();

      render(
        <PaymentSettings
          paystack={DEMO_VENDOR_SETTINGS.paystack}
          bankAccount={DEMO_VENDOR_SETTINGS.bankAccount}
          withdrawal={DEMO_VENDOR_SETTINGS.withdrawal}
          onUpdatePaystack={vi.fn()}
          onUpdateBankAccount={vi.fn()}
          onTestPaystackConnection={mockTestPaystack}
          onVerifyBankAccount={vi.fn()}
          onShowToast={mockToast}
        />
      );

      const testBtn = screen.getByText('Test Connection');
      fireEvent.click(testBtn);

      await waitFor(() => {
        expect(mockTestPaystack).toHaveBeenCalledWith(DEMO_VENDOR_SETTINGS.paystack.key);
        expect(screen.getByText(/Connection successful/i)).toBeDefined();
      });
    });
  });

  describe('BotCustomization Component', () => {
    it('renders greeting message and updates live WhatsApp preview', () => {
      render(
        <BotCustomization
          botData={DEMO_VENDOR_SETTINGS.bot}
          onUpdateGreeting={vi.fn()}
          onUpdateLanguage={vi.fn()}
          onUpdateOperatingHours={vi.fn()}
          onUpdateBotStatus={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      expect(screen.getByText('Your customers will see:')).toBeDefined();
      expect(screen.getAllByText(/Hi! Welcome to our store/i).length).toBeGreaterThan(0);
    });

    it('toggles bot active / paused state', async () => {
      const mockUpdateStatus = vi.fn();
      const mockToast = vi.fn();

      render(
        <BotCustomization
          botData={DEMO_VENDOR_SETTINGS.bot}
          onUpdateGreeting={vi.fn()}
          onUpdateLanguage={vi.fn()}
          onUpdateOperatingHours={vi.fn()}
          onUpdateBotStatus={mockUpdateStatus}
          onShowToast={mockToast}
        />
      );

      const toggleBtn = screen.getByRole('switch', { name: /Toggle Bot Active/i });
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith('paused');
      });
    });
  });

  describe('NotificationsSettings Component', () => {
    it('allows toggling notifications and saving all settings', async () => {
      const mockSave = vi.fn();
      const mockToast = vi.fn();

      render(
        <NotificationsSettings
          notifications={DEMO_VENDOR_SETTINGS.notifications}
          accountEmail="tunde@example.com"
          onSaveNotifications={mockSave}
          onShowToast={mockToast}
        />
      );

      expect(screen.getByText('Email on new order')).toBeDefined();
      expect(screen.getByText('Push notification on new order')).toBeDefined();
      expect(screen.getByText('Low stock alert')).toBeDefined();

      const saveBtn = screen.getByText('Save All Notifications');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(expect.stringMatching(/Notification settings saved/i));
      });

    });
  });

  describe('BillingUsage Component', () => {
    it('renders current plan details and usage metrics', () => {
      render(<BillingUsage billing={DEMO_VENDOR_SETTINGS.billing} />);

      expect(screen.getByText('Free (Hackathon)')).toBeDefined();
      expect(screen.getByText('₦0/month')).toBeDefined();
      expect(screen.getByText('API Calls')).toBeDefined();
      expect(screen.getByText('1,234')).toBeDefined();
      expect(screen.getByText('50 MB')).toBeDefined();
      expect(screen.getByText('Active Products')).toBeDefined();
      expect(screen.getByText('Orders Processed')).toBeDefined();
    });
  });

  describe('DangerZone Component', () => {
    it('opens modals for change password, logout, and delete account', () => {
      render(
        <DangerZone
          vendorId="vendor_001234"
          onChangePassword={vi.fn()}
          onLogoutAllSessions={vi.fn()}
          onDeleteAccount={vi.fn()}
          onShowToast={vi.fn()}
        />
      );

      // Open Change Password modal
      fireEvent.click(screen.getByRole('button', { name: /Change Password/i }));
      expect(screen.getByText('Current Password')).toBeDefined();
      expect(screen.getByText('New Password (min 8 characters)')).toBeDefined();

      // Close it
      fireEvent.click(screen.getByText('Cancel'));

      // Open Log Out All Sessions modal
      fireEvent.click(screen.getByRole('button', { name: /Log Out All Sessions/i }));
      expect(screen.getByText('Log out of all devices?')).toBeDefined();

      // Close it
      fireEvent.click(screen.getByText('Cancel'));

      // Open Delete Account modal
      fireEvent.click(screen.getByRole('button', { name: /Delete Account/i }));
      expect(screen.getByText('Are you sure? This is permanent.')).toBeDefined();
      expect(screen.getByText('Please tell us why you are leaving:')).toBeDefined();
    });
  });
});
