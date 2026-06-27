import React, { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel } from '@/lib/fiscalYear';
import { useFirmwideClients, useFirmwideLeaders } from '@/hooks/useFirmwide';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

const CR = 10000000;
const L  = 100000;

function fmt(val) {
  if (val === null || val === undefined) return '—';
  if (val === 0) return '₹0';
  const cr = val / CR;
  if (cr >= 1) return `₹${cr.toFixed(2)} Cr`;
  return `₹${(val / L).toFixed(2)} L`;
}

function ELBadge({ status }) {
  if (status === 'Signed') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-green-bg text-status-green">Signed</span>;
  if (status === 'Not Signed') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-red-bg text-status-red">Not Signed</span>;
  return <span className="text-xs text-muted-foreground">{status || '—'}</span>;
}

export default function FirmwideClients() {
  const [search, setSearch] = useState('');
  const { activeFY, fiscalYears } = useGlobalSelector();

  const { data: clientsRes, isLoading: clientsLoading } = useFirmwideClients(activeFY);
  const { data: leaders = [], isLoading: leadersLoading } = useFirmwideLeaders(activeFY);

  const clients = clientsRes?.data ?? [];
  const leaderNameMap = Object.fromEntries(leaders.map(l => [l.id, l.name]));
  const fyLabel = getFyLabel(activeFY, fiscalYears);

  const isLoading = clientsLoading || leadersLoading;

  const filtered = clients.filter(c =>
    !search || (c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totals = {
    green:     clients.reduce((s, c) => s + (c.green     || 0), 0),
    amber:     clients.reduce((s, c) => s + (c.amber     || 0), 0),
    blue_sky:  clients.reduce((s, c) => s + (c.blue_sky  || 0), 0),
    total:     clients.reduce((s, c) => s + (c.total     || 0), 0),
    collected: clients.reduce((s, c) => s + (c.collected || 0), 0),
    balance:   clients.reduce((s, c) => s + (c.balance   || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">All Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">All firm engagements · {fyLabel} · {clients.length} clients</p>
        </div>
        <LeaderFYSelector />
      </div>

      <input
        className="text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring w-72"
        placeholder="Search clients..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left py-3 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium w-8">#</th>
                <th className="text-left py-3 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Client Name</th>
                <th className="text-left py-3 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Leader</th>
                <th className="text-left py-3 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Rel. Partner</th>
                <th className="text-left py-3 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">EL Status</th>
                <th className="text-right py-3 px-3 text-[11px] uppercase tracking-wider text-emerald-700 font-medium">Green (₹)</th>
                <th className="text-right py-3 px-3 text-[11px] uppercase tracking-wider text-amber-600 font-medium">Amber (₹)</th>
                <th className="text-right py-3 px-3 text-[11px] uppercase tracking-wider text-cbva-navy font-medium">Blue Sky (₹)</th>
                <th className="text-right py-3 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total (₹)</th>
                <th className="text-right py-3 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Collected</th>
                <th className="text-right py-3 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                    {search ? 'No clients match your search.' : `No client data for ${fyLabel}.`}
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => (
                  <tr key={c.id ?? idx} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-foreground text-xs">{c.name}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{leaderNameMap[c.leader_id] || c.leader_id || '—'}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{c.rel_partner || '—'}</td>
                    <td className="py-2.5 px-3"><ELBadge status={c.el_status} /></td>
                    <td className="py-2.5 px-3 text-right font-tabular text-emerald-700 text-xs">{c.green > 0 ? fmt(c.green) : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-tabular text-amber-600 text-xs">{c.amber > 0 ? fmt(c.amber) : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-tabular text-cbva-navy text-xs">{c.blue_sky > 0 ? fmt(c.blue_sky) : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-tabular font-semibold text-foreground text-xs">{c.total > 0 ? fmt(c.total) : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-tabular text-slate-600 text-xs">{c.collected != null ? fmt(c.collected) : '—'}</td>
                    <td className="py-2.5 px-3 text-right font-tabular text-xs">
                      {c.balance == null ? '—' : c.balance === 0
                        ? <span className="text-emerald-600">₹0</span>
                        : <span className="text-red-600">{fmt(c.balance)}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 border-t-2 border-border">
                <td className="py-3 px-3 text-xs font-bold uppercase text-foreground" colSpan={5}>TOTAL</td>
                <td className="py-3 px-3 text-right font-tabular font-bold text-emerald-700 text-xs">{fmt(totals.green)}</td>
                <td className="py-3 px-3 text-right font-tabular font-bold text-amber-600 text-xs">{fmt(totals.amber)}</td>
                <td className="py-3 px-3 text-right font-tabular font-bold text-cbva-navy text-xs">{fmt(totals.blue_sky)}</td>
                <td className="py-3 px-3 text-right font-tabular font-bold text-foreground text-xs">{fmt(totals.total)}</td>
                <td className="py-3 px-3 text-right font-tabular font-bold text-slate-700 text-xs">{fmt(totals.collected)}</td>
                <td className="py-3 px-3 text-right font-tabular font-bold text-red-600 text-xs">{fmt(totals.balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
