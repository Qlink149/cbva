import React from 'react';

export default function PlaceholderCard({ title, message }) {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 mb-2">{title}</p>
      <p className="text-sm text-slate-400 italic">{message}</p>
    </div>
  );
}