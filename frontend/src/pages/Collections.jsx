import React from 'react';
import CollectionsTableReal from '@/components/dashboard/CollectionsTableReal';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel } from '@/lib/fiscalYear';
import { useLeader } from '@/hooks/useLeaders';
import { useCollections } from '@/hooks/useCollections';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

export default function Collections() {
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();
  const { data: leader, isLoading: leaderLoading } = useLeader(selectedLeaderId);
  const { data: collectionsData, isLoading: collectionsLoading } = useCollections(selectedLeaderId, activeFY);

  const rows = collectionsData?.data ?? [];
  const totalCollected = collectionsData?.total_collected ?? 0;
  const fyLabel = getFyLabel(activeFY, fiscalYears);
  const isLoading = leaderLoading || collectionsLoading;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Collections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monthly collection tracking · {fyLabel} · {leader?.name ?? '—'}
          </p>
        </div>
        <LeaderFYSelector />
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <CollectionsTableReal rows={rows} totalCollected={totalCollected} tableMaxHeight={420} />
      )}

      {!isLoading && rows.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center">
          <p className="text-sm text-muted-foreground">
            Collection data not yet available for {leader?.name ?? 'this leader'} — {fyLabel}.
          </p>
        </div>
      )}
    </div>
  );
}
