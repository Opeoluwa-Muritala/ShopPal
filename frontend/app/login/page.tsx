import React from 'react';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <section style={{ maxWidth: '400px', margin: '3rem auto', padding: '2rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#ffffff' }}>
      <h2>Vendor Login</h2>
      <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Access your merchant dashboard</p>
      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
        <div>
          <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            Email address
          </label>
          <input
            id="email"
            type="email"
            placeholder="merchant@example.com"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label htmlFor="password" style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', boxSizing: 'border-box' }}
          />
        </div>
        <button
          type="button"
          style={{
            padding: '0.625rem',
            backgroundColor: '#16a34a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.375rem',
            fontWeight: 500,
            cursor: 'pointer',
            marginTop: '0.5rem',
          }}
        >
          Sign In
        </button>
      </form>
      <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" style={{ color: '#16a34a', textDecoration: 'none', fontWeight: 500 }}>
          Sign up
        </Link>
      </p>
    </section>
  );
}
