import React, { useMemo } from 'react';
import { formatINR } from '@/lib/formatCurrency';
import { Activity } from 'lucide-react';

function SectionHeader({ color, label }) {
  return (
    <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${color}`}>{label}</p>
  );
}

function MiniTable({ rows, columns, emptyMsg }) {
  if (!rows.length) return <p className="text-[11px] text-muted-foreground italic py-1">{emptyMsg}</p>;
  return (
    <table className="w-full text-xs mb-1">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-50">
            {columns.map((col, j) => (
              <td key={j} className={`py-1.5 ${col.className || ''}`}>
                {col.render ? col.render(r) : r[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function BlueSkyTable({ engagements = [], conversions = [] }) {
  const blueSkyEngagements = useMemo(() =>
    engagements.filter(e => e.status === 'Blue Sky'),
    [engagements]
  );

  const liveNewBlueSky = blueSkyEngagements.map(e => ({
    client: e.client_name || 'Client',
    subtype: e.blue_sky_subtype || 'Unidentified',
    amount: e.amount || 0,
  }));

  const liveToGreen = conversions
    .filter(c => c.converted_to === 'Green')
    .map(c => ({ client: c.client_name || '—', amount: c.amount || 0 }));

  const liveToAmber = conversions
    .filter(c => c.converted_to === 'Amber')
    .map(c => ({ client: c.client_name || '—', amount: c.amount || 0 }));

  const newBlueSky = liveNewBlueSky;
  const toGreen = liveToGreen;
  const toAmber = liveToAmber;

  const totalNewBS = newBlueSky.reduce((s, r) => s + r.amount, 0);
  const totalToGreen = toGreen.reduce((s, r) => s + r.amount, 0);
  const totalToAmber = toAmber.reduce((s, r) => s + r.amount, 0);

  const hasData = newBlueSky.length > 0 || toGreen.length > 0 || toAmber.length > 0;

  if (!hasData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] p-8 text-center text-sm text-muted-foreground">
        No Blue Sky movement data available for this fiscal year.
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-slate-50/20 pointer-events-none" />
      <div className="relative p-6 pb-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Pipeline Status</span>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>

          {/* Summary chips */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5 text-center">
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide mb-0.5">New Blue Sky</p>
              <p className="text-[15px] font-bold text-blue-800 font-tabular">{formatINR(totalNewBS)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2.5 text-center">
              <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide mb-0.5">→ Green</p>
              <p className="text-[15px] font-bold text-emerald-800 font-tabular">{formatINR(totalToGreen)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5 text-center">
              <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide mb-0.5">→ Amber</p>
              <p className="text-[15px] font-bold text-amber-800 font-tabular">{formatINR(totalToAmber)}</p>
            </div>
          </div>

          {/* New Blue Sky Added */}
          <div className="mb-4">
            <SectionHeader color="text-blue-700" label="New Blue Sky Added" />
            <MiniTable
              rows={newBlueSky}
              emptyMsg="No new blue sky this period"
              columns={[
                { key: 'client', className: 'text-slate-700 pr-2' },
                {
                  key: 'subtype',
                  className: 'pr-2',
                  render: r => (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${r.subtype === 'Identified' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.subtype}
                    </span>
                  ),
                },
                { key: 'amount', className: 'text-right font-tabular font-medium col-num', render: r => formatINR(r.amount) },
              ]}
            />
          </div>

          {/* Converted to Green */}
          <div className="mb-4">
            <SectionHeader color="text-emerald-700" label="Converted → Green" />
            <MiniTable
              rows={toGreen}
              emptyMsg="No conversions to Green this period"
              columns={[
                { key: 'client', className: 'text-slate-700 pr-2' },
                { key: 'amount', className: 'text-right font-tabular font-medium text-emerald-700 col-num', render: r => formatINR(r.amount) },
              ]}
            />
          </div>

          {/* Converted to Amber */}
          <div>
            <SectionHeader color="text-amber-700" label="Converted → Amber" />
            <MiniTable
              rows={toAmber}
              emptyMsg="No conversions to Amber this period"
              columns={[
                { key: 'client', className: 'text-slate-700 pr-2' },
                { key: 'amount', className: 'text-right font-tabular font-medium text-amber-700 col-num', render: r => formatINR(r.amount) },
              ]}
            />
          </div>

        </div>
      </div>
    </div>
  );
}