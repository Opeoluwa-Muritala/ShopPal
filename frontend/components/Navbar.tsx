import React from 'react';
import Link from 'next/link';

export default function Navbar() {
  return (
    <header style={{ borderBottom: '1px solid #e5e7eb', padding: '1rem 2rem', backgroundColor: '#ffffff' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link href="/" style={{ fontSize: '1.25rem', fontWeight: 'bold', textDecoration: 'none', color: '#111827' }}>
            Naija Marketplace
          </Link>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <Link href="/" style={{ textDecoration: 'none', color: '#4b5563', fontSize: '0.95rem' }}>
              Dashboard
            </Link>
            <Link href="/products" style={{ textDecoration: 'none', color: '#4b5563', fontSize: '0.95rem' }}>
              Products
            </Link>
            <Link href="/orders" style={{ textDecoration: 'none', color: '#4b5563', fontSize: '0.95rem' }}>
              Orders
            </Link>
            <Link href="/settings" style={{ textDecoration: 'none', color: '#4b5563', fontSize: '0.95rem' }}>
              Settings
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/login" style={{ textDecoration: 'none', color: '#4b5563', fontSize: '0.95rem', padding: '0.5rem 1rem' }}>
            Log in
          </Link>
          <Link
            href="/signup"
            style={{
              textDecoration: 'none',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              fontSize: '0.95rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontWeight: 500,
            }}
          >
            Sign up
          </Link>
        </div>
      </nav>
    </header>
  );
}
