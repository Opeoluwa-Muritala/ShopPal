import React from 'react';

export default function SettingsPage() {
  return (
    <section>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1>Settings & Integrations</h1>
        <p style={{ color: '#6b7280', margin: 0 }}>Configure Paystack payment keys and WhatsApp messaging credentials.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem', backgroundColor: '#ffffff' }}>
          <h3>Paystack Configuration</h3>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Provide your Paystack public key to receive direct customer payments.</p>
          <div style={{ marginTop: '1rem' }}>
            <label htmlFor="paystack-key" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
              Public Key
            </label>
            <input
              id="paystack-key"
              type="password"
              defaultValue="pk_test_placeholder"
              disabled
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#f3f4f6' }}
            />
          </div>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem', backgroundColor: '#ffffff' }}>
          <h3>WhatsApp Bot Gateway</h3>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Twilio Sandbox connection for WhatsApp messaging.</p>
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ height: '10px', width: '10px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span>
            <span style={{ fontSize: '0.875rem', color: '#374151' }}>Sandbox Active</span>
          </div>
        </div>
      </div>
    </section>
  );
}
