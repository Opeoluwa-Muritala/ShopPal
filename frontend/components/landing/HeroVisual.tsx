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
      }, delay + 300);
      return () => clearTimeout(timer);
    });
  }, []);

  return (
    <div className="relative flex w-full max-w-[700px] items-center justify-center lg:justify-end" aria-label="ShopPal product checkout showcase">
      <div className="relative flex w-full justify-center lg:justify-end">
        <div className="relative w-[270px] overflow-hidden rounded-[42px] border border-white/10 bg-[#111417] shadow-[0_30px_90px_rgba(0,0,0,0.65)] lg:w-[300px]">
          <div className="bg-[#075E54] px-4 pb-3 pt-4">
            <div className="mb-3 flex items-center justify-between text-[10px] font-medium text-white/90">
              <span>9:41</span>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-white/90" />
                <span className="h-2 w-2 rounded-full bg-white/70" />
                <span className="h-2 w-2 rounded-full bg-white/50" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/80">←</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white">SP</div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-white">ShopPal Store</p>
                <p className="text-[9px] text-emerald-100">Online now</p>
              </div>
              <span className="text-[11px] text-white/80">⋯</span>
            </div>
          </div>

          <div className="space-y-3 bg-[#f4efe8] p-3 pb-4 text-[11px]">
            <div className="flex justify-center">
              <span className="rounded-full bg-[#e6ded2] px-2 py-0.5 text-[9px] font-medium text-[#56483a]">Today</span>
            </div>

            <div
              className="flex justify-end transition-all duration-500 ease-out"
              style={{
                opacity: visibleBubbles.includes(1) ? 1 : 0,
                transform: visibleBubbles.includes(1) ? 'translateY(0)' : 'translateY(8px)',
              }}
            >
              <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3 py-2 text-slate-900">
                <p>Do you have blue sneakers? How much?</p>
                <span className="mt-1 block text-right text-[9px] text-slate-500">10:14 ✓✓</span>
              </div>
            </div>

            <div
              className="flex justify-start transition-all duration-500 ease-out"
              style={{
                opacity: visibleBubbles.includes(2) ? 1 : 0,
                transform: visibleBubbles.includes(2) ? 'translateY(0)' : 'translateY(8px)',
              }}
            >
              <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-white px-3 py-2 text-slate-900 shadow-sm">
                <p className="font-semibold text-emerald-700">Yes! We have it.</p>
                <p className="mt-1">
                  Blue Canvas Sneaker
                  <br />
                  <span className="font-bold text-emerald-700">₦15,000</span>
                </p>
              </div>
            </div>

            <div
              className="flex justify-end transition-all duration-500 ease-out"
              style={{
                opacity: visibleBubbles.includes(3) ? 1 : 0,
                transform: visibleBubbles.includes(3) ? 'translateY(0)' : 'translateY(8px)',
              }}
            >
              <div className="max-w-[75%] rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3 py-2 text-slate-900">
                <p>Add 2 to cart</p>
                <span className="mt-1 block text-right text-[9px] text-slate-500">10:15 ✓✓</span>
              </div>
            </div>

            <div
              className="flex justify-start transition-all duration-500 ease-out"
              style={{
                opacity: visibleBubbles.includes(4) ? 1 : 0,
                transform: visibleBubbles.includes(4) ? 'translateY(0)' : 'translateY(8px)',
              }}
            >
              <div className="w-full overflow-hidden rounded-2xl rounded-tl-md border border-emerald-100 bg-white shadow-sm">
                <div className="px-3 pb-2 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-800">Order #ORD-4821</span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700">Ready</span>
                  </div>
                  <p className="text-[10px] text-slate-500">2 × Blue Canvas Sneaker</p>
                  <p className="mt-2 text-[12px] font-bold text-slate-800">Total: ₦30,000</p>
                </div>
                <button className="w-full bg-[#2a52be] px-3 py-2 text-[10px] font-bold text-white">Pay ₦30,000</button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-slate-200 bg-[#f0f0f0] px-3 py-2">
            <div className="flex-1 rounded-full bg-white px-3 py-1.5 text-[10px] text-slate-400">Type a message</div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2a52be] text-sm text-white">➤</div>
          </div>
        </div>

        <div className="absolute -right-2 top-10 hidden rounded-full border border-[#2a52be]/40 bg-[#2a52be]/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#dfe9ff] backdrop-blur-sm md:block">
          Keep 98%
        </div>
      </div>

    </div>
  );
}
