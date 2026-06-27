import React, { useState } from 'react';
import { CloudSun } from 'lucide-react';
import { formatINRFull } from '@/lib/formatCurrency';

export default function BlueSkyTableReal({ blueSkyRows, totals, fyLabel = '' }) {
  const [remarks, setRemarks] = useState(() => blueSkyRows.map(() => ''));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            <CloudSun className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Blue Sky Pipeline{fyLabel ? ` · ${fyLabel}` : ''}
          </h3>
        </div>
        {/* Summary chips */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            Opening <span className="font-tabular font-semibold">{formatINRFull(blueSkyRows[0]?.opening)}</span>
          </span>
          {totals && (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
                Additional <span className="font-tabular font-semibold text-cbva-navy">{formatINRFull(totals.additional)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                Converted: {formatINRFull(totals.converted)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 320 }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Month</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Opening</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Additional</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Converted</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Closing</th>
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {blueSkyRows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">{row.month}</td>
                <td className="py-3 px-4 text-right font-tabular text-muted-foreground whitespace-nowrap">{formatINRFull(row.opening)}</td>
                <td className="py-3 px-4 text-right font-tabular text-cbva-navy whitespace-nowrap">{row.additional === null ? '—' : formatINRFull(row.additional)}</td>
                <td className="py-3 px-4 text-right font-tabular font-semibold text-emerald-600 whitespace-nowrap">{formatINRFull(row.converted)}</td>
                <td className="py-3 px-4 text-right font-tabular font-semibold text-foreground whitespace-nowrap">{formatINRFull(row.closing)}</td>
                <td className="py-3 px-4">
                  <input
                    className="w-full max-w-[200px] text-xs border border-transparent hover:border-border rounded px-1.5 py-0.5 bg-transparent focus:outline-none focus:border-ring focus:bg-white transition-colors text-muted-foreground placeholder:text-slate-400"
                    placeholder="Client converted..."
                    maxLength={40}
                    value={remarks[i] || ''}
                    onChange={e => setRemarks(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr className="bg-muted/30 border-t border-border">
                <td className="py-3 px-4 text-xs font-bold uppercase text-foreground">Total</td>
                <td className="py-3 px-4 text-right text-muted-foreground">—</td>
                <td className="py-3 px-4 text-right font-tabular font-bold text-cbva-navy whitespace-nowrap">{formatINRFull(totals.additional)}</td>
                <td className="py-3 px-4 text-right font-tabular font-bold text-emerald-700 whitespace-nowrap">{formatINRFull(totals.converted)}</td>
                <td className="py-3 px-4 text-right text-muted-foreground">—</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}