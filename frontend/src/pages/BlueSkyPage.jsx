import React from 'react';
import BlueSkyPoolCard from '@/components/bluesky/BlueSkyPoolCard';
import BlueSkyFunnelCard from '@/components/bluesky/BlueSkyFunnelCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useBluesky } from '@/hooks/useBluesky';
import { useBaselines } from '@/hooks/useBaselines';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

export default function BlueSkyPage() {
  const { selectedLeaderId, activeFY } = useGlobalSelector();
  const { data: blueskyData, isLoading: blueskyLoading } = useBluesky(selectedLeaderId, activeFY);
  const { data: baselines = [], isLoading: baselineLoading } = useBaselines(selectedLeaderId);

  const baseline = baselines[0];
  const totals = blueskyData?.totals;
  const isLoading = blueskyLoading || baselineLoading;

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Blue Sky</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monthly Opening / Additional / Converted / Closing — FY start through current month
          </p>
        </div>
        <LeaderFYSelector />
      </div>
      <BlueSkyPoolCard
        openingBlueSky={baseline?.baseline_blue_sky || totals?.additional || 0}
        blueskyRows={blueskyData?.data ?? []}
      />
      <BlueSkyFunnelCard blueskyRows={blueskyData?.data ?? []} totals={totals} baseline={baseline} />
    </div>
  );
}
