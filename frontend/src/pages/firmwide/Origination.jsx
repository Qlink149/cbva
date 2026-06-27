import React, { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR } from '@/lib/formatCurrency';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useFirmwideClients } from '@/hooks/useFirmwide';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

export default function Origination() {
  const { activeFY } = useGlobalSelector();
  const { data, isLoading } = useFirmwideClients(activeFY);
  const clients = data?.data ?? [];

  const byPartner = useMemo(() => {
    const map = {};
    clients.forEach(c => {
      const key = c.rel_partner || '—';
      if (!map[key]) map[key] = { count: 0, total: 0 };
      map[key].count += 1;
      map[key].total += c.total || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [clients]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Origination</h1>
          <p className="text-sm text-muted-foreground mt-1">Partner origination by relationship partner</p>
        </div>
        <LeaderFYSelector />
      </div>
      {isLoading && <Skeleton className="h-64 w-full" />}
      {!isLoading && (
        <div className="bg-card rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/30 border-b">
              <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Partner</th>
              <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Clients</th>
              <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Pipeline</th>
            </tr></thead>
            <tbody>
              {byPartner.map(([partner, stats]) => (
                <tr key={partner} className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium">{partner}</td>
                  <td className="py-2 px-3 text-right">{stats.count}</td>
                  <td className="py-2 px-3 text-right font-tabular">{formatINR(stats.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
