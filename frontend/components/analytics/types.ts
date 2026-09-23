export type DateRangeKey = '7days' | '30days' | 'this_month' | 'all_time' | 'custom';

export interface DateRangeOption {
  key: DateRangeKey;
  label: string;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders?: number;
}

export interface TopProduct {
  product_id: string;
  name: string;
  orders: number;
  revenue: number;
  price?: number;
  image_url?: string;
}

export interface PaymentStatus {
  paid: number;
  pending: number;
  failed: number;
}

export interface MetricTrend {
  value: number;
  is_positive: boolean;
  text?: string;
}

export interface AnalyticsData {
  total_orders: number;
  total_revenue: number;
  commission: number; // Platform fee (e.g. 2% = 9000 for 450000)
  avg_order_value: number;
  repeat_customers: number;
  revenue_by_date: RevenueDataPoint[];
  top_products: TopProduct[];
  payment_status: PaymentStatus;
  unique_customers: number;
  repeat_purchase_rate: number; // e.g. 0.23 (23%)
  customer_acquisition: number; // e.g. 8 this month
  avg_customer_lifetime_value: number; // e.g. 18500
  // Comparative trends vs previous period
  orders_trend?: MetricTrend;
  revenue_trend?: MetricTrend;
  aov_trend?: MetricTrend;
  repeat_customers_trend?: MetricTrend;
}
