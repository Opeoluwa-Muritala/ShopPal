import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import DashboardPage from '../app/page';
import ProductsPage from '../app/products/page';
import OrdersPage from '../app/orders/page';
import SettingsPage from '../app/settings/page';
import LoginPage from '../app/login/page';
import SignupPage from '../app/signup/page';
import { formatNaira } from '../lib/utils';
import { apiClient } from '../lib/api';

describe('Navigation and Components', () => {
  it('renders Navbar with links', () => {
    render(<Navbar />);
    expect(screen.getByText('Naija Marketplace')).toBeDefined();
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Products')).toBeDefined();
    expect(screen.getByText('Orders')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders Footer with copyright', () => {
    render(<Footer />);
    expect(screen.getByText(/Naija Marketplace \(EcomBot\)/i)).toBeDefined();
  });
});

describe('Boilerplate App Pages', () => {
  it('renders Dashboard overview page', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Vendor Dashboard')).toBeDefined();
    expect(screen.getByText('Total Sales')).toBeDefined();
  });

  it('renders Products catalog page', () => {
    render(<ProductsPage />);
    expect(screen.getByText('Product Catalog')).toBeDefined();
    expect(screen.getByText('+ Add Product')).toBeDefined();
  });

  it('renders Orders dashboard page', () => {
    render(<OrdersPage />);
    expect(screen.getByRole('heading', { name: 'Orders' })).toBeDefined();
    expect(screen.getByText('Order ID')).toBeDefined();
  });

  it('renders Settings page', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings & Integrations')).toBeDefined();
    expect(screen.getByText('Paystack Configuration')).toBeDefined();
  });

  it('renders Login page', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: 'Vendor Login' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDefined();
  });

  it('renders Signup page', () => {
    render(<SignupPage />);
    expect(screen.getByRole('heading', { name: 'Create Vendor Account' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeDefined();
  });
});

describe('Utilities', () => {
  it('formats naira currency correctly', () => {
    const formatted = formatNaira(5000);
    expect(formatted).toContain('5,000.00');
  });

  it('handles network error in apiClient gracefully', async () => {
    const result = await apiClient('/non-existent-endpoint');
    expect(result.error).toBeDefined();
  });
});
