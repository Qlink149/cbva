import React from 'react';

export default function DisclaimerScroller() {
  return (
    <div className="w-full bg-amber-50 border-b border-amber-200/60 overflow-hidden py-1.5">
      <div className="flex items-center gap-0 overflow-hidden">
        <div
          className="flex whitespace-nowrap animate-[scroll_30s_linear_infinite]"
          style={{
            animation: 'disclaimerScroll 35s linear infinite',
          }}
        >
          {[...Array(4)].map((_, i) => (
            <span key={i} className="text-[11px] text-amber-700 font-medium px-8">
              ⚠ All numbers displayed on this dashboard are for illustrative purposes only and are subject to review.&nbsp;&nbsp;&nbsp;&nbsp;|
            </span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes disclaimerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}