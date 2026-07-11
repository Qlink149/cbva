import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Link2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR } from '@/lib/formatCurrency';
import KPICard from '@/components/dashboard/KPICard';
import { Activity, Shield } from 'lucide-react';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useEngagements, useCreateEngagement, useUpdateEngagement, useDeleteEngagement } from '@/hooks/useEngagements';
import { useBaselines } from '@/hooks/useBaselines';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

function flattenEngagements(engagements) {
  const rows = [];
  engagements.forEach((e) => {
    if (e.green > 0) rows.push({ ...e, status: 'Green', amount: e.green, key: `${e.id}-green` });
    if (e.amber > 0) rows.push({ ...e, status: 'Amber', amount: e.amber, key: `${e.id}-amber` });
    if (e.blueSky > 0) rows.push({ ...e, status: 'Blue Sky', amount: e.blueSky, key: `${e.id}-bs` });
    if (!e.green && !e.amber && !e.blueSky) rows.push({ ...e, status: '—', amount: e.total || 0, key: e.id });
  });
  return rows;
}

export default function LeaderPipeline() {
  const location = useLocation();
  const { selectedLeaderId, activeFY } = useGlobalSelector();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: engagements = [], isLoading } = useEngagements(selectedLeaderId, activeFY);
  const { data: baselines = [] } = useBaselines(selectedLeaderId);
  const deleteEngagement = useDeleteEngagement(selectedLeaderId, activeFY);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const s = params.get('status');
    if (s) setStatusFilter(s);
  }, [location.search]);

  const flatRows = useMemo(() => flattenEngagements(engagements), [engagements]);

  const stats = useMemo(() => {
    const green = engagements.reduce((s, e) => s + (e.green || 0), 0);
    const amber = engagements.reduce((s, e) => s + (e.amber || 0), 0);
    const blueSky = engagements.reduce((s, e) => s + (e.blueSky || 0), 0);
    const elSigned = engagements.filter(e => e.elStatus === 'Signed').reduce((s, e) => s + (e.total || 0), 0);
    return { green, amber, blueSky, total: green + amber + blueSky, baseline: baselines[0]?.baseline_total || 0, elSigned };
  }, [engagements, baselines]);

  const filtered = useMemo(() =>
    flatRows
      .filter(e => statusFilter === 'all' || e.status === statusFilter)
      .filter(e => !search || e.name?.toLowerCase().includes(search.toLowerCase())),
    [flatRows, statusFilter, search]
  );

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-4xl font-light text-foreground tracking-tight">Pipeline</h1>
          <Link2 className="w-4 h-4 text-muted-foreground" />
        </div>
        <LeaderFYSelector />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
        <KPICard label="Current Plan" value={formatINR(stats.total)} icon={Activity} accentColor="#3B82F6" />
        <KPICard label="EL Signed" value={formatINR(stats.elSigned)} icon={Shield} accentColor="#10B981" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {['all', 'Green', 'Amber', 'Blue Sky'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
              statusFilter === s
                ? s === 'Green' ? 'bg-emerald-600 text-white border-emerald-600'
                  : s === 'Amber' ? 'bg-amber-500 text-white border-amber-500'
                  : s === 'Blue Sky' ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-cbva-navy text-white border-cbva-navy'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
        <Input placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} className="w-64 ml-2" />
      </div>

      <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">#</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Client</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                <th className="text-right py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Amount</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">EL</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-remarks">Remarks</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((eng, i) => (
                <tr key={eng.key} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 text-muted-foreground text-xs col-num">{i + 1}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{eng.name || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      eng.status === 'Green' ? 'bg-status-green-bg text-status-green' :
                      eng.status === 'Amber' ? 'bg-status-amber-bg text-status-amber' :
                      'bg-status-blue-bg text-status-blue'
                    }`}>{eng.status}</span>
                  </td>
                  <td className="py-3 text-right font-tabular font-medium col-num">{formatINR(eng.amount)}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{eng.elStatus || '—'}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground col-remarks">{eng.remarks || '—'}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => deleteEngagement.mutate(eng.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No engagements found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
