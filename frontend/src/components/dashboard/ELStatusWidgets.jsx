import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatINRFull } from '@/lib/formatCurrency';

function pct(val, total) {
  if (!total) return '0.00%';
  return `${((val / total) * 100).toFixed(2)}%`;
}

const COLORS = {
  Signed: '#10B981',
  'Not Signed': '#F59E0B',
  Waived: '#94A3B8',
  'Waiver Requested': '#6366F1',
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

function bucketStatus(status) {
  if (!status) return 'NA';
  const s = String(status).trim();
  if (s === 'Signed') return 'Signed';
  if (s.toLowerCase() === 'not signed') return 'Not Signed';
  if (s.toLowerCase() === 'waived' || s.toLowerCase() === 'waved') return 'Waived';
  if (s.toLowerCase() === 'waiver requested') return 'Waiver Requested';
  if (s.toUpperCase() === 'NA') return 'NA';
  return 'Not Signed';
}

export default function ELStatusWidgets({ clients }) {
  const { volumeData, valueData } = useMemo(() => {
    const buckets = {
      Signed: [],
      'Not Signed': [],
      Waived: [],
      'Waiver Requested': [],
      NA: [],
    };
    clients.forEach((c) => {
      buckets[bucketStatus(c.elStatus)].push(c);
    });

    const total = clients.length;
    const volume = Object.entries(buckets)
      .map(([name, list]) => ({
        name,
        value: list.length,
        display: `${list.length} clients (${pct(list.length, total)})`,
      }))
      .filter((d) => d.value > 0);

    const valueRows = Object.entries(buckets).map(([name, list]) => {
      const val = list.reduce((s, c) => s + (c.green || 0), 0);
      return { name, value: val, list };
    });
    const totalVal = valueRows.reduce((s, r) => s + r.value, 0);
    const value = valueRows
      .map((r) => ({
        name: r.name,
        value: r.value,
        display: `${formatINRFull(r.value)} (${pct(r.value, totalVal)})`,
      }))
      .filter((d) => d.value > 0);

    return { volumeData: volume, valueData: value };
  }, [clients]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <DonutChart data={volumeData} label="By Volume" />
      <DonutChart data={valueData} label="By Value (Green Pipeline)" />
    </div>
  );
}
