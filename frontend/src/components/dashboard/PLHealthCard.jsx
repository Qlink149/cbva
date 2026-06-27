import React from 'react';
import { motion } from 'framer-motion';
import { formatINR } from '@/lib/formatCurrency';
import InfoTooltip from './InfoTooltip';

export default function PLHealthCard({ teamCost = 0, planTotal = 0, targetMultiplier = 4 }) {
  const ratio = teamCost > 0 ? (planTotal / teamCost).toFixed(1) : 0;
  const ratioNum = parseFloat(ratio);
  const status = ratioNum >= targetMultiplier ? 'Healthy' : ratioNum >= 3 ? 'Watch' : 'At Risk';
  const statusColor = ratioNum >= targetMultiplier ? 'text-status-green' : ratioNum >= 3 ? 'text-status-amber' : 'text-status-red';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl p-5 flex flex-col"
      style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 40%, #D1FAE5 100%)' }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">P&L Health</p>
        <InfoTooltip text="The ratio of your total plan value to estimated team cost. A ratio of 4x or above is considered healthy. Below 3x is at risk. This helps gauge whether your book of business justifies the team's cost." />
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-2xl font-medium font-tabular ${statusColor}`}>{ratio}x</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          ratioNum >= targetMultiplier ? 'bg-status-green-bg text-status-green' :
          ratioNum >= 3 ? 'bg-status-amber-bg text-status-amber' :
          'bg-status-red-bg text-status-red'
        }`}>
          {status}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Team cost {formatINR(teamCost)} · Plan {formatINR(planTotal)}
      </p>
      <div className="mt-4 flex-1 flex items-end">
        <div className="w-full">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((ratioNum / (targetMultiplier + 1)) * 100, 100)}%` }}
              transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
              className="h-full rounded-full"
              style={{
                backgroundColor: ratioNum >= targetMultiplier ? '#10B981' : ratioNum >= 3 ? '#F59E0B' : '#EF4444',
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-muted-foreground">0x</span>
            <span className="text-[9px] text-muted-foreground">{targetMultiplier}x target</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}