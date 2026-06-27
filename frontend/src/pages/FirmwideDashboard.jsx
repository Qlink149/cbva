import React, { useMemo, useState } from 'react';
import { Link2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import PipelineStackedBar from '@/components/dashboard/PipelineStackedBar';
import BlueSkyTableReal from '@/components/dashboard/BlueSkyTableReal';
import { getFyLabel } from '@/lib/fiscalYear';
import CollectionsTable from '@/components/dashboard/CollectionsTable';
import LeaderPerformanceCharts from '@/components/firmwide/LeaderPerformanceCharts';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';
import { formatINR } from '@/lib/formatCurrency';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useFirmwideLeaders } from '@/hooks/useFirmwide';
import { useFirmwideDashboardAggregate } from '@/hooks/useAdmin';

const DATE_RANGES = [
  { value: 'mtd', label: 'Month to Date' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'ytd', label: 'Year to Date' },
];

export default function FirmwideDashboard() {
  const [dateRange, setDateRange] = useState('ytd');
  const { activeFY, fiscalYears } = useGlobalSelector();
  const fyLabel = getFyLabel(activeFY, fiscalYears);

  const { data: leaders = [], isLoading: leadersLoading } = useFirmwideLeaders(activeFY);
  const { data: aggregate } = useFirmwideDashboardAggregate(activeFY);

  const pipelinePlan = useMemo(() => {
    const p = aggregate?.pipeline;
    if (!p) return null;
    return { green: p.green, amber: p.amber, blueSky: p.blue_sky, total: p.total };
  }, [aggregate]);

  const boardPlan = useMemo(() => {
    const green = leaders.reduce((s, l) => s + (l.total_green || 0), 0);
    const amber = leaders.reduce((s, l) => s + (l.total_amber || 0), 0);
    const blueSky = leaders.reduce((s, l) => s + (l.total_blue_sky || 0), 0);
    return { green, amber, blueSky, total: green + amber + blueSky };
  }, [leaders]);

  const stats = useMemo(() => {
    const green   = leaders.reduce((s, l) => s + (l.total_green    || 0), 0);
    const amber   = leaders.reduce((s, l) => s + (l.total_amber    || 0), 0);
    const blueSky = leaders.reduce((s, l) => s + (l.total_blue_sky || 0), 0);
    return { green, amber, blueSky, total: green + amber + blueSky };
  }, [leaders]);

  const topLeaders = useMemo(() =>
    [...leaders]
      .sort((a, b) => (b.total_pipeline || 0) - (a.total_pipeline || 0))
      .slice(0, 5)
      .map(l => ({ name: l.name?.split(' ')[0] ?? l.id, total: l.total_pipeline || 0 })),
    [leaders]
  );

  const blueskyRows = aggregate?.bluesky?.monthly_lines ?? [];
  const blueskyTotals = aggregate?.bluesky
    ? { additional: aggregate.bluesky.additional, converted: aggregate.bluesky.converted }
    : {};

  if (leadersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-0 pb-12">
      <div className="space-y-6 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-light text-foreground tracking-tight">Firmwide</h1>
              <Link2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Board view · {leaders.length} leaders · {fyLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <LeaderFYSelector />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <FileText className="w-4 h-4" /> Generate Pack
            </Button>
          </div>
        </div>

        {/* Row 1: Pipeline Plan Card + Blue Sky Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PipelineStackedBar
            originalPlan={boardPlan}
            revisedPlan={pipelinePlan ?? boardPlan}
            revisedLabel={aggregate?.pipeline?.label || 'Latest Pipeline'}
            dividerLabel={aggregate?.pipeline?.label}
          />
          <BlueSkyTableReal blueSkyRows={blueskyRows} totals={blueskyTotals} fyLabel={fyLabel} />
        </div>

        <CollectionsTable
          monthlyLines={aggregate?.collections?.monthly_lines ?? []}
          boardTotal={aggregate?.collections?.total_collected ?? 0}
        />

        {/* Shadow P&L + Origination — placeholders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border/60 px-6 py-5" style={{ background: '#f5f5f5' }}>
            <p className="text-sm font-semibold text-foreground mb-2">Shadow P&L</p>
            <p className="text-sm text-muted-foreground italic">To Be Built — Revenue split by engagement leaders. Coming in the next phase.</p>
          </div>
          <div className="rounded-xl border border-border/60 px-6 py-5" style={{ background: '#f5f5f5' }}>
            <p className="text-sm font-semibold text-foreground mb-2">Origination</p>
            <p className="text-sm text-muted-foreground italic">To Be Built — Partner origination tracking. Coming in the next phase.</p>
          </div>
        </div>

        {/* Row 2: Leader Performance Charts */}
        <LeaderPerformanceCharts leaders={leaders} />

        {/* Row 3: Leaderboard + Composition */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Leaderboard */}
          <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">Leaderboard</h3>
              <span className="text-[10px] text-muted-foreground">{fyLabel} · Total Pipeline</span>
            </div>
            <div className="space-y-3">
              {topLeaders.length === 0 && (
                <p className="text-xs text-muted-foreground">No data available.</p>
              )}
              {topLeaders.map((l, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{l.name}</span>
                      <span className="text-xs font-tabular font-medium">{formatINR(l.total)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-cbva-navy"
                        style={{ width: `${topLeaders[0]?.total ? (l.total / topLeaders[0].total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Composition */}
          <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground mb-4">Composition</h3>
            <div className="space-y-3">
              {[
                { label: 'Green',    color: 'bg-status-green', value: stats.green },
                { label: 'Amber',    color: 'bg-status-amber', value: stats.amber },
                { label: 'Blue Sky', color: 'bg-cbva-navy',    value: stats.blueSky },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${s.color}`} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <span className="text-xs font-tabular font-medium">{formatINR(s.value)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Total</span>
                <span className="text-sm font-tabular font-medium">{formatINR(stats.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
