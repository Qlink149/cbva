import React from 'react';
import { motion } from 'framer-motion';
import { formatINRHero, formatINR } from '@/lib/formatCurrency';
import InfoTooltip from './InfoTooltip';

export default function PlanTotalCard({
  green = 0,
  amber = 0,
  blueSky = 0,
  baseline = 0,
  blueSkyConverted = 0,
}) {
  const total = green + amber + blueSky;
  const hero = formatINRHero(total);
  const bsPct = blueSky > 0 ? Math.min(100, Math.round((blueSkyConverted / (blueSky + blueSkyConverted)) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 flex flex-col justify-between h-full"
    >
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">Total Plan</p>
          <InfoTooltip text="The sum of all your engagements across Green (locked), Amber (contingent), and Blue Sky (speculative) categories for the current financial year." />
        </div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-4xl font-medium text-foreground font-tabular">{hero.number}</span>
          <span className="text-lg text-muted-foreground font-medium">{hero.suffix}</span>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {/* Green — amount only, no bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-status-green flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Green (Locked)</span>
          </div>
          <span className="text-xs font-medium text-foreground font-tabular">{formatINR(green)}</span>
        </div>

        {/* Amber — amount only, no bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-status-amber flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Amber (Contingent)</span>
          </div>
          <span className="text-xs font-medium text-foreground font-tabular">{formatINR(amber)}</span>
        </div>

        {/* Blue Sky — conversion tracker (from Collections tab) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-status-blue flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Blue Sky (Pipeline)</span>
            </div>
            <span className="text-xs font-medium text-foreground font-tabular">{formatINR(blueSky)}</span>
          </div>
          {blueSkyConverted > 0 && (
            <>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${bsPct}%` }}
                  transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: '#3B82F6' }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">Converted: {formatINR(blueSkyConverted)}</span>
                <span className="text-[10px] text-muted-foreground">Remaining: {formatINR(blueSky - blueSkyConverted)}</span>
              </div>
            </>
          )}
        </div>


      </div>
    </motion.div>
  );
}