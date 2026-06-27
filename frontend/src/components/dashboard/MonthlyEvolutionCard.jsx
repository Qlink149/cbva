import React from 'react';
import { formatINRFull } from '@/lib/formatCurrency';

function fmt(val) {
  if (val === null || val === undefined) return '—';
  return formatINRFull(val);
}

export default function MonthlyEvolutionCard({ pipelineData = [], fyLabel = '' }) {
  const firstLabel = pipelineData[0]?.label;
  const lastLabel = pipelineData[pipelineData.length - 1]?.label;
  const subtitle = firstLabel && lastLabel && firstLabel !== lastLabel
    ? `${firstLabel} → ${lastLabel}`
    : fyLabel;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden w-full">
      <div className="px-6 pt-5 pb-2.5 border-b border-border/60 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Monthly Plan Evolution</p>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="w-full">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Particular</th>
              <th className="text-right py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Green</th>
              <th className="text-right py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-amber-600">Amber</th>
              <th className="text-right py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-cbva-navy">Blue Sky</th>
              <th className="text-right py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {pipelineData.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-border/40 hover:bg-muted/10 transition-colors ${i === pipelineData.length - 1 ? 'bg-muted/20 font-semibold' : ''}`}
              >
                <td className="py-2.5 px-4 font-medium text-slate-700 whitespace-nowrap">{row.label}</td>
                <td className="py-2.5 px-4 text-right font-tabular text-slate-600 whitespace-nowrap">{fmt(row.green)}</td>
                <td className="py-2.5 px-4 text-right font-tabular text-slate-600 whitespace-nowrap">{fmt(row.amber)}</td>
                <td className="py-2.5 px-4 text-right font-tabular text-slate-600 whitespace-nowrap">{fmt(row.blueSky)}</td>
                <td className="py-2.5 px-4 text-right font-tabular font-semibold text-slate-700 whitespace-nowrap">{fmt(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}