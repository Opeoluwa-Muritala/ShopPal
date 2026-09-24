'use client';

import React, { useEffect, useState } from 'react';

interface ChatBubble {
  id: number;
  type: 'customer' | 'bot' | 'payment' | 'verified';
  delay: number;
}

const bubbles: ChatBubble[] = [
  { id: 1, type: 'customer', delay: 0 },
  { id: 2, type: 'bot', delay: 600 },
  { id: 3, type: 'customer', delay: 1200 },
  { id: 4, type: 'payment', delay: 1800 },
  { id: 5, type: 'verified', delay: 2400 },
];

export default function HeroVisual() {
  const [visibleBubbles, setVisibleBubbles] = useState<number[]>([]);

  useEffect(() => {
    bubbles.forEach(({ id, delay }) => {
      const timer = setTimeout(() => {
        setVisibleBubbles((prev) => [...prev, id]);
      }, delay + 300); // small offset so first bubble doesn't flash immediately
      return () => clearTimeout(timer);
    });
  }, []);

  return (
    <div
      className="relative flex items-center justify-center w-full"
      aria-label="WhatsApp conversation showing customer ordering shoes"
    >
      {/* Ambient glow behind phone */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full bg-green-500/15 blur-3xl" />
      </div>

      {/* Phone frame */}
      <div className="relative w-[300px] lg:w-[320px] flex-shrink-0">
        {/* Outer shell */}
        <div
          className="relative rounded-[42px] bg-[#1c1c1e] shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.08)] overflow-hidden"
          style={{ padding: '10px' }}
        >
          {/* Side buttons (decorative) */}
          <div className="absolute -right-[3px] top-24 w-[3px] h-12 bg-[#3a3a3c] rounded-r-full" />
          <div className="absolute -left-[3px] top-20 w-[3px] h-8 bg-[#3a3a3c] rounded-l-full" />
          <div className="absolute -left-[3px] top-32 w-[3px] h-8 bg-[#3a3a3c] rounded-l-full" />

          {/* Inner screen */}
          <div className="rounded-[34px] overflow-hidden bg-[#EFEAE2] flex flex-col">
            {/* Status bar */}
            <div className="bg-[#075E54] px-4 pt-3 pb-0">
              <div className="flex items-center justify-between text-white text-[10px] mb-2">
                <span className="font-medium">9:41</span>
                <div className="flex items-center gap-1">
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor">
                    <rect x="0" y="4" width="2" height="6" rx="0.5" />
                    <rect x="3" y="2.5" width="2" height="7.5" rx="0.5" />
                    <rect x="6" y="1" width="2" height="9" rx="0.5" />
                    <rect x="9" y="0" width="2" height="10" rx="0.5" />
                  </svg>
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
                    <path d="M7 2.5C9.2 2.5 11.2 3.4 12.6 4.9L14 3.4C12.2 1.3 9.7 0 7 0S1.8 1.3 0 3.4L1.4 4.9C2.8 3.4 4.8 2.5 7 2.5Z" />
                    <path d="M7 5.5C8.4 5.5 9.7 6.1 10.6 7L12 5.5C10.8 4.2 9 3.5 7 3.5S3.2 4.2 2 5.5L3.4 7C4.3 6.1 5.6 5.5 7 5.5Z" />
                    <circle cx="7" cy="9" r="1.5" />
                  </svg>
                  <svg width="22" height="10" viewBox="0 0 22 10" fill="currentColor">
                    <rect x="0" y="1" width="18" height="8" rx="2" stroke="currentColor" strokeWidth="1" fill="none" />
                    <rect x="1.5" y="2.5" width="13" height="5" rx="1" />
                    <path d="M19 3.5v3c.8-.3 1.3-1 1.3-1.5S19.8 3.8 19 3.5Z" />
                  </svg>
                </div>
              </div>

              {/* WhatsApp chat header */}
              <div className="flex items-center gap-3 pb-3">
                <button className="text-white opacity-80">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
                  SP
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-[12px] leading-tight">ShopPal Storefront</p>
                  <p className="text-emerald-200 text-[10px]">Online · replies instantly</p>
                </div>
                <div className="flex gap-3 text-white opacity-80">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.21a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.61 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 p-3 space-y-2.5 text-[11px] min-h-[340px] overflow-hidden">
              {/* Date divider */}
              <div className="flex justify-center">
                <span className="bg-[#d1c4b0]/80 px-2.5 py-0.5 rounded-full text-[#5d4e37] text-[9px] font-medium">
                  Today
                </span>
              </div>

              {/* Bubble 1 - Customer */}
              <div
                className="flex justify-end transition-all duration-500 ease-out"
                style={{
                  opacity: visibleBubbles.includes(1) ? 1 : 0,
                  transform: visibleBubbles.includes(1) ? 'translateY(0)' : 'translateY(8px)',
                }}
              >
                <div className="bg-[#D9FDD3] text-slate-900 px-2.5 py-2 rounded-xl rounded-tr-sm max-w-[85%] shadow-sm">
                  <p className="leading-snug">Do you have blue sneakers? How much?</p>
                  <span className="text-[9px] text-slate-500 block text-right mt-0.5">10:14 AM ✓✓</span>
                </div>
              </div>

              {/* Bubble 2 - Bot */}
              <div
                className="flex justify-start transition-all duration-500 ease-out"
                style={{
                  opacity: visibleBubbles.includes(2) ? 1 : 0,
                  transform: visibleBubbles.includes(2) ? 'translateY(0)' : 'translateY(8px)',
                }}
              >
                <div className="bg-white text-slate-900 px-2.5 py-2 rounded-xl rounded-tl-sm max-w-[90%] shadow-sm">
                  <p className="font-semibold text-emerald-800">Yeah! We get am 👟</p>
                  <p className="mt-1">
                    <strong>Blue Canvas Sneaker</strong>
                    <br />
                    Price:{' '}
                    <strong className="text-emerald-700">₦15,000</strong>
                  </p>
                  <p className="mt-1 text-slate-500">How many pairs you want?</p>
                  <span className="text-[9px] text-slate-400 block text-right mt-0.5">10:14 AM</span>
                </div>
              </div>

              {/* Bubble 3 - Customer */}
              <div
                className="flex justify-end transition-all duration-500 ease-out"
                style={{
                  opacity: visibleBubbles.includes(3) ? 1 : 0,
                  transform: visibleBubbles.includes(3) ? 'translateY(0)' : 'translateY(8px)',
                }}
              >
                <div className="bg-[#D9FDD3] text-slate-900 px-2.5 py-2 rounded-xl rounded-tr-sm max-w-[75%] shadow-sm">
                  <p>Add 2 to cart</p>
                  <span className="text-[9px] text-slate-500 block text-right mt-0.5">10:15 AM ✓✓</span>
                </div>
              </div>

              {/* Bubble 4 - Payment card */}
              <div
                className="flex justify-start transition-all duration-500 ease-out"
                style={{
                  opacity: visibleBubbles.includes(4) ? 1 : 0,
                  transform: visibleBubbles.includes(4) ? 'translateY(0)' : 'translateY(8px)',
                }}
              >
                <div className="bg-white rounded-xl rounded-tl-sm max-w-[95%] shadow-sm overflow-hidden border border-emerald-100">
                  <div className="px-2.5 pt-2.5 pb-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[10px] text-slate-900">Order #ORD-4821</span>
                      <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                        Ready
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">2× Blue Canvas Sneaker</p>
                    <p className="text-[12px] font-bold text-slate-900 mt-1">Total: ₦30,000</p>
                  </div>
                  <button className="w-full bg-emerald-600 text-white text-[10px] font-bold py-2 text-center">
                    🔒 Pay ₦30,000 via Paystack
                  </button>
                  <div className="px-2.5 py-1">
                    <span className="text-[9px] text-slate-400 block text-right">10:15 AM</span>
                  </div>
                </div>
              </div>

              {/* Bubble 5 - Verified */}
              <div
                className="flex justify-center transition-all duration-500 ease-out"
                style={{
                  opacity: visibleBubbles.includes(5) ? 1 : 0,
                  transform: visibleBubbles.includes(5) ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.97)',
                }}
              >
                <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 px-3 py-2 rounded-xl text-center text-[10px] shadow-sm w-full">
                  <p className="font-bold">✓ Payment Verified! (₦30,000 received)</p>
                  <p className="text-[9px] text-emerald-700 mt-0.5">Receipt sent · Vendor notified</p>
                </div>
              </div>
            </div>

            {/* Input bar */}
            <div className="bg-[#F0F0F0] px-3 py-2.5 flex items-center gap-2">
              <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[10px] text-slate-400 flex items-center">
                Type a message
              </div>
              <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Floating badge - 98% */}
        <div className="absolute -top-3 -right-8 bg-green-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg shadow-green-500/30 animate-float">
          Keep 98% 💸
        </div>

        {/* Floating badge - instant */}
        <div className="absolute -bottom-2 -left-8 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-[11px] font-medium px-3 py-1.5 rounded-full shadow-lg animate-float-delay">
          ⚡ Instant settlement
        </div>
      </div>
    </div>
  );
}
