import React from 'react';

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid #e5e7eb', padding: '1.5rem 2rem', marginTop: 'auto', backgroundColor: '#f9fafb' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
        <p>© {new Date().getFullYear()} Naija Marketplace (EcomBot). All rights reserved.</p>
        <p>WhatsApp Conversational Commerce for Nigerian Merchants</p>
      </div>
    </footer>
  );
}
