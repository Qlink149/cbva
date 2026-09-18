import React, { useMemo, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel, getPrevFySlug } from '@/lib/fiscalYear';
import { useLeader } from '@/hooks/useLeaders';
import { useEngagements } from '@/hooks/useEngagements';
import { useCollectionTransactions } from '@/hooks/useCollectionTransactions';
import { useCollections } from '@/hooks/useCollections';
import { groupTxByEngagementMonth, buildClientMonthRows, buildYoYMonthRows } from '@/lib/collectionsRollup';
import { getDefaultMonthKey } from '@/lib/fyMonths';
import MonthSelector from '@/components/clients/MonthSelector';
import CollectionsRollupTable from '@/components/collections/CollectionsRollupTable';
import CollectionsYoYTable from '@/components/collections/CollectionsYoYTable';
import CollectionsTableReal from '@/components/dashboard/CollectionsTableReal';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

export default function Collections() {
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();
  const isFy2526 = activeFY === '2526';
  const prevFy = getPrevFySlug(activeFY, fiscalYears);
  const showYoY = activeFY === '2627' && !!prevFy;
  const { data: leader, isLoading: leaderLoading } = useLeader(selectedLeaderId);
  const { data: engagements = [], isLoading: engLoading } = useEngagements(selectedLeaderId, activeFY);
  const { data: transactions = [], isLoading: txLoading } = useCollectionTransactions(selectedLeaderId, activeFY);
  const { data: collectionsRes, isLoading: colLoading } = useCollections(selectedLeaderId, activeFY);
  const { data: priorCollectionsRes, isLoading: priorColLoading } = useCollections(
    selectedLeaderId,
    prevFy,
    { enabled: showYoY && !!prevFy },
  );

  const [selectedMonths, setSelectedMonths] = useState(() => [getDefaultMonthKey(activeFY)]);
  useEffect(() => {
    setSelectedMonths([getDefaultMonthKey(activeFY)]);
  }, [activeFY]);

  const fyLabel = getFyLabel(activeFY, fiscalYears);
  const priorFyLabel = getFyLabel(prevFy, fiscalYears);
  const isLoading = leaderLoading || engLoading || txLoading || (isFy2526 && colLoading) || (showYoY && (colLoading || priorColLoading));

  const txMap = useMemo(() => groupTxByEngagementMonth(transactions), [transactions]);
  const { rows, totals } = useMemo(
    () => buildClientMonthRows(engagements, txMap, selectedMonths),
    [engagements, txMap, selectedMonths]
  );

  const collectionRows = collectionsRes?.data ?? [];
  const yoyData = useMemo(() => {
    if (!showYoY) return null;
    return buildYoYMonthRows(priorCollectionsRes?.data ?? [], collectionRows);
  }, [showYoY, priorCollectionsRes, collectionRows]);

  const ytdCollected = useMemo(
    () => collectionRows.reduce((s, r) => s + (r.actual ?? r.collected ?? 0), 0),
    [collectionRows]
  );

  return (
    <div className="pb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Collections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isFy2526
              ? `Leader-month collections (imported) · ${fyLabel} · ${leader?.name ?? '—'}`
              : `Client-wise Planned vs Collected roll-up · ${fyLabel} · ${leader?.name ?? '—'}`}
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

      {!isLoading && isFy2526 && (
        <>
          <CollectionsTableReal
            rows={collectionRows}
            totalCollected={ytdCollected}
            fyLabel={fyLabel}
            fySlug={activeFY}
            variant="page"
          />
          <p className="text-xs text-muted-foreground mt-3">
            FY2025-26 is closed. Month totals match the Dashboard Collections widget (from collection entries). Per-client receipts are not available for this year.
          </p>
        </>
      )}

      {!isLoading && !isFy2526 && (
        <>
          {showYoY && yoyData && (
            <CollectionsYoYTable
              rows={yoyData.rows}
              ytd={yoyData.ytd}
              priorFyLabel={priorFyLabel}
              currentFyLabel={fyLabel}
            />
          )}
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
