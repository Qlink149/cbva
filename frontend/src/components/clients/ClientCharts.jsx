import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { formatINR } from '@/lib/formatCurrency';
import { TrendingUp, Wallet } from 'lucide-react';
import {
  BRAND_CHART_AXIS,
  BRAND_CHART_CURSOR,
  BRAND_CHART_GRID,
  BRAND_COLORS,
  BrandChartGradient,
} from '@/components/charts/brandChartTheme';

const PIE_GRADIENT_IDS = {
  Green: 'pieGreen',
  Amber: 'pieAmber',
  'Blue Sky': 'pieBlue',
};

const PIE_GRADIENTS = [
  { id: 'pieGreen', variant: 'success' },
  { id: 'pieAmber', variant: 'warning' },
  { id: 'pieBlue', variant: 'primary' },
];

const PILL_COLORS = {
  Green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Amber: 'bg-amber-50 text-amber-700 border-amber-200',
  'Blue Sky': 'bg-blue-50 text-blue-700 border-blue-200',
};

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-800 mb-0.5">{d.status}</p>
      <p className="text-slate-500 font-tabular">{formatINR(d.amount)}</p>
      <p className="text-slate-400">{d.count} engagement{d.count !== 1 ? 's' : ''}</p>
    </div>
  );
}

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-800 mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-tabular">
          {p.name}: {formatINR(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function ClientCharts({ filteredChartData, filteredCollectionByMonth, filteredTotalCollected }) {
  const hasCollections = filteredCollectionByMonth.some(m => m.actual > 0 || m.expected > 0);
  const collectionData = filteredCollectionByMonth.filter(m => m.actual > 0 || m.expected > 0);

  // Show dummy data if no real chart data
  const chartDataToDisplay = filteredChartData.length > 0 ? filteredChartData : [
    { status: 'Green', amount: 4500000, count: 2 },
    { status: 'Amber', amount: 2500000, count: 1 },
    { status: 'Blue Sky', amount: 1500000, count: 1 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: Pipeline by Status — Pie */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/60 via-transparent to-blue-50/30 pointer-events-none rounded-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cbva-navy to-blue-700 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Pipeline by Status</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <defs>
                    {PIE_GRADIENTS.map(g => (
                      <BrandChartGradient key={g.id} id={g.id} variant={g.variant} direction="horizontal" />
                    ))}
                  </defs>
                  <Pie
                    data={chartDataToDisplay}
                    cx={70}
                    cy={70}
                    innerRadius={42}
                    outerRadius={68}
                    dataKey="amount"
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {chartDataToDisplay.map((entry, i) => (
                      <Cell key={i} fill={`url(#${PIE_GRADIENT_IDS[entry.status] || 'pieBlue'})`} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-col gap-2.5 flex-1">
              {chartDataToDisplay.map(d => {
                const total = chartDataToDisplay.reduce((s, x) => s + x.amount, 0);
                const pct = total > 0 ? ((d.amount / total) * 100).toFixed(1) : 0;
                return (
                  <div key={d.status}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PILL_COLORS[d.status] || 'bg-muted text-muted-foreground border-border'}`}>
                        {d.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-tabular">{pct}%</span>
                    </div>
                    <p className="text-sm font-semibold font-tabular text-foreground">{formatINR(d.amount)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Monthly Collections — Bar Chart */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/40 via-transparent to-slate-50/20 pointer-events-none rounded-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Monthly Collections</h2>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-base font-bold font-tabular text-emerald-600">{formatINR(filteredTotalCollected)}</p>
            </div>
          </div>

          {!hasCollections ? (
            <div className="flex items-center justify-center h-[240px] text-xs text-muted-foreground">No collections recorded</div>
          ) : (
            <>

              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={collectionData}
                  layout="vertical"
                  barSize={20}
                  margin={{ top: 0, right: 60, left: 40, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="barActual" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={BRAND_COLORS.success} />
                      <stop offset="100%" stopColor="#0f7a55" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="barExpected" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={BRAND_COLORS.lavender} />
                      <stop offset="100%" stopColor={BRAND_COLORS.mist} stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={true} horizontal={false} stroke={BRAND_CHART_GRID} />
                  <XAxis type="number" tickFormatter={v => formatINR(v)} tick={{ fontSize: 9, fill: BRAND_CHART_AXIS }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="month" tick={false} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: BRAND_CHART_CURSOR }} />
                  <Bar dataKey="actual" fill="url(#barActual)" radius={[0, 3, 3, 0]} label={{ dataKey: 'month', position: 'insideLeft', fill: BRAND_CHART_AXIS, fontSize: 11, offset: -25 }} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
