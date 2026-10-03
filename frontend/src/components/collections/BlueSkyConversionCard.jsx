import React from 'react';
import { useBluesky } from '@/hooks/useBluesky';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { formatINR } from '@/lib/formatCurrency';
import { Skeleton } from '@/components/ui/skeleton';

export default function BlueSkyConversionCard() {
  const { selectedLeaderId, activeFY } = useGlobalSelector();
  const { data, isLoading } = useBluesky(selectedLeaderId, activeFY);
  const rows = data?.data ?? [];
  const totals = data?.totals;

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="bg-card rounded-xl border p-5 space-y-3">
      <h3 className="text-sm font-medium">Blue Sky Conversions</h3>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Additional: </span>
          {totals?.additional == null ? '—' : formatINR(totals.additional)}
        </div>
        <div>
          <span className="text-muted-foreground">Converted: </span>
          {totals?.converted == null ? '—' : formatINR(totals.converted)}
        </div>
      </div>
      <div className="space-y-1">
        {rows.slice(0, 6).map((r) => (
          <div key={r.month_key || r.id || r.month} className="flex justify-between text-xs border-b border-border/50 py-1">
            <span>{r.month}</span>
            <span className="font-tabular">
              {r.has_data === false || r.closing == null ? '—' : formatINR(r.closing)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
