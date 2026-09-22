import React from 'react';

export default function DashboardPage() {
  return (
    <section>
      <h1>Vendor Dashboard</h1>
      <p>Welcome to Naija Marketplace (EcomBot) merchant portal.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.25rem', backgroundColor: '#ffffff' }}>
          <h3>Total Sales</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0' }}>₦0.00</p>
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>No orders yet</span>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.25rem', backgroundColor: '#ffffff' }}>
          <h3>Active Orders</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0' }}>0</p>
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Pending fulfillment</span>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.25rem', backgroundColor: '#ffffff' }}>
          <h3>Products in Catalog</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0' }}>0</p>
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Ready for WhatsApp buyers</span>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.25rem', backgroundColor: '#ffffff' }}>
          <h3>WhatsApp Bot Status</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: '#16a34a' }}>Ready</p>
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Twilio Sandbox connected</span>
        </div>
      </div>
    </section>
  );
}
