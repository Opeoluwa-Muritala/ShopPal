import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import StatsCard from '../components/dashboard/StatsCard';
import TopNavBar from '../components/common/TopNavBar';
import Sidebar from '../components/common/Sidebar';
import RecentOrdersSection, { DashboardOrder } from '../components/dashboard/RecentOrdersSection';
import TopProductsSection, { TopProduct } from '../components/dashboard/TopProductsSection';
import QuickActionsBar from '../components/dashboard/QuickActionsBar';
import GettingStartedChecklist from '../components/dashboard/GettingStartedChecklist';
import BroadcastModal from '../components/dashboard/BroadcastModal';
import DashboardHome from '../components/dashboard/DashboardHome';
import DashboardPage from '../app/dashboard/page';
import { ShoppingBag, ShoppingCart } from 'lucide-react';

describe('StatsCard Component', () => {
  it('renders title, value, period, and trend correctly', () => {
    render(
      <StatsCard
        title="Total Orders"
        subtitle="All WhatsApp Checkouts"
        value="12"
        period="This Week"
        trend="+3 from last week"
        trendDirection="up"
        icon={ShoppingCart}
        testId="test-stats-card"
      />
    );

    expect(screen.getByText('Total Orders')).toBeDefined();
    expect(screen.getByText('All WhatsApp Checkouts')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('This Week')).toBeDefined();
    expect(screen.getByText(/\+3 from last week/)).toBeDefined();
  });

  it('renders with tooltip and shows explanation on hover', () => {
    render(
      <StatsCard
        title="Commission"
        value="₦9,000"
        period="2-3% platform fee"
        icon={ShoppingCart}
        tooltip="You keep 98% of sales"
      />
    );

    const infoBtn = screen.getByLabelText('More information');
    expect(infoBtn).toBeDefined();
    fireEvent.mouseEnter(infoBtn);
    expect(screen.getByText('You keep 98% of sales')).toBeDefined();
  });
});

describe('TopNavBar & Navigation Components', () => {
  it('renders vendor name and handles shop status toggle', () => {
    const handleToggle = vi.fn();
    const { rerender } = render(
      <TopNavBar
        vendorName="Mrs. Chidinma Okafor"
        isOpenStatus={true}
        onToggleShopStatus={handleToggle}
      />
    );

    expect(screen.getByText(/Mrs\. Chidinma Okafor/)).toBeDefined();
    expect(screen.getByText(/Open \/ Taking Orders/)).toBeDefined();

    const toggleBtn = screen.getByTitle('Click to toggle shop taking orders status');
    fireEvent.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);

    rerender(
      <TopNavBar
        vendorName="Mrs. Chidinma Okafor"
        isOpenStatus={false}
        onToggleShopStatus={handleToggle}
      />
    );
    expect(screen.getByText(/Shop Paused/)).toBeDefined();
  });

  it('renders notification bell with badge, opens dropdown, and marks all as read', () => {
    const handleMarkRead = vi.fn();
    render(
      <TopNavBar
        recentOrders={[
          { id: '#ORD-1', customerPhone: '08012345678', total: 10000, items: 'Item 1', timestamp: '5m ago', read: false },
          { id: '#ORD-2', customerPhone: '08098765432', total: 20000, items: 'Item 2', timestamp: '10m ago', read: false },
        ]}
        onMarkNotificationsRead={handleMarkRead}
      />
    );

    // Unread count badge
    expect(screen.getByText('2')).toBeDefined();

    // Click bell
    const bellBtn = screen.getByLabelText(/Notifications, 2 unread/);
    fireEvent.click(bellBtn);

    expect(screen.getByText('Recent Order Alerts')).toBeDefined();
    expect(screen.getByText('#ORD-1 • 08012345678')).toBeDefined();

    // Mark all as read
    const markReadBtn = screen.getByText('Mark all as read');
    fireEvent.click(markReadBtn);
    expect(handleMarkRead).toHaveBeenCalled();
  });

  it('renders user profile menu with settings link and logout', () => {
    const handleLogout = vi.fn();
    render(<TopNavBar vendorName="Ada Balogun" onLogout={handleLogout} />);

    const userMenuBtn = screen.getByLabelText('User profile menu');
    fireEvent.click(userMenuBtn);

    expect(screen.getByText('Store Settings')).toBeDefined();
    const logoutBtn = screen.getByText('Sign Out');
    fireEvent.click(logoutBtn);
    expect(handleLogout).toHaveBeenCalled();
  });

  it('renders Sidebar with links and handles logout', () => {
    const handleLogout = vi.fn();
    render(
      <Sidebar
        activeRoute="/dashboard"
        vendorName="Chidinma Okafor"
        shopName="Chidinma Fabrics"
        onLogout={handleLogout}
      />
    );

    expect(screen.getByText('Chidinma Fabrics')).toBeDefined();
    expect(screen.getByText('Products')).toBeDefined();
    expect(screen.getByText('Orders')).toBeDefined();
    expect(screen.getByText('Analytics')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();

    const logoutBtn = screen.getByRole('button', { name: /Logout/i });
    fireEvent.click(logoutBtn);
    expect(handleLogout).toHaveBeenCalled();
  });
});

describe('RecentOrdersSection Component', () => {
  const mockOrders: DashboardOrder[] = [
    {
      id: '#ORD-9021',
      customerPhone: '0803 123 4567',
      items: 'Chelsea Boots (43)',
      total: 24000,
      status: 'Paid',
      timestamp: '10m ago',
    },
    {
      id: '#ORD-9020',
      customerPhone: '0814 998 7711',
      items: 'Ankara Maxi Dress (x2)',
      total: 37000,
      status: 'Processing',
      timestamp: '35m ago',
    },
  ];

  it('renders orders table with formatted phone, items, total, and status badges', () => {
    render(<RecentOrdersSection orders={mockOrders} />);

    expect(screen.getByText('#ORD-9021')).toBeDefined();
    expect(screen.getByText('0803 123 4567')).toBeDefined();
    expect(screen.getByText('Chelsea Boots (43)')).toBeDefined();
    expect(screen.getByText('Paid')).toBeDefined();
    expect(screen.getByText('Processing')).toBeDefined();

    // Check WhatsApp chat links
    const chatLinks = screen.getAllByTitle(/Chat with customer on WhatsApp/);
    expect(chatLinks.length).toBe(2);
    expect(chatLinks[0].getAttribute('href')).toContain('https://wa.me/2348031234567');
  });

  it('renders empty state when no orders exist', () => {
    render(<RecentOrdersSection orders={[]} />);
    expect(screen.getByText('No orders received yet')).toBeDefined();
  });

  it('renders loading state when isLoading is true', () => {
    const { container } = render(<RecentOrdersSection isLoading={true} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

describe('TopProductsSection Component', () => {
  const mockProducts: TopProduct[] = [
    {
      id: 'p1',
      name: 'Ankara Maxi Dress',
      category: 'Clothing',
      ordersCount: 8,
      revenue: 148000,
      stock: 14,
      emoji: '👗',
    },
  ];

  it('renders best-selling products list with order count and revenue', () => {
    render(<TopProductsSection products={mockProducts} />);

    expect(screen.getByText('Ankara Maxi Dress')).toBeDefined();
    expect(screen.getByText(/8 orders/)).toBeDefined();
    expect(screen.getByText(/14 in stock/)).toBeDefined();
  });

  it('renders empty state when no products exist', () => {
    render(<TopProductsSection products={[]} />);
    expect(screen.getByText('No products uploaded yet')).toBeDefined();
  });
});

describe('QuickActionsBar Component', () => {
  it('renders action buttons and handles share shop and broadcast triggers', () => {
    const handleShare = vi.fn();
    const handleBroadcast = vi.fn();

    render(
      <QuickActionsBar
        onShareShop={handleShare}
        onOpenBroadcast={handleBroadcast}
        isCopied={false}
      />
    );

    expect(screen.getByText('Add Product')).toBeDefined();
    expect(screen.getByText('View Bot')).toBeDefined();

    const shareBtn = screen.getByRole('button', { name: /Share Shop Link/i });
    fireEvent.click(shareBtn);
    expect(handleShare).toHaveBeenCalled();

    const broadcastBtn = screen.getByRole('button', { name: /Customer Broadcast/i });
    fireEvent.click(broadcastBtn);
    expect(handleBroadcast).toHaveBeenCalled();
  });
});

describe('GettingStartedChecklist Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders steps, calculates progress percentage, and allows dismissal', async () => {
    const handleDismiss = vi.fn();
    render(
      <GettingStartedChecklist
        hasOrders={false}
        hasProducts={true}
        onDismiss={handleDismiss}
      />
    );

    expect(screen.getByText('Getting Started Checklist')).toBeDefined();
    expect(screen.getByText('Sign up complete')).toBeDefined();
    expect(screen.getByText('Products uploaded')).toBeDefined();

    // Dismiss checklist
    const dismissBtn = screen.getByLabelText('Dismiss onboarding checklist');
    fireEvent.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalled();
  });
});

describe('BroadcastModal Component', () => {
  it('allows customizing message and dispatching broadcast', async () => {
    const handleSent = vi.fn();
    const handleClose = vi.fn();

    render(
      <BroadcastModal
        isOpen={true}
        onClose={handleClose}
        onSent={handleSent}
      />
    );

    expect(screen.getByText('Customer Broadcast')).toBeDefined();

    // Select template
    const templateBtn = screen.getByText('✨ New Stock Arrival');
    fireEvent.click(templateBtn);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('New stock just arrived');

    // Send broadcast
    const sendBtn = screen.getByRole('button', { name: /Send Broadcast/i });
    fireEvent.click(sendBtn);

    await waitFor(
      () => {
        expect(handleSent).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
  });
});

describe('DashboardHome & DashboardPage Full Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders DashboardHome full page with stats, actions, recent orders and checklist', async () => {
    render(<DashboardHome />);

    expect(screen.getByText('Vendor Dashboard')).toBeDefined();
    expect(screen.getByText('ShopPal Verified')).toBeDefined();
    expect(screen.getByText('Total Orders')).toBeDefined();
    expect(screen.getByText('Total Revenue')).toBeDefined();
    expect(screen.getByText('Commission to You (OMJ Labs)')).toBeDefined();
    expect(screen.getByText('Repeat Customers')).toBeDefined();
    expect(screen.getByText('Recent Orders')).toBeDefined();
    expect(screen.getByText('Best-Selling Products')).toBeDefined();
    expect(screen.getByText('Quick Actions')).toBeDefined();
  });

  it('renders DashboardPage export without errors', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Vendor Dashboard')).toBeDefined();
    expect(screen.getByText('Total Sales')).toBeDefined();
  });

  it('handles copying shop link and triggers toast notification', async () => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    render(<DashboardHome />);

    const shareBtn = screen.getByRole('button', { name: /Share Shop Link/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(screen.getByText(/Shop Link Copied/i)).toBeDefined();
    });
  });
});
