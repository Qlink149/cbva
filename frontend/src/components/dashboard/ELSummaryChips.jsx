import React from 'react';
import { formatINRFull } from '@/lib/formatCurrency';

function fmt(val) {
  return formatINRFull(val);
}

export default function ELSummaryChips({ summary, fyLabel }) {
  if (!summary) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] px-6 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        EL & Collections Summary · {fyLabel}
      </p>
      <div className="flex flex-wrap gap-2">
        {summary.elSigned != null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
            EL Signed: {fmt(summary.elSigned)}
          </span>
        )}
        {summary.elNotSigned != null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-semibold">
            EL Not Signed: {fmt(summary.elNotSigned)}
          </span>
        )}
        {summary.receivedTillApr2026 != null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            Received till Apr: {fmt(summary.receivedTillApr2026)}
          </span>
        )}
        {summary.receivedTillApr != null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            Received till Apr: {fmt(summary.receivedTillApr)}
          </span>
        )}
        {summary.receivedTillMay != null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            Received till May: {fmt(summary.receivedTillMay)}
          </span>
        )}
        {summary.receivedTillJun9 != null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            Received till Jun 9: {fmt(summary.receivedTillJun9)}
          </span>
        )}
        {summary.toReceiveMay != null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            Due May: {fmt(summary.toReceiveMay)}
          </span>
        )}
        {summary.toReceiveJune != null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            Due June: {fmt(summary.toReceiveJune)}
          </span>
        )}
        {summary.toReceiveJuly != null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            Due July: {fmt(summary.toReceiveJuly)}
          </span>
        )}
        {summary.totalTillJune != null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cbva-navy/10 text-cbva-navy rounded-full text-xs font-semibold">
            Total till June: {fmt(summary.totalTillJune)}
          </span>
        )}
      </div>
    </div>
  );
}
