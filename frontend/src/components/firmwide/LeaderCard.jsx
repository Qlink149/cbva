import React from 'react';
import { motion } from 'framer-motion';
import { formatINR, formatINRHero } from '@/lib/formatCurrency';

const CHART_HEIGHT = 80;

function MiniBar({ value, max, color, label }) {
  const h = Math.max((value / Math.max(max, 1)) * CHART_HEIGHT, value > 0 ? 4 : 0);
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span className="text-[10px] font-tabular font-medium text-foreground">{formatINRHero(value).number}<span className="text-muted-foreground">{formatINRHero(value).suffix}</span></span>
      <div className="w-full flex items-end" style={{ height: CHART_HEIGHT }}>
        <motion.div
          className="w-full rounded-t-md"
          initial={{ height: 0 }}
          animate={{ height: h }}
          transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
          style={{ background: color }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

export default function LeaderCard({ leaderData, index }) {
  const { leader, displayName, green, amber, identified, unidentified, total, collectedYTD } = leaderData;
  const name = displayName || leader.full_name;
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const maxBar = Math.max(green, amber, identified + unidentified, collectedYTD, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/60" style={{ background: 'linear-gradient(135deg,#f8faff,#ffffff)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cbva-navy text-white flex items-center justify-center text-base font-semibold shrink-0 shadow-md">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground">{name}</h3>
            <p className="text-xs text-muted-foreground">Partner · FY 26-27</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-medium font-tabular text-foreground">{formatINRHero(total).number}<span className="text-base text-muted-foreground ml-0.5">{formatINRHero(total).suffix}</span></p>
            <p className="text-[10px] text-muted-foreground">Total Plan</p>
          </div>
        </div>


      </div>

      {/* Mini bar chart */}
      <div className="px-6 pt-5 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pipeline Breakdown</p>
        <div className="flex gap-2 items-end" style={{ height: CHART_HEIGHT + 30 }}>
          <MiniBar value={green} max={maxBar} color="#10B981" label="Green" />
          <MiniBar value={amber} max={maxBar} color="#F59E0B" label="Amber" />
          <MiniBar value={identified} max={maxBar} color="#3B82F6" label="BS Identified" />
          <MiniBar value={unidentified} max={maxBar} color="#93C5FD" label="BS Unidentified" />
          <MiniBar value={collectedYTD} max={maxBar} color="#0A2540" label="Collected YTD" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border/60 mt-2">
        {[
          { label: 'Green', value: green, color: 'text-status-green' },
          { label: 'Amber', value: amber, color: 'text-status-amber' },
          { label: 'Blue Sky', value: identified + unidentified, color: 'text-status-blue' },
        ].map(s => (
          <div key={s.label} className="px-4 py-3 text-center">
            <p className={`text-sm font-semibold font-tabular ${s.color}`}>{formatINRHero(s.value).number}<span className="text-[10px] text-muted-foreground">{formatINRHero(s.value).suffix}</span></p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* EL status */}
      <div className="px-6 py-3 border-t border-border/60 bg-muted/20">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground">Collected YTD</span>
          <span className="text-xs font-semibold font-tabular text-foreground">{formatINR(collectedYTD)}</span>
        </div>
      </div>
    </motion.div>
  );
}