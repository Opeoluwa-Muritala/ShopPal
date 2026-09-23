import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SummaryCards from '../components/analytics/SummaryCards';
import DateRangePicker from '../components/analytics/DateRangePicker';
import RevenueChart from '../components/analytics/RevenueChart';
import TopProductsChart from '../components/analytics/TopProductsChart';
import PaymentStatusChart from '../components/analytics/PaymentStatusChart';
import CustomerInsights from '../components/analytics/CustomerInsights';
import AnalyticsPage from '../components/analytics/AnalyticsPage';
import AnalyticsAppPage from '../app/dashboard/analytics/page';
import AnalyticsPagesPage from '../pages/dashboard/analytics';
import { AnalyticsData } from '../components/analytics/types';

// Mock ResizeObserver for jsdom
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock Recharts ResponsiveContainer to render children reliably in JSDOM
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 300 }}>{children}</div>
    ),
  };
});

const mockAnalyticsData: AnalyticsData = {
  total_orders: 45,
  total_revenue: 450000,
  commission: 9000,
  avg_order_value: 10000,
  repeat_customers: 12,
  revenue_by_date: [
    { date: 'Sep 21', revenue: 42000, orders: 4 },
    { date: 'Sep 22', revenue: 65000, orders: 6 },
  ],
  top_products: [
    { product_id: 'prod_001', name: 'Blue Sneaker', orders: 12, revenue: 180000 },
    { product_id: 'prod_002', name: 'Red Kicks', orders: 8, revenue: 96000 },
    { product_id: 'prod_003', name: 'Black Formal', orders: 6, revenue: 108000 },
    { product_id: 'prod_004', name: 'Casual Shirt', orders: 5, revenue: 75000 },
    { product_id: 'prod_005', name: 'Denim Jeans', orders: 3, revenue: 72000 },
  ],
  payment_status: {
    paid: 38,
    pending: 5,
    failed: 2,
  },
  unique_customers: 52,
  repeat_purchase_rate: 0.23,
  customer_acquisition: 8,
  avg_customer_lifetime_value: 18500,
  orders_trend: { value: 12, is_positive: true },
  revenue_trend: { value: 50000, is_positive: true },
  aov_trend: { value: 500, is_positive: true },
  repeat_customers_trend: { value: 3, is_positive: true },
};

describe('DateRangePicker Component', () => {
  it('renders all range options and handles click selection', () => {
    const handleRangeChange = vi.fn();
    render(
      <DateRangePicker
        selectedRange="30days"
        onRangeChange={handleRangeChange}
        lastUpdatedText="Last updated: 2 minutes ago"
      />
    );

    expect(screen.getByText('Last 7 Days')).toBeDefined();
    expect(screen.getByText('Last 30 Days')).toBeDefined();
    expect(screen.getByText('This Month')).toBeDefined();
    expect(screen.getByText('All Time')).toBeDefined();
    expect(screen.getByText('Custom')).toBeDefined();
    expect(screen.getByText('Last updated: 2 minutes ago')).toBeDefined();

    // Click on 7 Days
    fireEvent.click(screen.getByText('Last 7 Days'));
    expect(handleRangeChange).toHaveBeenCalledWith('7days');
  });

  it('renders custom date inputs when custom is selected', () => {
    render(
      <DateRangePicker
        selectedRange="custom"
        onRangeChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Start Date')).toBeDefined();
    expect(screen.getByLabelText('End Date')).toBeDefined();
  });
});

describe('SummaryCards Component', () => {
  it('renders 4 cards with accurate metrics and value proposition', () => {
    render(
      <SummaryCards
        data={mockAnalyticsData}
        isLoading={false}
        periodLabel="Last 30 days"
      />
    );

    // Card 1: Orders
    expect(screen.getByText('Orders')).toBeDefined();
    expect(screen.getByText('45')).toBeDefined();
    expect(screen.getByText('+12 vs last month')).toBeDefined();

    // Card 2: Revenue & 2% commission value prop
    expect(screen.getByText('Revenue')).toBeDefined();
    expect(screen.getAllByText(/₦450,000/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/You keep/i)).toBeDefined();
    expect(screen.getByText(/2% commission/i)).toBeDefined();
    expect(screen.getByText(/₦441,000/i)).toBeDefined();

    // Card 3: Avg Order Value
    expect(screen.getByText('Avg Order Value')).toBeDefined();
    expect(screen.getAllByText(/₦10,000/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Total Revenue \/ Total Orders/i)).toBeDefined();

    // Card 4: Repeat Customers
    expect(screen.getByText('Repeat Customers')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText(/23% of your customers/i)).toBeDefined();
    expect(screen.getByText(/\+3 new repeat customers this month/i)).toBeDefined();
  });

  it('renders loading skeleton state when isLoading is true', () => {
    const { container } = render(<SummaryCards isLoading={true} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBe(4);
  });
});

describe('RevenueChart Component', () => {
  it('renders chart title and view toggles', () => {
    render(<RevenueChart data={mockAnalyticsData.revenue_by_date} />);
    expect(screen.getByText(/Revenue Over Time/i)).toBeDefined();
    expect(screen.getByText('Daily')).toBeDefined();
    expect(screen.getByText('Cumulative')).toBeDefined();
  });

  it('switches between Daily and Cumulative modes', () => {
    render(<RevenueChart data={mockAnalyticsData.revenue_by_date} />);
    const cumulativeBtn = screen.getByText('Cumulative');
    fireEvent.click(cumulativeBtn);
    expect(cumulativeBtn.className).toContain('text-emerald-700');
  });
});

describe('TopProductsChart Component', () => {
  it('renders top 5 best-selling products and toggle options', () => {
    render(<TopProductsChart products={mockAnalyticsData.top_products} />);

    expect(screen.getByText('Top 5 Best-Selling Products')).toBeDefined();
    expect(screen.getByText('Blue Sneaker')).toBeDefined();
    expect(screen.getByText('Red Kicks')).toBeDefined();
    expect(screen.getByText('Black Formal')).toBeDefined();
    expect(screen.getByText('Casual Shirt')).toBeDefined();
    expect(screen.getByText('Denim Jeans')).toBeDefined();

    const ordersBtn = screen.getByText('By Orders');
    const revenueBtn = screen.getByText('By Revenue');
    expect(ordersBtn).toBeDefined();
    expect(revenueBtn).toBeDefined();

    fireEvent.click(revenueBtn);
    expect(revenueBtn.className).toContain('text-emerald-700');
  });
});

describe('PaymentStatusChart Component', () => {
  it('renders payment status segments and legend with percentages', () => {
    render(<PaymentStatusChart paymentStatus={mockAnalyticsData.payment_status} />);

    expect(screen.getByText('Payment Status')).toBeDefined();
    expect(screen.getByText('Paid & Settled')).toBeDefined();
    expect(screen.getByText('Pending Payment')).toBeDefined();
    expect(screen.getByText('Failed / Abandoned')).toBeDefined();
    expect(screen.getByText('38 orders')).toBeDefined();
    expect(screen.getByText('5 orders')).toBeDefined();
    expect(screen.getByText('2 orders')).toBeDefined();
  });
});

describe('CustomerInsights Component', () => {
  it('renders behavioral metrics and performance alerts', () => {
    render(<CustomerInsights data={mockAnalyticsData} />);

    expect(screen.getByText(/Customer Behavior/i)).toBeDefined();
    expect(screen.getByText('52')).toBeDefined();
    expect(screen.getByText('23%')).toBeDefined();
    expect(screen.getByText('+8')).toBeDefined();
    expect(screen.getAllByText(/₦18,500/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Red Kicks is selling slower this week/i)).toBeDefined();
  });
});

describe('Full AnalyticsPage Integration & Route Exports', () => {
  beforeEach(() => {
    // Mock global fetch for API calls
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockAnalyticsData),
      })
    );
  });

  it('renders complete AnalyticsPage with all sections', async () => {
    render(<AnalyticsPage />);

    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeDefined();
    expect(screen.getByText('Naija Marketplace')).toBeDefined();
    expect(screen.getByText('Export PDF')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Orders')).toBeDefined();
      expect(screen.getByText('Revenue')).toBeDefined();
    });
  });

  it('renders App Router page export', () => {
    render(<AnalyticsAppPage />);
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeDefined();
  });

  it('renders Pages Router page export', () => {
    render(<AnalyticsPagesPage />);
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeDefined();
  });
});
