import React, { useState, useEffect } from 'react';
import { CloudSun } from 'lucide-react';
import { formatINRFull } from '@/lib/formatCurrency';

function fmtCell(val) {
  if (val === null || val === undefined || val === '') return '—';
  return formatINRFull(val);
}

export default function BlueSkyTableReal({ blueSkyRows = [], totals, fyLabel = '' }) {
  const [remarks, setRemarks] = useState(() => blueSkyRows.map((r) => r.remarks || ''));

  useEffect(() => {
    setRemarks(blueSkyRows.map((r) => r.remarks || ''));
  }, [blueSkyRows]);

  const firstWithData = blueSkyRows.find((r) => r.has_data !== false && r.opening != null);
  const openingChip = firstWithData?.opening ?? totals?.opening;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            <CloudSun className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Blue Sky Pipeline{fyLabel ? ` · ${fyLabel}` : ''}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            Opening <span className="font-tabular font-semibold">{fmtCell(openingChip)}</span>
          </span>
          {totals && (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
                Additional <span className="font-tabular font-semibold text-cbva-navy">{fmtCell(totals.additional)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                Converted: {fmtCell(totals.converted)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Month</th>
              <th className="text-right py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Opening</th>
              <th className="text-right py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Additional</th>
              <th className="text-right py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Converted</th>
              <th className="text-right py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Closing</th>
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-remarks">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {blueSkyRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No blue sky rows for this period</td>
              </tr>
            ) : blueSkyRows.map((row, i) => {
              const noData = row.has_data === false;
              return (
                <tr key={row.month_key || row.monthKey || row.month || i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 font-medium text-foreground col-num">
                    <span className="inline-flex items-center gap-2">
                      {row.month}
                      {row.is_current_month && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700">
                          Current
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={`py-3 text-right font-tabular col-num ${noData ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                    {fmtCell(row.opening)}
                  </td>
                  <td className={`py-3 text-right font-tabular col-num ${noData ? 'text-muted-foreground' : 'text-cbva-navy'}`}>
                    {fmtCell(row.additional)}
                  </td>
                  <td className={`py-3 text-right font-tabular font-semibold col-num ${noData ? 'text-muted-foreground' : 'text-emerald-600'}`}>
                    {fmtCell(row.converted)}
                  </td>
                  <td className={`py-3 text-right font-tabular font-semibold col-num ${noData ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {fmtCell(row.closing)}
                  </td>
                  <td className="py-3 px-4 col-remarks">
                    {noData ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <input
                        className="w-full max-w-[200px] text-xs border border-transparent hover:border-border rounded px-1.5 py-0.5 bg-transparent focus:outline-none focus:border-ring focus:bg-white transition-colors text-muted-foreground placeholder:text-slate-400"
                        placeholder="Client converted..."
                        maxLength={40}
                        value={remarks[i] || ''}
                        onChange={e => setRemarks(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {totals && blueSkyRows.length > 0 && (
            <tfoot>
              <tr className="bg-muted/30 border-t border-border">
                <td className="py-3 text-xs font-bold uppercase text-foreground col-num">Total</td>
                <td className="py-3 text-right font-tabular font-bold text-foreground col-num">{fmtCell(totals.opening)}</td>
                <td className="py-3 text-right font-tabular font-bold text-cbva-navy col-num">{fmtCell(totals.additional)}</td>
                <td className="py-3 text-right font-tabular font-bold text-emerald-700 col-num">{fmtCell(totals.converted)}</td>
                <td className="py-3 text-right font-tabular font-bold text-foreground col-num">{fmtCell(totals.closing)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
