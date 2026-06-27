import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatINR, formatINRHero } from '@/lib/formatCurrency';
import {
  BRAND_CHART_AXIS,
  BRAND_CHART_GRID,
  BRAND_COLORS,
  BrandAreaGradient,
} from '@/components/charts/brandChartTheme';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p className="font-tabular font-medium">{formatINR(payload[0]?.value)}</p>
    </div>
  );
}

export default function BlueSkyPoolCard({ openingBlueSky = 0, blueskyRows = [] }) {
  const chartData = useMemo(() =>
    blueskyRows.map(row => ({
      label: row.month,
      amount: row.closing ?? 0,
    })),
  [blueskyRows]);

  const opening = openingBlueSky || blueskyRows[0]?.opening || 0;
  const hero = formatINRHero(opening);

  if (!blueskyRows.length) {
    return (
      <div className="bg-card rounded-2xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
        No Blue Sky pool data for this fiscal year.
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border/60">
        <h2 className="text-base font-semibold text-foreground">Blue Sky Pool</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Opening Blue Sky: <span className="font-tabular font-medium text-foreground">{formatINR(opening)}</span>
        </p>
      </div>
      <div className="p-6">
        <div className="flex items-end gap-2 mb-6">
          <span className="text-3xl font-light text-foreground font-tabular">{hero.number}</span>
          {hero.suffix && <span className="text-lg text-muted-foreground mb-1">{hero.suffix}</span>}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <BrandAreaGradient id="bsPool" color={BRAND_COLORS.primary} />
            <CartesianGrid strokeDasharray="3 3" stroke={BRAND_CHART_GRID} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: BRAND_CHART_AXIS }} />
            <YAxis tick={{ fontSize: 11, fill: BRAND_CHART_AXIS }} tickFormatter={v => formatINR(v)} width={70} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="amount" stroke={BRAND_COLORS.primary} fill="url(#bsPool)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
