'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Lock, FileText, CheckCircle2 } from 'lucide-react';

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
        // Fallback to embedded NDPR compliance statement
      }
    };
    fetchPolicy();
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-200">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Privacy Policy &amp; Data Protection
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Nigeria Data Protection Regulation (NDPR) &amp; WhatsApp Commercial Communications Compliance
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6 text-sm text-slate-700 leading-relaxed">
        {remotePolicy ? (
          <div
            className="prose prose-slate max-w-none text-xs sm:text-sm"
            dangerouslySetInnerHTML={{ __html: remotePolicy }}
          />
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>1. Overview &amp; Scope</span>
              </h2>
              <p>
                Naija Marketplace (&ldquo;ShopPal&rdquo;) provides an automated conversational commerce platform enabling Nigerian retail merchants to showcase products, engage prospective shoppers, and accept secure payments via WhatsApp and Paystack. We take privacy seriously and adhere strictly to the Nigeria Data Protection Act (NDPA) and NDPR standards.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>2. Information Collected</span>
              </h2>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li><strong>Merchant Credentials:</strong> Business name, email, phone number, and bank account for automated settlements.</li>
                <li><strong>Customer Order Telemetry:</strong> WhatsApp customer phone numbers, cart items, delivery notes, and Paystack reference tokens.</li>
                <li><strong>Chat Transcripts:</strong> WhatsApp dialog between customers and the Claude AI agent for order fulfillment only. We do not sell or monetize personal customer transcripts.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>3. Payment Gateway Security</span>
              </h2>
              <p>
                All financial transactions and card data are handled through Paystack Payments Limited, a PCI-DSS certified processor. Naija Marketplace never stores or logs merchant or customer debit card CVVs or PINs.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>4. Merchant Rights &amp; Data Deletion</span>
              </h2>
              <p>
                Merchants retain full ownership of their product catalogs, images, and sales records. You may export your catalog or permanently wipe your account at any time via the Settings Danger Zone.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
