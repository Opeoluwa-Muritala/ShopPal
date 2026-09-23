'use client';

import React, { useState } from 'react';
import { X, Send, Megaphone, CheckCircle2, Copy } from 'lucide-react';

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent?: (message: string) => void;
}

export default function BroadcastModal({
  isOpen,
  onClose,
  onSent,
}: BroadcastModalProps) {
  const [message, setMessage] = useState(
    '🎉 Special Promo! Get 10% off your next order today when you chat with our WhatsApp bot. Reply with "PROMO10" to claim your discount!'
  );
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  if (!isOpen) return null;

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSend = () => {
    setStatus('sending');
    setTimeout(() => {
      setStatus('sent');
      if (onSent) onSent(message);
      setTimeout(() => {
        setStatus('idle');
        onClose();
      }, 1500);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Customer Broadcast</h3>
              <p className="text-xs text-slate-500">Reach customers who previously ordered from your bot</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close broadcast modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Broadcast Message
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition resize-none text-slate-900"
              placeholder="Type your announcement or discount offer..."
            />
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
              <span>Supports Pidgin and English</span>
              <span>{message.length} characters</span>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <span className="text-xs font-semibold text-slate-500 block mb-1.5">Quick Templates:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setMessage('✨ New stock just arrived! Check out our latest Ankara fabrics and shoes in the catalog today.')
                }
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
              >
                ✨ New Stock Arrival
              </button>
              <button
                type="button"
                onClick={() =>
                  setMessage('⚡ Weekend Flash Sale! Free delivery across Lagos for orders above ₦25,000 this Saturday.')
                }
                className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
              >
                ⚡ Weekend Flash Sale
              </button>
            </div>
          </div>

          {/* Audience Preview */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
            <span>Estimated Audience:</span>
            <strong className="font-bold">48 WhatsApp Customers</strong>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 transition"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy Text'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={status === 'sending' || status === 'sent'}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>
                {status === 'sending' ? 'Broadcasting...' : status === 'sent' ? 'Sent!' : 'Send Broadcast'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
