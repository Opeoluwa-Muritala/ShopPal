'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, MessageCircle, ArrowRight, ExternalLink, Sparkles, Copy, Check } from 'lucide-react';
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
    <div className="text-center space-y-6 animate-fadeIn">
      {/* Header with celebratory badge */}
      <div className="space-y-2">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center text-3xl shadow-md shadow-emerald-100 animate-bounce">
          🎉
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">You&apos;re Live!</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Congratulations <strong>{vendorName}</strong>! Your WhatsApp AI storefront for{' '}
          <strong>{businessName || 'your store'}</strong> is active and ready to take customer orders.
        </p>
      </div>

      {/* Bot Connection Card */}
      <div className="p-5 bg-emerald-50/80 border border-emerald-300/80 rounded-2xl text-left space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
              Active WhatsApp AI Bot
            </span>
          </div>
          <span className="text-xs text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-mono">
            ID: {successData.vendor_id || 'v_9042'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-white p-3 rounded-xl border border-emerald-200/60">
            <span className="text-slate-500 block text-[11px]">Bot WhatsApp Number:</span>
            <strong className="text-slate-900 font-mono text-sm block mt-0.5">
              {successData.bot_number}
            </strong>
          </div>

          <div className="bg-white p-3 rounded-xl border border-emerald-200/60 flex items-center justify-between">
            <div>
              <span className="text-slate-500 block text-[11px]">Twilio Sandbox Code:</span>
              <strong className="text-emerald-800 font-mono text-sm block mt-0.5">
                join {successData.sandbox_code}
              </strong>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              title="Copy sandbox code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* WhatsApp Test Link */}
        <div className="pt-1">
          <a
            href={whatsappDirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#25D366] hover:bg-[#1ebd59] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>Click to Test on WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Catalog Preview of Uploaded Products */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl text-left space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-900">Your Live WhatsApp Products</span>
          <span className="text-emerald-700 font-semibold">{products.length} products loaded</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {products.slice(0, 3).map((p, idx) => (
            <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
              <strong className="text-slate-900 truncate block">{p.name}</strong>
              <div className="mt-1 flex justify-between items-center text-[11px]">
                <span className="text-emerald-700 font-bold">₦{p.price.toLocaleString()}</span>
                <span className="text-slate-500">{p.stock} units</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps Guidance */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2.5 text-xs">
        <span className="font-bold text-slate-900 block text-sm">Next Steps:</span>
        <ol className="space-y-2 text-slate-600 list-decimal list-inside">
          <li>
            <strong>Join the sandbox:</strong> Open WhatsApp and send <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-emerald-800">join {successData.sandbox_code}</code> to <span className="font-mono">{successData.bot_number}</span>.
          </li>
          <li>
            <strong>Test a message:</strong> Type <span className="italic">&quot;Hello&quot;</span> or <span className="italic">&quot;You get shoe?&quot;</span> to see Claude respond in Nigerian Pidgin!
          </li>
          <li>
            <strong>Go to Dashboard:</strong> Monitor orders in real-time, view Paystack settlement analytics, and manage stock.
          </li>
        </ol>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <Link
          href="/dashboard"
          className="w-full sm:flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2"
        >
          <span>Go to Dashboard</span>
          <ArrowRight className="w-5 h-5" />
        </Link>
        <a
          href={whatsappDirectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto px-6 h-14 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold text-sm rounded-xl transition flex items-center justify-center gap-1.5"
        >
          <MessageCircle className="w-4 h-4 text-emerald-600" />
          <span>Test on WhatsApp</span>
        </a>
      </div>
    </div>
  );
}
