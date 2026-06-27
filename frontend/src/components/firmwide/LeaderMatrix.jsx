import React, { useMemo } from 'react';
import { formatINR } from '@/lib/formatCurrency';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function LeaderMatrix({ leaders, engagements, baselines }) {
  const matrix = useMemo(() => {
    return leaders.map(leader => {
      const leaderEngs = engagements.filter(e => e.leader_id === leader.id && !e.is_archived);
      const green = leaderEngs.filter(e => e.status === 'Green').reduce((s, e) => s + (e.amount || 0), 0);
      const amber = leaderEngs.filter(e => e.status === 'Amber').reduce((s, e) => s + (e.amount || 0), 0);
      const blueSky = leaderEngs.filter(e => e.status === 'Blue Sky').reduce((s, e) => s + (e.amount || 0), 0);
      const identified = leaderEngs.filter(e => e.status === 'Blue Sky' && e.blue_sky_subtype === 'Identified').reduce((s, e) => s + (e.amount || 0), 0);
      const unidentified = leaderEngs.filter(e => e.status === 'Blue Sky' && e.blue_sky_subtype === 'Unidentified').reduce((s, e) => s + (e.amount || 0), 0);
      const total = green + amber + blueSky;
      const baseline = baselines.find(b => b.leader_id === leader.id) || {};
      const drift = total - (baseline.baseline_total || 0);

      return {
        leader,
        green, amber, blueSky, identified, unidentified, total,
        baseline_green: baseline.baseline_green || 0,
        baseline_amber: baseline.baseline_amber || 0,
        baseline_blue_sky: baseline.baseline_blue_sky || 0,
        baseline_total: baseline.baseline_total || 0,
        drift,
      };
    });
  }, [leaders, engagements, baselines]);

  const totals = useMemo(() => {
    const row = { green: 0, amber: 0, blueSky: 0, total: 0, baseline_green: 0, baseline_amber: 0, baseline_blue_sky: 0, baseline_total: 0, drift: 0, identified: 0, unidentified: 0 };
    matrix.forEach(m => {
      row.green += m.green; row.amber += m.amber; row.blueSky += m.blueSky;
      row.total += m.total; row.baseline_green += m.baseline_green;
      row.baseline_amber += m.baseline_amber; row.baseline_blue_sky += m.baseline_blue_sky;
      row.baseline_total += m.baseline_total; row.drift += m.drift;
      row.identified += m.identified; row.unidentified += m.unidentified;
    });
    return row;
  }, [matrix]);

  const CellVal = ({ value, isDrift = false }) => {
    const color = isDrift ? (value > 0 ? 'text-status-green' : value < 0 ? 'text-status-red' : 'text-muted-foreground') : 'text-foreground';
    return <span className={`text-xs font-tabular ${color}`}>{formatINR(value)}</span>;
  };

  const SectionHeader = ({ children }) => (
    <tr><td colSpan={matrix.length + 2} className="py-2 px-3 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground bg-muted/40 border-y border-border/50">{children}</td></tr>
  );

  const DataRow = ({ label, getVal, isDrift = false }) => (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">{label}</td>
      {matrix.map(m => <td key={m.leader.id} className="py-2 px-3 text-right"><CellVal value={getVal(m)} isDrift={isDrift} /></td>)}
      <td className="py-2 px-3 text-right font-medium"><CellVal value={getVal(totals)} isDrift={isDrift} /></td>
    </tr>
  );

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="p-5 border-b border-border">
        <h3 className="text-base font-medium text-foreground">Leader Performance Matrix</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left py-3 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-32"></th>
              {matrix.map(m => (
                <th key={m.leader.id} className="text-center py-3 px-3 min-w-[80px]">
                  <div className="flex flex-col items-center gap-1">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="bg-cbva-navy text-white text-[9px] font-medium">
                        {m.leader.initials || m.leader.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[10px] font-medium text-foreground">{m.leader.initials || m.leader.full_name?.split(' ')[0]}</span>
                  </div>
                </th>
              ))}
              <th className="text-center py-3 px-3 min-w-[80px] text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            <SectionHeader>Baseline (Locked)</SectionHeader>
            <DataRow label="Green" getVal={m => m.baseline_green} />
            <DataRow label="Amber" getVal={m => m.baseline_amber} />
            <DataRow label="Blue Sky" getVal={m => m.baseline_blue_sky} />
            <DataRow label="Total" getVal={m => m.baseline_total} />

            <SectionHeader>Current Plan (Live)</SectionHeader>
            <DataRow label="Green" getVal={m => m.green} />
            <DataRow label="Amber" getVal={m => m.amber} />
            <DataRow label="Blue Sky" getVal={m => m.blueSky} />
            <DataRow label="Total" getVal={m => m.total} />
            <DataRow label="Drift vs Baseline" getVal={m => m.drift} isDrift />

            <SectionHeader>Blue Sky Composition</SectionHeader>
            <DataRow label="Identified" getVal={m => m.identified} />
            <DataRow label="Unidentified" getVal={m => m.unidentified} />
          </tbody>
        </table>
      </div>
    </div>
  );
}