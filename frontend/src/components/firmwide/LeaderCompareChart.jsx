import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatINR, formatINRHero } from '@/lib/formatCurrency';

const COLORS = ['#0A2540', '#C5A572', '#3B82F6', '#10B981'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-xl shadow-xl p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
            <span className="text-muted-foreground">{p.name}</span>
          </div>
          <span className="font-medium font-tabular">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function LeaderCompareChart({ leaderData, metric = 'breakdown' }) {
  const chartData = (() => {
    if (metric === 'breakdown') {
      return [
        { label: 'Green', ...Object.fromEntries(leaderData.map(l => [l.leader.full_name?.split(' ')[0], l.green])) },
        { label: 'Amber', ...Object.fromEntries(leaderData.map(l => [l.leader.full_name?.split(' ')[0], l.amber])) },
        { label: 'BS Identified', ...Object.fromEntries(leaderData.map(l => [l.leader.full_name?.split(' ')[0], l.identified])) },
        { label: 'BS Unidentified', ...Object.fromEntries(leaderData.map(l => [l.leader.full_name?.split(' ')[0], l.unidentified])) },
        { label: 'Collected YTD', ...Object.fromEntries(leaderData.map(l => [l.leader.full_name?.split(' ')[0], l.collectedYTD])) },
      ];
    }
    // total vs baseline
    return [
      { label: 'Total Plan', ...Object.fromEntries(leaderData.map(l => [l.leader.full_name?.split(' ')[0], l.total])) },
      { label: 'Baseline', ...Object.fromEntries(leaderData.map(l => [l.leader.full_name?.split(' ')[0], l.baseline_total])) },
    ];
  })();

  const names = leaderData.map(l => l.leader.full_name?.split(' ')[0]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap="25%" barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={v => { const h = formatINRHero(v); return h.number + h.suffix; }}
          tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        {names.map((name, i) => (
          <Bar key={name} dataKey={name} name={name} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}