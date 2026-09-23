import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import LandingPage from '../app/page';
import DashboardPage from '../app/dashboard/page';
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

describe('Landing Page', () => {
  it('renders Hero section with value proposition', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Sell on WhatsApp\./i)).toBeDefined();
    expect(screen.getAllByText(/Keep 98%/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Start Selling in 2 Minutes/i).length).toBeGreaterThan(0);
  });

  it('renders Problem comparison section', () => {
    render(<LandingPage />);
    expect(screen.getByText(/The Harsh Reality of Nigerian Retail/i)).toBeDefined();
    expect(screen.getByText(/Big Marketplaces/i)).toBeDefined();
  });

  it('renders Solution section with 3 key benefits', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Upload Products in 2 Minutes/i)).toBeDefined();
    expect(screen.getByText(/Customers Shop Like Texting/i)).toBeDefined();
    expect(screen.getByText(/Keep 98% of Sales/i)).toBeDefined();
  });

  it('renders How It Works timeline', () => {
    render(<LandingPage />);
    expect(screen.getByText(/How it works in 3 simple steps/i)).toBeDefined();
  });

  it('renders Testimonials section', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Mrs\. Chidinma Okafor/i)).toBeDefined();
  });

  it('renders FAQ section', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Frequently Asked Questions/i)).toBeDefined();
    expect(screen.getByText(/How do I sign up\?/i)).toBeDefined();
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
    expect(screen.getByRole('button', { name: /Login|Sign In/i })).toBeDefined();
  });

  it('renders Signup page', () => {
    render(<SignupPage />);
    expect(screen.getByRole('heading', { name: 'Create Vendor Account' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Continue to Payment Setup/i })).toBeDefined();
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
