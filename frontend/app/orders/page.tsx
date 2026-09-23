import React from 'react';

export default function OrdersPage() {
  return (
    <section>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1>Orders</h1>
        <p style={{ color: '#6b7280', margin: 0 }}>Live incoming orders placed via WhatsApp bot and Paystack checkout.</p>
      </div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#ffffff', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Order ID</th>
              <th style={{ padding: '0.75rem 1rem' }}>Customer Phone</th>
              <th style={{ padding: '0.75rem 1rem' }}>Items</th>
              <th style={{ padding: '0.75rem 1rem' }}>Total (NGN)</th>
              <th style={{ padding: '0.75rem 1rem' }}>Payment Status</th>
              <th style={{ padding: '0.75rem 1rem' }}>Fulfillment</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                No customer orders recorded yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
