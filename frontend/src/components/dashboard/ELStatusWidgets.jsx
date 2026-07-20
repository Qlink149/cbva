import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatINRFull } from '@/lib/formatCurrency';

const CR = 10000000;

function fmtCr(val) {
  if (!val && val !== 0) return '—';
  return `₹${(val / CR).toFixed(2)} Cr`;
}

function pct(val, total) {
  if (!total) return '0.00%';
  return `${((val / total) * 100).toFixed(2)}%`;
}

const COLORS = {
  Signed: '#10B981',
  'Not Signed': '#F59E0B',
  Waived: '#94A3B8',
  NA: '#CBD5E1',
};

function DonutChart({ data, label }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-4">
        Engagement Letter Status — {label}
      </p>
      <div className="flex items-center gap-6">
        <div className="w-40 h-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={COLORS[entry.name] || '#CBD5E1'} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [value, name]}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[d.name] || '#CBD5E1' }} />
                <span className="text-xs text-slate-600">{d.name}</span>
              </div>
              <span className="text-xs font-semibold font-tabular text-slate-700">{d.display}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ELStatusWidgets({ clients }) {
  const { volumeData, valueData } = useMemo(() => {
    const signed = clients.filter(c => c.elStatus === 'Signed');
    const notSigned = clients.filter(c => c.elStatus === 'Not Signed');
    const waived = clients.filter(c => c.elStatus === 'DS');
    const na = clients.filter(c => c.elStatus === 'NA' || c.elStatus === '—' || !c.elStatus);

    const total = clients.length;

    const volume = [
      { name: 'Signed', value: signed.length, display: `${signed.length} clients (${pct(signed.length, total)})` },
      { name: 'Not Signed', value: notSigned.length, display: `${notSigned.length} clients (${pct(notSigned.length, total)})` },
      { name: 'Waived', value: waived.length, display: `${waived.length} clients (${pct(waived.length, total)})` },
      { name: 'NA', value: na.length, display: `${na.length} clients (${pct(na.length, total)})` },
    ].filter(d => d.value > 0);

    const signedVal = signed.reduce((s, c) => s + (c.green || 0), 0);
    const notSignedVal = notSigned.reduce((s, c) => s + (c.green || 0), 0);
    const waivedVal = waived.reduce((s, c) => s + (c.green || 0), 0);
    const naVal = na.reduce((s, c) => s + (c.green || 0), 0);
    const totalVal = signedVal + notSignedVal + waivedVal + naVal;

    const value = [
      { name: 'Signed',     value: signedVal,    display: `${formatINRFull(signedVal)} (${pct(signedVal, totalVal)})` },
      { name: 'Not Signed', value: notSignedVal,  display: `${formatINRFull(notSignedVal)} (${pct(notSignedVal, totalVal)})` },
      { name: 'Waived',     value: waivedVal,     display: `${formatINRFull(waivedVal)} (${pct(waivedVal, totalVal)})` },
      { name: 'NA',         value: naVal,         display: `${formatINRFull(naVal)} (${pct(naVal, totalVal)})` },
    ].filter(d => d.value > 0);

    return { volumeData: volume, valueData: value };
  }, [clients]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <DonutChart data={volumeData} label="By Volume" />
      <DonutChart data={valueData} label="By Value (Green Pipeline)" />
    </div>
  );
}