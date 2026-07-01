import React from 'react';
import { Wallet } from 'lucide-react';
import { formatINRFull } from '@/lib/formatCurrency';

function VarianceCell({ v }) {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  if (v === 0) return <span className="text-emerald-600 font-semibold">+₹0</span>;
  if (v > 0) return <span className="text-emerald-600 font-semibold">+{formatINRFull(v)}</span>;
  return <span className="text-red-600 font-semibold">({formatINRFull(Math.abs(v))})</span>;
}

export default function CollectionsTableReal({
  rows,
  totalCollected,
  tableMaxHeight = 320,
  fyLabel = '',
  /** @deprecated use variant="page" */
  fillHeight = false,
  variant = fillHeight ? 'page' : 'embedded',
}) {
  const isPage = variant === 'page';
  // YTD sums
  const ytdPlanned = rows.reduce((s, r) => s + (r.planned || 0), 0);
  const ytdCollected = rows.reduce((s, r) => s + (r.collected || 0), 0);
  const ytdVariance = ytdCollected - ytdPlanned;

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden ${isPage ? 'w-full' : ''}`}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Wallet className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Collections{fyLabel ? ` · ${fyLabel}` : ''}
          </h3>
        </div>

        {/* YTD chips */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            YTD Planned <span className="font-tabular font-semibold">{formatINRFull(ytdPlanned)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            YTD Collected <span className="font-tabular font-semibold">{formatINRFull(ytdCollected)}</span>
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-tabular ${ytdVariance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            Variance: {ytdVariance >= 0 ? '+' : ''}{formatINRFull(ytdVariance)}
          </span>
        </div>
      </div>

      {/* Table — page variant scrolls with the main layout; embedded keeps an inner scroll area */}
      <div
        className="overflow-x-auto"
        style={isPage ? undefined : { maxHeight: tableMaxHeight, overflowY: 'auto' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Month</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Planned</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Collected</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Variance</th>
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">{row.month}</td>
                <td className="py-3 px-4 text-right font-tabular text-muted-foreground whitespace-nowrap">{formatINRFull(row.planned)}</td>
                <td className="py-3 px-4 text-right font-tabular font-semibold text-foreground whitespace-nowrap">{formatINRFull(row.collected)}</td>
                <td className="py-3 px-4 text-right whitespace-nowrap"><VarianceCell v={row.variance} /></td>
                <td className="py-3 px-4">
                  <input
                    className="w-full max-w-[200px] text-xs border border-transparent hover:border-border rounded px-1.5 py-0.5 bg-transparent focus:outline-none focus:border-ring focus:bg-white transition-colors text-muted-foreground placeholder:text-slate-400"
                    placeholder={row.variance < 0 ? 'Why variance?' : 'Add note...'}
                    maxLength={40}
                    defaultValue={row.remarks || ''}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 border-t border-border">
              <td className="py-3 px-4 text-xs font-bold uppercase text-foreground">Total Collected</td>
              <td className="py-3 px-4 text-right text-muted-foreground">—</td>
              <td className="py-3 px-4 text-right font-tabular font-bold text-foreground">{formatINRFull(totalCollected)}</td>
              <td className="py-3 px-4 text-right text-muted-foreground">—</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
