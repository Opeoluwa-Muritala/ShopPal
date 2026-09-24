'use client';

import React from 'react';
import Link from 'next/link';
import { ProductItem } from './CSVUploadZone';

export interface SuccessData {
  vendor_id?: string;
  bot_number: string;
  test_link: string;
  sandbox_code: string;
}

interface Step4Props {
  vendorName: string;
  businessName: string;
  products: ProductItem[];
  successData: SuccessData;
}

export default function Step4Success({
  vendorName,
  businessName,
  products,
  successData,
}: Step4Props) {
  const [copied, setCopied] = React.useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(`join ${successData.sandbox_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappDirectUrl = `https://wa.me/${successData.bot_number.replace(/\D/g, '')}?text=${encodeURIComponent(
    `join ${successData.sandbox_code}`
  )}`;

  return (
    <div className="text-center space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 text-xs font-semibold uppercase tracking-wider rounded-md border border-slate-200">
          Setup Complete
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">You&apos;re Live!</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Welcome {vendorName || 'Vendor'}. Your ShopPal automated WhatsApp storefront for{' '}
          <strong>{businessName || 'your store'}</strong> is ready to accept customer orders.
        </p>
      </div>

      {/* Bot Connection Card */}
      <div className="p-5 bg-white border border-slate-200 rounded-lg text-left space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
            WhatsApp AI Storefront
          </span>
          <span className="text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 font-mono">
            Vendor ID: {successData.vendor_id || 'Active'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50 p-3 rounded border border-slate-200">
            <span className="text-slate-500 block text-xs">WhatsApp Number:</span>
            <strong className="text-slate-900 font-mono text-sm block mt-1">
              {successData.bot_number}
            </strong>
          </div>

          <div className="bg-slate-50 p-3 rounded border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-slate-500 block text-xs">Sandbox Join Code:</span>
              <strong className="text-slate-900 font-mono text-sm block mt-1">
                join {successData.sandbox_code}
              </strong>
            </div>
            <button
              type="button"
              onClick={copyCode}
              title="Copy sandbox code"
              className="px-2.5 py-1 text-xs rounded border border-slate-300 hover:bg-white text-slate-700 font-medium transition"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>

          </div>
        </div>

        {/* WhatsApp Test Link */}
        <div>
          <a
            href={whatsappDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded transition"
          >
            Open in WhatsApp
          </a>
        </div>
      </div>

      {/* Catalog Preview */}
      {products.length > 0 && (
        <div className="p-4 bg-white border border-slate-200 rounded-lg text-left space-y-3">
          <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
            <span className="font-bold text-slate-900">Initial Products</span>
            <span className="text-slate-600 font-medium">{products.length} products loaded</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {products.slice(0, 3).map((p, idx) => (
              <div key={idx} className="p-2.5 bg-slate-50 rounded border border-slate-200 flex flex-col justify-between">
                <span className="text-slate-900 font-semibold truncate block">{p.name}</span>
                <div className="mt-2 flex justify-between items-center text-xs">
                  <span className="text-slate-900 font-bold">₦{p.price.toLocaleString()}</span>
                  <span className="text-slate-500">{p.stock} units</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-left space-y-2 text-xs">
        <span className="font-bold text-slate-900 block text-sm">Next Steps:</span>
        <ol className="space-y-1.5 text-slate-600 list-decimal list-inside">
          <li>
            Open WhatsApp and send <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">join {successData.sandbox_code}</code> to <span className="font-mono text-slate-800">{successData.bot_number}</span>.
          </li>
          <li>
            Send a greeting like &quot;Hello&quot; or search for any of your products.
          </li>
          <li>
            Go to your merchant dashboard to view orders and update products in real time.
          </li>
        </ol>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <Link
          href="/dashboard"
          className="w-full sm:flex-1 h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded flex items-center justify-center transition"
        >
          Go to Dashboard
        </Link>
        <a
          href={whatsappDirectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto px-6 h-12 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-medium text-sm rounded flex items-center justify-center transition"
        >
          Test on WhatsApp
        </a>
      </div>
    </div>
  );
}
