import React, { useMemo, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel } from '@/lib/fiscalYear';
import { useLeader } from '@/hooks/useLeaders';
import { useEngagements } from '@/hooks/useEngagements';
import { useCollectionTransactions } from '@/hooks/useCollectionTransactions';
import { groupTxByEngagementMonth, buildClientMonthRows } from '@/lib/collectionsRollup';
import { getDefaultMonthKey } from '@/lib/fyMonths';
import MonthSelector from '@/components/clients/MonthSelector';
import CollectionsRollupTable from '@/components/collections/CollectionsRollupTable';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

export default function Collections() {
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();
  const { data: leader, isLoading: leaderLoading } = useLeader(selectedLeaderId);
  const { data: engagements = [], isLoading: engLoading } = useEngagements(selectedLeaderId, activeFY);
  const { data: transactions = [], isLoading: txLoading } = useCollectionTransactions(selectedLeaderId, activeFY);

  const [selectedMonths, setSelectedMonths] = useState(() => [getDefaultMonthKey(activeFY)]);
  useEffect(() => {
    setSelectedMonths([getDefaultMonthKey(activeFY)]);
  }, [activeFY]);

  const fyLabel = getFyLabel(activeFY, fiscalYears);
  const isLoading = leaderLoading || engLoading || txLoading;

  const txMap = useMemo(() => groupTxByEngagementMonth(transactions), [transactions]);
  const { rows, totals } = useMemo(
    () => buildClientMonthRows(engagements, txMap, selectedMonths),
    [engagements, txMap, selectedMonths]
  );

  return (
    <div className="pb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Collections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Client-wise Planned vs Collected roll-up · {fyLabel} · {leader?.name ?? '—'}
          </p>
        </div>
        <LeaderFYSelector />
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      )}

      {!isLoading && (
        <>
          <div className="mb-4">
            <MonthSelector selected={selectedMonths} onChange={setSelectedMonths} fySlug={activeFY} />
          </div>
          <CollectionsRollupTable rows={rows} totals={totals} months={selectedMonths} fySlug={activeFY} />
          <p className="text-xs text-muted-foreground mt-3">
            Read-only summary derived from the Engagement tab. Planned = sum of each client&apos;s monthly forecast; Collected = finance actuals. Edit values on the Engagement tab.
          </p>
        </>
      )}
    </div>
  );
}
