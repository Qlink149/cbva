import React from 'react';
import { formatINRFull } from '@/lib/formatCurrency';

const HDR_BG = '#F8FAFC';

function DeltaCell({ value, bold = false }) {
  const base = `py-2.5 px-3 text-right font-tabular text-xs${bold ? ' font-bold' : ''}`;
  if (value === 0) {
    return <td className={`${base} text-muted-foreground`}>—</td>;
  }
  if (value > 0) {
    return <td className={`${base} text-emerald-600`}>+{formatINRFull(value)}</td>;
  }
  return <td className={`${base} text-red-600`}>({formatINRFull(Math.abs(value))})</td>;
}

function PctCell({ value, bold = false }) {
  const base = `py-2.5 px-3 text-right font-tabular text-xs${bold ? ' font-bold' : ''}`;
  if (value === null || value === undefined) {
    return <td className={`${base} text-muted-foreground`}>—</td>;
  }
  if (value === 0) {
    return <td className={`${base} text-muted-foreground`}>0%</td>;
  }
  const cls = value > 0 ? 'text-emerald-600' : 'text-red-600';
  const sign = value > 0 ? '+' : '';
  return <td className={`${base} ${cls}`}>{sign}{value.toFixed(1)}%</td>;
}

function AmountCell({ value, bold = false }) {
  const base = `py-2.5 px-3 text-right font-tabular text-xs${bold ? ' font-bold' : ''}`;
  if (!value) {
    return <td className={`${base} text-muted-foreground/50`}>—</td>;
  }
  return <td className={base}>{formatINRFull(value)}</td>;
}

export default function CollectionsYoYTable({ rows = [], ytd = {}, priorFyLabel, currentFyLabel }) {
  return (
    <div
      className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden mb-6"
      aria-label="Year-on-year collections"
    >
      <div className="px-4 py-3 border-b border-border/60" style={{ background: HDR_BG }}>
        <h2 className="text-sm font-semibold text-foreground">Year-on-year collections</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Month totals · {priorFyLabel} vs {currentFyLabel}
        </p>
      </div>
      <div className="overflow-auto">
        <table className="text-sm w-full border-separate" style={{ borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: HDR_BG }}>
              <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border">
                Month
              </th>
              <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border">
                {priorFyLabel} Collected
              </th>
              <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border">
                {currentFyLabel} Collected
              </th>
              <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border">
                Δ
              </th>
              <th className="text-right py-2.5 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border">
                Δ%
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month_key} className="border-b border-border/40 hover:bg-muted/30">
                <td className="py-2.5 px-3 text-xs font-medium text-foreground">{r.monthFull}</td>
                <AmountCell value={r.prior} />
                <AmountCell value={r.current} />
                <DeltaCell value={r.delta} />
                <PctCell value={r.deltaPct} />
              </tr>
            ))}
            <tr className="bg-muted/40 font-semibold">
              <td className="py-2.5 px-3 text-xs font-bold text-foreground">YTD</td>
              <AmountCell value={ytd.prior} bold />
              <AmountCell value={ytd.current} bold />
              <DeltaCell value={ytd.delta} bold />
              <PctCell value={ytd.deltaPct} bold />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
