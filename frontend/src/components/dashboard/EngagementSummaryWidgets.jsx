import React, { useMemo } from 'react';
import { formatINR } from '@/lib/formatCurrency';
import { FileText, PenLine } from 'lucide-react';

export default function EngagementSummaryWidgets({ engagements = [] }) {
  // Only Green engagements
  const greenEngs = useMemo(() => engagements.filter(e => e.status === 'Green'), [engagements]);

  // Engagement type split
  const typeSplit = useMemo(() => {
    const retainer = greenEngs.filter(e => e.engagement_type_name?.toLowerCase().includes('retainer'));
    const oneTime = greenEngs.filter(e => !e.engagement_type_name?.toLowerCase().includes('retainer'));
    return {
      retainer: { count: retainer.length, amount: retainer.reduce((s, e) => s + (e.amount || 0), 0) },
      oneTime: { count: oneTime.length, amount: oneTime.reduce((s, e) => s + (e.amount || 0), 0) },
    };
  }, [greenEngs]);

  // EL status split
  const elSplit = useMemo(() => {
    const signed = greenEngs.filter(e => e.el_signed === 'Signed');
    const notSigned = greenEngs.filter(e => e.el_signed === 'Not Signed');
    const na = greenEngs.filter(e => !e.el_signed || e.el_signed === 'NA');
    return {
      signed: { count: signed.length, amount: signed.reduce((s, e) => s + (e.amount || 0), 0) },
      notSigned: { count: notSigned.length, amount: notSigned.reduce((s, e) => s + (e.amount || 0), 0) },
      na: { count: na.length, amount: na.reduce((s, e) => s + (e.amount || 0), 0) },
    };
  }, [greenEngs]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Engagement Type Split */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-6 py-5 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Engagement Type Split</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Green pipeline only</p>
            </div>
          </div>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="bg-indigo-50 rounded-xl p-4 text-center border border-indigo-100">
            <p className="text-[10px] font-medium uppercase tracking-wider text-indigo-600 mb-1">Retainer</p>
            <p className="text-2xl font-bold font-tabular text-indigo-700">{typeSplit.retainer.count}</p>
            <p className="text-xs font-tabular text-indigo-600 mt-1">{formatINR(typeSplit.retainer.amount)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600 mb-1">One-Time / Assignment</p>
            <p className="text-2xl font-bold font-tabular text-slate-700">{typeSplit.oneTime.count}</p>
            <p className="text-xs font-tabular text-slate-600 mt-1">{formatINR(typeSplit.oneTime.amount)}</p>
          </div>
        </div>
      </div>

      {/* EL Status Split */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-6 py-5 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <PenLine className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Engagement Letter Status</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Green pipeline only</p>
            </div>
          </div>
        </div>
        <div className="p-6 grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
            <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 mb-1">Signed</p>
            <p className="text-xl font-bold font-tabular text-emerald-700">{elSplit.signed.count}</p>
            <p className="text-[10px] font-tabular text-emerald-600 mt-1">{formatINR(elSplit.signed.amount)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
            <p className="text-[10px] font-medium uppercase tracking-wider text-red-500 mb-1">Not Signed</p>
            <p className="text-xl font-bold font-tabular text-red-600">{elSplit.notSigned.count}</p>
            <p className="text-[10px] font-tabular text-red-500 mt-1">{formatINR(elSplit.notSigned.amount)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">Waived / N/A</p>
            <p className="text-xl font-bold font-tabular text-slate-600">{elSplit.na.count}</p>
            <p className="text-[10px] font-tabular text-slate-500 mt-1">{formatINR(elSplit.na.amount)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}