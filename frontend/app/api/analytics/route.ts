import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get('vendor_id') || 'demo_vendor';
  const dateRange = searchParams.get('date_range') || '30days';
  const customFrom = searchParams.get('from');
  const customTo = searchParams.get('to');

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const apiKey = process.env.NEXT_PUBLIC_FRONTEND_API_KEY || 'nm_frontend_key_prod_v06';

  let liveOrders: any[] = [];

  try {
    const ordersRes = await fetch(`${backendUrl}/api/orders`, {
      headers: {
        'X-API-Key': apiKey,
      },
      cache: 'no-store',
    });

    if (ordersRes.ok) {
      const data = await ordersRes.json();
      if (Array.isArray(data.orders)) {
        liveOrders = data.orders;
      }
    }
  } catch {
    // Backend offline or unreachable
  }

  // If live orders exist, dynamically aggregate performance metrics
  if (liveOrders.length > 0) {
    const total_orders = liveOrders.length;
    let total_revenue = 0;
    let paid_orders = 0;
    let pending_orders = 0;
    let failed_orders = 0;
    const phoneMap: Record<string, number> = {};
    const productMap: Record<string, { name: string; orders: number; revenue: number }> = {};

    liveOrders.forEach((o) => {
      const amount = typeof o.total === 'string' ? parseFloat(o.total) || 0 : Number(o.total) || 0;
      const status = (o.payment_status || 'paid').toLowerCase();
      if (status === 'paid') {
        total_revenue += amount;
        paid_orders += 1;
      } else if (status === 'pending') {
        pending_orders += 1;
      } else {
        failed_orders += 1;
      }

      if (o.customer_phone) {
        phoneMap[o.customer_phone] = (phoneMap[o.customer_phone] || 0) + 1;
      }

      if (Array.isArray(o.items)) {
        o.items.forEach((item: any) => {
          const name = item.name || 'WhatsApp Product';
          if (!productMap[name]) {
            productMap[name] = { name, orders: 0, revenue: 0 };
          }
          productMap[name].orders += Number(item.quantity) || 1;
          productMap[name].revenue += (Number(item.quantity) || 1) * (Number(item.unit_price) || 0);
        });
      }
    });

    const uniqueCustomers = Object.keys(phoneMap).length;
    const repeatCustomers = Object.values(phoneMap).filter((count) => count > 1).length;
    const repeat_purchase_rate = uniqueCustomers > 0 ? Number((repeatCustomers / uniqueCustomers).toFixed(2)) : 0;
    const avg_order_value = total_orders > 0 ? Math.round(total_revenue / total_orders) : 0;
    const commission = Math.round(total_revenue * 0.02);

    const top_products = Object.entries(productMap)
      .map(([id, p]) => ({
        product_id: id,
        name: p.name,
        orders: p.orders,
        revenue: p.revenue,
      }))
      .slice(0, 5);

    return NextResponse.json({
      vendor_id: vendorId,
      date_range: dateRange,
      custom_from: customFrom,
      custom_to: customTo,
      total_orders,
      total_revenue,
      commission,
      avg_order_value,
      repeat_customers: repeatCustomers,
      revenue_by_date: [
        { date: 'Recent', revenue: total_revenue, orders: total_orders },
      ],
      top_products,
      payment_status: {
        paid: paid_orders,
        pending: pending_orders,
        failed: failed_orders,
      },
      unique_customers: uniqueCustomers,
      repeat_purchase_rate,
      customer_acquisition: uniqueCustomers,
      avg_customer_lifetime_value: avg_order_value,
      orders_trend: { value: total_orders, is_positive: true },
      revenue_trend: { value: total_revenue, is_positive: true },
      aov_trend: { value: avg_order_value, is_positive: true },
      repeat_customers_trend: { value: repeatCustomers, is_positive: true },
    });
  }

  // When unseeded / 0 live orders, return clean 0-state analytics
  return NextResponse.json({
    vendor_id: vendorId,
    date_range: dateRange,
    custom_from: customFrom,
    custom_to: customTo,
    total_orders: 0,
    total_revenue: 0,
    commission: 0,
    avg_order_value: 0,
    repeat_customers: 0,
    revenue_by_date: [],
    top_products: [],
    payment_status: {
      paid: 0,
      pending: 0,
      failed: 0,
    },
    unique_customers: 0,
    repeat_purchase_rate: 0,
    customer_acquisition: 0,
    avg_customer_lifetime_value: 0,
    orders_trend: { value: 0, is_positive: true },
    revenue_trend: { value: 0, is_positive: true },
    aov_trend: { value: 0, is_positive: true },
    repeat_customers_trend: { value: 0, is_positive: true },
  });
}
