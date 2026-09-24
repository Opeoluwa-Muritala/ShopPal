'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  const [remotePolicy, setRemotePolicy] = useState<string | null>(null);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${API_BASE}/privacy`);
        if (res.ok) {
          const text = await res.text();
          setRemotePolicy(text);
        }
      } catch {
        // Fallback
      }
    };
    fetchPolicy();
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8">
      <div>
        <Link
          href="/"
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 mb-4 inline-block"
        >
          &larr; Back to Home
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Privacy Policy &amp; Data Protection
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Nigeria Data Protection Regulation (NDPR) &amp; Commercial Communications Compliance
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-10 space-y-6 text-sm text-slate-700 leading-relaxed">
        {remotePolicy ? (
          <div
            className="prose prose-slate max-w-none text-xs sm:text-sm"
            dangerouslySetInnerHTML={{ __html: remotePolicy }}
          />
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                1. Overview &amp; Scope
              </h2>
              <p>
                ShopPal provides an automated conversational commerce platform enabling Nigerian retail merchants to showcase products, engage prospective shoppers, and accept secure payments via WhatsApp and Paystack. We take privacy seriously and adhere strictly to the Nigeria Data Protection Act (NDPA) and NDPR standards.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                2. Information Collected
              </h2>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs sm:text-sm">
                <li><strong>Merchant Credentials:</strong> Business name, email, phone number, and bank account for automated settlements.</li>
                <li><strong>Customer Order Telemetry:</strong> WhatsApp customer phone numbers, cart items, delivery notes, and Paystack reference tokens.</li>
                <li><strong>Chat Transcripts:</strong> WhatsApp dialog between customers and the AI agent for order fulfillment only. We do not sell or monetize personal customer transcripts.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                3. Payment Gateway Security
              </h2>
              <p>
                All financial transactions and card data are handled through Paystack Payments Limited, a PCI-DSS certified processor. ShopPal never stores or logs merchant or customer debit card CVVs or PINs.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">
                4. Merchant Rights &amp; Data Deletion
              </h2>
              <p>
                Merchants retain full ownership of their product catalogs, images, and sales records. You may export your catalog or permanently wipe your account at any time via Settings.
              </p>
            </section>
          </>
        )}

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>Last reviewed: September 2025</span>
          <span>NDPR &amp; NDPA Compliant Platform</span>
        </div>
      </div>
    </div>
  );
}
