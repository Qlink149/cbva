import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KPICard({ label, value, suffix, delta, deltaLabel, icon: Icon, accentColor }) {
  const deltaNum = parseFloat(delta);
  const isPositive = deltaNum > 0;
  const isNegative = deltaNum < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
      className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 relative overflow-hidden"
    >
      {accentColor && (
        <div
          className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.06] -translate-y-8 translate-x-8"
          style={{ background: accentColor }}
        />
      )}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground mb-2">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-medium text-foreground font-tabular">{value}</span>
            {suffix && <span className="text-sm text-muted-foreground font-medium">{suffix}</span>}
          </div>
        </div>
        {Icon && (
          <div className="p-2.5 rounded-lg bg-muted/60">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>
      {delta != null && (
        <div className="flex items-center gap-1.5 mt-3">
          {isPositive && <TrendingUp className="w-3.5 h-3.5 text-status-green" />}
          {isNegative && <TrendingDown className="w-3.5 h-3.5 text-status-red" />}
          {!isPositive && !isNegative && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className={`text-xs font-medium ${isPositive ? 'text-status-green' : isNegative ? 'text-status-red' : 'text-muted-foreground'}`}>
            {isPositive ? '+' : ''}{delta}%
          </span>
          {deltaLabel && <span className="text-xs text-muted-foreground">{deltaLabel}</span>}
        </div>
      )}
    </motion.div>
  );
}