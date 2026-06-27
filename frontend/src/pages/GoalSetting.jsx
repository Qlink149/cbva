import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR } from '@/lib/formatCurrency';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useBaselines } from '@/hooks/useBaselines';
import { useEngagements } from '@/hooks/useEngagements';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

export default function GoalSetting() {
  const { selectedLeaderId, activeFY } = useGlobalSelector();
  const { data: baselines = [], isLoading: baselineLoading } = useBaselines(selectedLeaderId);
  const { data: engagements = [], isLoading: engLoading } = useEngagements(selectedLeaderId, activeFY);

  const baseline = baselines[0];
  const current = engagements.reduce(
    (acc, e) => ({ green: acc.green + (e.green || 0), amber: acc.amber + (e.amber || 0), blueSky: acc.blueSky + (e.blueSky || 0) }),
    { green: 0, amber: 0, blueSky: 0 }
  );
  const currentTotal = current.green + current.amber + current.blueSky;
  const isLoading = baselineLoading || engLoading;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Goal Setting</h1>
          <p className="text-sm text-muted-foreground mt-1">Baseline vs current pipeline</p>
        </div>
        <LeaderFYSelector />
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card rounded-xl border p-6 space-y-4">
            <h3 className="font-medium">Baseline Plan</h3>
            {baseline ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Green</span><span className="font-tabular">{formatINR(baseline.baseline_green)}</span></div>
                <div className="flex justify-between"><span>Amber</span><span className="font-tabular">{formatINR(baseline.baseline_amber)}</span></div>
                <div className="flex justify-between"><span>Blue Sky</span><span className="font-tabular">{formatINR(baseline.baseline_blue_sky)}</span></div>
                <div className="flex justify-between font-medium border-t pt-2"><span>Total</span><span className="font-tabular">{formatINR(baseline.baseline_total)}</span></div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No baseline plan set for this leader.</p>
            )}
          </div>
          <div className="bg-card rounded-xl border p-6 space-y-4">
            <h3 className="font-medium">Current Pipeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Green</span><span className="font-tabular">{formatINR(current.green)}</span></div>
              <div className="flex justify-between"><span>Amber</span><span className="font-tabular">{formatINR(current.amber)}</span></div>
              <div className="flex justify-between"><span>Blue Sky</span><span className="font-tabular">{formatINR(current.blueSky)}</span></div>
              <div className="flex justify-between font-medium border-t pt-2"><span>Total</span><span className="font-tabular">{formatINR(currentTotal)}</span></div>
            </div>
            {baseline && (
              <p className={`text-sm ${currentTotal >= baseline.baseline_total ? 'text-status-green' : 'text-status-red'}`}>
                {currentTotal >= baseline.baseline_total ? 'Above' : 'Below'} baseline by {formatINR(Math.abs(currentTotal - baseline.baseline_total))}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
