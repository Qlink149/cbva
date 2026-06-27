import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR } from '@/lib/formatCurrency';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel } from '@/lib/fiscalYear';
import { useFirmwideLeaders } from '@/hooks/useFirmwide';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

export default function BoardPack() {
  const { activeFY, fiscalYears } = useGlobalSelector();
  const { data: leaders = [], isLoading } = useFirmwideLeaders(activeFY);
  const fyLabel = getFyLabel(activeFY, fiscalYears);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Board Pack</h1>
          <p className="text-sm text-muted-foreground mt-1">Summary for board review · {fyLabel}</p>
        </div>
        <LeaderFYSelector />
      </div>
      {isLoading && <Skeleton className="h-96 w-full" />}
      {!isLoading && (
        <div className="bg-card rounded-xl border p-6 space-y-6" id="board-pack-content">
          <h2 className="text-xl font-medium">CBVA Business Plan — {fyLabel}</h2>
          {leaders.map(l => (
            <div key={l.id} className="border-b border-border pb-4 last:border-0">
              <h3 className="font-medium">{l.name}</h3>
              <p className="text-sm text-muted-foreground">{l.practice}</p>
              <div className="grid grid-cols-4 gap-4 mt-2 text-sm">
                <div><span className="text-muted-foreground">Pipeline: </span>{formatINR(l.total_pipeline || 0)}</div>
                <div><span className="text-muted-foreground">Collected: </span>{formatINR(l.total_collected || 0)}</div>
                <div><span className="text-muted-foreground">Clients: </span>{l.engagement_count || 0}</div>
                <div><span className="text-muted-foreground">EL Signed: </span>{l.el_signed_count || 0}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
