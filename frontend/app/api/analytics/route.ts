import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get('vendor_id') || 'demo_vendor';
  const dateRange = searchParams.get('date_range') || '30days';
  const customFrom = searchParams.get('from');
  const customTo = searchParams.get('to');

  // Realistic Hackathon Demo Data tailored for Nigerian Merchants
  if (dateRange === '7days') {
    return NextResponse.json({
      vendor_id: vendorId,
      date_range: '7days',
      total_orders: 18,
      total_revenue: 165000,
      commission: 3300, // 2% of 165,000
      avg_order_value: 9166,
      repeat_customers: 5,
      revenue_by_date: [
        { date: 'Sep 17', revenue: 18000, orders: 2 },
        { date: 'Sep 18', revenue: 24000, orders: 3 },
        { date: 'Sep 19', revenue: 15000, orders: 1 },
        { date: 'Sep 20', revenue: 32000, orders: 3 },
        { date: 'Sep 21', revenue: 42000, orders: 5 },
        { date: 'Sep 22', revenue: 21000, orders: 2 },
        { date: 'Sep 23', revenue: 13000, orders: 2 },
      ],
      top_products: [
        { product_id: 'prod_001', name: 'Blue Sneaker', orders: 6, revenue: 90000 },
        { product_id: 'prod_002', name: 'Red Kicks', orders: 4, revenue: 48000 },
        { product_id: 'prod_003', name: 'Black Formal', orders: 3, revenue: 54000 },
        { product_id: 'prod_004', name: 'Casual Shirt', orders: 3, revenue: 45000 },
        { product_id: 'prod_005', name: 'Denim Jeans', orders: 2, revenue: 48000 },
      ],
      payment_status: {
        paid: 16,
        pending: 1,
        failed: 1,
      },
      unique_customers: 20,
      repeat_purchase_rate: 0.25,
      customer_acquisition: 3,
      avg_customer_lifetime_value: 12500,
      orders_trend: { value: 4, is_positive: true },
      revenue_trend: { value: 25000, is_positive: true },
      aov_trend: { value: 300, is_positive: true },
      repeat_customers_trend: { value: 1, is_positive: true },
    });
  }

  if (dateRange === 'all_time') {
    return NextResponse.json({
      vendor_id: vendorId,
      date_range: 'all_time',
      total_orders: 142,
      total_revenue: 1450000,
      commission: 29000,
      avg_order_value: 10211,
      repeat_customers: 38,
      revenue_by_date: [
        { date: 'May', revenue: 180000, orders: 19 },
        { date: 'Jun', revenue: 240000, orders: 24 },
        { date: 'Jul', revenue: 310000, orders: 30 },
        { date: 'Aug', revenue: 380000, orders: 36 },
        { date: 'Sep', revenue: 340000, orders: 33 },
      ],
      top_products: [
        { product_id: 'prod_001', name: 'Blue Sneaker', orders: 42, revenue: 630000 },
        { product_id: 'prod_002', name: 'Red Kicks', orders: 32, revenue: 384000 },
        { product_id: 'prod_003', name: 'Black Formal', orders: 26, revenue: 468000 },
        { product_id: 'prod_004', name: 'Casual Shirt', orders: 24, revenue: 360000 },
        { product_id: 'prod_005', name: 'Denim Jeans', orders: 18, revenue: 432000 },
      ],
      payment_status: {
        paid: 124,
        pending: 12,
        failed: 6,
      },
      unique_customers: 168,
      repeat_purchase_rate: 0.28,
      customer_acquisition: 38,
      avg_customer_lifetime_value: 24500,
      orders_trend: { value: 35, is_positive: true },
      revenue_trend: { value: 180000, is_positive: true },
      aov_trend: { value: 1200, is_positive: true },
      repeat_customers_trend: { value: 8, is_positive: true },
    });
  }

  // Default: '30days', 'this_month', or 'custom'
  return NextResponse.json({
    vendor_id: vendorId,
    date_range: dateRange,
    custom_from: customFrom,
    custom_to: customTo,
    total_orders: 45,
    total_revenue: 450000,
    commission: 9000, // 2% of 450,000
    avg_order_value: 10000,
    repeat_customers: 12,
    revenue_by_date: [
      { date: 'Sep 01', revenue: 15000, orders: 2 },
      { date: 'Sep 03', revenue: 22000, orders: 2 },
      { date: 'Sep 05', revenue: 35000, orders: 3 },
      { date: 'Sep 08', revenue: 18000, orders: 1 },
      { date: 'Sep 10', revenue: 28000, orders: 3 },
      { date: 'Sep 12', revenue: 42000, orders: 4 },
      { date: 'Sep 14', revenue: 31000, orders: 3 },
      { date: 'Sep 16', revenue: 49000, orders: 5 },
      { date: 'Sep 18', revenue: 38000, orders: 4 },
      { date: 'Sep 20', revenue: 45000, orders: 4 },
      { date: 'Sep 21', revenue: 42000, orders: 4 },
      { date: 'Sep 22', revenue: 65000, orders: 6 },
      { date: 'Sep 23', revenue: 20000, orders: 2 },
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
  });
}
