import React, { useMemo } from 'react';
import { formatINR } from '@/lib/formatCurrency';
import BlueSkyTableReal from '@/components/dashboard/BlueSkyTableReal';

export default function BlueSkyFunnelCard({ blueskyRows = [], totals = null, baseline = null }) {
  const summary = useMemo(() => {
    if (totals) return totals;
    return {
      additional: blueskyRows.reduce((s, r) => s + (r.additional || 0), 0),
      converted: blueskyRows.reduce((s, r) => s + (r.converted || 0), 0),
    };
  }, [blueskyRows, totals]);

  if (!blueskyRows.length) {
    return (
      <div className="bg-card rounded-2xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
        No Blue Sky funnel data for this fiscal year.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Additional Pipeline</p>
          <p className="text-xl font-semibold font-tabular mt-1">{formatINR(summary.additional)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Converted</p>
          <p className="text-xl font-semibold font-tabular text-emerald-700 mt-1">{formatINR(summary.converted)}</p>
        </div>
      </div>
      {baseline?.baseline_blue_sky != null && (
        <p className="text-xs text-muted-foreground px-1">
          Board baseline: {formatINR(baseline.baseline_blue_sky)}
        </p>
      )}
      <BlueSkyTableReal blueSkyRows={blueskyRows} totals={summary} />
    </div>
  );
}
