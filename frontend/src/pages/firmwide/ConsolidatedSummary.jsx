import React, { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR } from '@/lib/formatCurrency';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel, getCurrentFySlug } from '@/lib/fiscalYear';
import { getFyMonthLabel, getAvailableFyMonths, getCurrentMonthKey } from '@/lib/fyMonths';
import { useFirmwideLeaders } from '@/hooks/useFirmwide';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

export default function ConsolidatedSummary() {
  const { activeFY, fiscalYears } = useGlobalSelector();
  const [selectedMonth, setSelectedMonth] = useState('');
  const { data: leaders = [], isLoading, isFetching } = useFirmwideLeaders(activeFY, selectedMonth || undefined);

  useEffect(() => {
    setSelectedMonth('');
  }, [activeFY]);

  useEffect(() => {
    const allowed = getAvailableFyMonths(activeFY, fiscalYears).map(m => m.key);
    if (selectedMonth && !allowed.includes(selectedMonth)) {
      setSelectedMonth('');
    }
  }, [activeFY, fiscalYears, selectedMonth]);
  const fyLabel = getFyLabel(activeFY, fiscalYears);
  const monthLabel = getFyMonthLabel(selectedMonth);

  const totals = leaders.reduce(
    (acc, l) => ({
      green: acc.green + (l.total_green || 0),
      amber: acc.amber + (l.total_amber || 0),
      blueSky: acc.blueSky + (l.total_blue_sky || 0),
      pipeline: acc.pipeline + (l.total_pipeline || 0),
      collected: acc.collected + (l.total_collected || 0),
      engagements: acc.engagements + (l.engagement_count || 0),
    }),
    { green: 0, amber: 0, blueSky: 0, pipeline: 0, collected: 0, engagements: 0 }
  );

  const isCurrentFy = activeFY === getCurrentFySlug(fiscalYears);
  const periodLabel = selectedMonth
    ? `${monthLabel} · ${fyLabel}`
    : isCurrentFy
      ? `YTD through ${getFyMonthLabel(getCurrentMonthKey())} · ${fyLabel}`
      : fyLabel;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Consolidated Summary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Firmwide pipeline & collections · {periodLabel}
          </p>
        </div>
        <LeaderFYSelector
          showLeader={false}
          showMonth
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
        />
      </div>

      {isLoading && <Skeleton className="h-96 w-full" />}

      {!isLoading && isFetching && selectedMonth && (
        <p className="text-xs text-muted-foreground">Updating {monthLabel} view…</p>
      )}

      {!isLoading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Green', value: totals.green },
              { label: 'Amber', value: totals.amber },
              { label: 'Blue Sky', value: totals.blueSky },
              { label: 'Total Pipeline', value: totals.pipeline },
              { label: selectedMonth ? `${monthLabel} Collected` : 'Collected', value: totals.collected },
              { label: 'Engagements', value: totals.engagements, isCount: true },
            ].map(s => (
              <div key={s.label} className="bg-card rounded-xl border p-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{s.label}</p>
                <p className="text-lg font-semibold font-tabular">
                  {s.isCount ? s.value : formatINR(s.value)}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b">
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Leader</th>
                  <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Practice</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Green</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Amber</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Blue Sky</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Pipeline</th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">
                    {selectedMonth ? `${monthLabel} Collected` : 'Collected'}
                  </th>
                  <th className="text-right py-2 px-3 text-xs text-muted-foreground font-medium">Clients</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map(l => (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2 px-3 font-medium">{l.name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{l.practice || '—'}</td>
                    <td className="py-2 px-3 text-right font-tabular">{formatINR(l.total_green || 0)}</td>
                    <td className="py-2 px-3 text-right font-tabular">{formatINR(l.total_amber || 0)}</td>
                    <td className="py-2 px-3 text-right font-tabular">{formatINR(l.total_blue_sky || 0)}</td>
                    <td className="py-2 px-3 text-right font-tabular font-medium">{formatINR(l.total_pipeline || 0)}</td>
                    <td className="py-2 px-3 text-right font-tabular">{formatINR(l.total_collected || 0)}</td>
                    <td className="py-2 px-3 text-right font-tabular">{l.engagement_count || 0}</td>
                  </tr>
                ))}
                <tr className="bg-muted/20 font-medium">
                  <td className="py-2 px-3" colSpan={2}>Total</td>
                  <td className="py-2 px-3 text-right font-tabular">{formatINR(totals.green)}</td>
                  <td className="py-2 px-3 text-right font-tabular">{formatINR(totals.amber)}</td>
                  <td className="py-2 px-3 text-right font-tabular">{formatINR(totals.blueSky)}</td>
                  <td className="py-2 px-3 text-right font-tabular">{formatINR(totals.pipeline)}</td>
                  <td className="py-2 px-3 text-right font-tabular">{formatINR(totals.collected)}</td>
                  <td className="py-2 px-3 text-right font-tabular">{totals.engagements}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
