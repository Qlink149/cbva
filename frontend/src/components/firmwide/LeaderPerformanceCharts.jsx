import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatINR, formatINRHero } from '@/lib/formatCurrency';
import { motion } from 'framer-motion';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium font-tabular">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function LeaderPerformanceCharts({ leaders = [] }) {
  const [selectedLeader, setSelectedLeader] = useState('all');

  const displayed = selectedLeader === 'all' ? leaders : leaders.filter(l => l.id === selectedLeader);

  const totals = useMemo(() => displayed.reduce(
    (acc, l) => ({
      green:   acc.green   + (l.total_green   || 0),
      amber:   acc.amber   + (l.total_amber   || 0),
      blueSky: acc.blueSky + (l.total_blue_sky || 0),
    }),
    { green: 0, amber: 0, blueSky: 0 }
  ), [displayed]);

  const barData = displayed.map(l => ({
    name: l.name?.split(' ')[0] ?? l.id,
    Green:      l.total_green    || 0,
    Amber:      l.total_amber    || 0,
    'Blue Sky': l.total_blue_sky || 0,
  }));

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="p-5 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-foreground">Leader Performance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Pipeline by status · {leaders.length} leaders</p>
        </div>
        <Select value={selectedLeader} onValueChange={setSelectedLeader}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="All Leaders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Leaders</SelectItem>
            {leaders.map(l => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="p-5 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Green',    value: totals.green,   bg: '#F0FDF4', color: '#10B981' },
            { label: 'Amber',    value: totals.amber,   bg: '#FFFBEB', color: '#F59E0B' },
            { label: 'Blue Sky', value: totals.blueSky, bg: '#EFF6FF', color: '#3B82F6' },
          ].map(s => {
            const h = formatINRHero(s.value);
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg p-4 border border-border/60"
                style={{ background: s.bg }}
              >
                <p className="text-[10px] uppercase tracking-[0.06em] font-semibold mb-1" style={{ color: s.color }}>{s.label}</p>
                <p className="text-2xl font-medium font-tabular text-foreground">
                  {h.number}<span className="text-sm ml-1 text-muted-foreground">{h.suffix}</span>
                </p>
              </motion.div>
            );
          })}
        </div>

        {displayed.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.06em] mb-3">Pipeline Breakdown</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => { const h = formatINRHero(v); return h.number + h.suffix; }} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Green"    stackId="a" fill="#10B981" />
                <Bar dataKey="Amber"    stackId="a" fill="#F59E0B" />
                <Bar dataKey="Blue Sky" stackId="a" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No leader data available for this fiscal year.</p>
        )}
      </div>
    </div>
  );
}
