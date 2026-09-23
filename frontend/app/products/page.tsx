import React from 'react';

export default function ProductsPage() {
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1>Product Catalog</h1>
          <p style={{ color: '#6b7280', margin: 0 }}>Manage inventory available to customers via WhatsApp bot.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Upload CSV
          </button>
          <button
            type="button"
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '0.375rem',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            + Add Product
          </button>
        </div>
      </div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '2rem', textAlign: 'center', backgroundColor: '#ffffff' }}>
        <p style={{ color: '#6b7280' }}>No products added yet. Add a single product or upload a CSV file to begin.</p>
      </div>
    </section>
  );
}
