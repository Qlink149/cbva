import React from 'react';
import { motion } from 'framer-motion';
import { formatINRHero, formatINR, formatINRFull } from '@/lib/formatCurrency';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel } from '@/lib/fiscalYear';
import { useFirmwideLeaders } from '@/hooks/useFirmwide';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';

const CR = 10000000;
const L  = 100000;

const STATUS_COLORS = { green: '#10B981', amber: '#F59E0B', blueSky: '#0A2540' };

function fmt(val) {
  if (!val && val !== 0) return '—';
  const cr = val / CR;
  if (cr >= 1) return `₹${cr.toFixed(2)} Cr`;
  const l = val / L;
  if (l >= 0.01) return `₹${l.toFixed(2)} L`;
  return '₹0';
}

function fmtIndian(val) {
  if (val === null || val === undefined || val === 0) return val === 0 ? '₹0' : '—';
  return formatINRFull(val);
}

function PipelineBar({ green, amber, blueSky, total }) {
  if (!total) return null;
  const gPct = (green / total) * 100;
  const aPct = (amber / total) * 100;
  const bPct = (blueSky / total) * 100;
  return (
    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex mt-2">
      {green > 0 && <div style={{ width: `${gPct}%`, background: STATUS_COLORS.green }} className="h-full" />}
      {amber > 0 && <div style={{ width: `${aPct}%`, background: STATUS_COLORS.amber }} className="h-full" />}
      {blueSky > 0 && <div style={{ width: `${bPct}%`, background: STATUS_COLORS.blueSky }} className="h-full" />}
    </div>
  );
}

function LeaderCard({ ld, index, fyLabel }) {
  const initials = ld.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const total = ld.total_pipeline;
  const green = ld.total_green;
  const amber = ld.total_amber;
  const blueSky = ld.total_blue_sky;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden"
    >
      <div className="px-6 pt-6 pb-4 border-b border-border/60" style={{ background: 'linear-gradient(135deg,#f8faff,#ffffff)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cbva-navy text-white flex items-center justify-center text-base font-semibold shrink-0 shadow-md">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground">{ld.name}</h3>
            <p className="text-xs text-muted-foreground">{ld.practice} · {fyLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-medium font-tabular text-foreground">
              {formatINRHero(total).number}<span className="text-base text-muted-foreground ml-0.5">{formatINRHero(total).suffix}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Total Pipeline</p>
          </div>
        </div>
      </div>

      <div className="px-6 pt-4 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pipeline Breakdown</p>
        <PipelineBar green={green} amber={amber} blueSky={blueSky} total={total} />
        <div className="flex gap-3 mt-1.5 flex-wrap">
          <span className="text-[10px] text-emerald-700 font-medium">G: {fmt(green)}</span>
          <span className="text-[10px] text-amber-600 font-medium">A: {fmt(amber)}</span>
          {blueSky > 0 && <span className="text-[10px] text-blue-600 font-medium">BS: {fmt(blueSky)}</span>}
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-t border-border/60 mt-2">
        {[
          { label: 'Green', value: green, color: 'text-status-green' },
          { label: 'Amber', value: amber, color: 'text-status-amber' },
          { label: 'Blue Sky', value: blueSky, color: 'text-cbva-navy' },
        ].map(s => (
          <div key={s.label} className="px-4 py-3 text-center">
            <p className={`text-sm font-semibold font-tabular ${s.color}`}>
              {formatINRHero(s.value).number}<span className="text-[10px] text-muted-foreground">{formatINRHero(s.value).suffix}</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="px-6 py-3 border-t border-border/60 bg-muted/20">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground">Collected YTD</span>
          <span className="text-xs font-semibold font-tabular text-foreground">{fmt(ld.total_collected)}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Leaders() {
  const { activeFY, fiscalYears } = useGlobalSelector();
  const { data: leaders = [], isLoading } = useFirmwideLeaders(activeFY);

  const fyLabel = getFyLabel(activeFY, fiscalYears);

  const firmTotal     = leaders.reduce((s, l) => s + (l.total_pipeline  || 0), 0);
  const firmGreen     = leaders.reduce((s, l) => s + (l.total_green     || 0), 0);
  const firmAmber     = leaders.reduce((s, l) => s + (l.total_amber     || 0), 0);
  const firmBlueSky   = leaders.reduce((s, l) => s + (l.total_blue_sky  || 0), 0);
  const firmCollected = leaders.reduce((s, l) => s + (l.total_collected || 0), 0);
  const firmEngagements = leaders.reduce((s, l) => s + (l.engagement_count || 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Leaders</h1>
          <p className="text-sm text-muted-foreground mt-1">{fyLabel} · {leaders.length} leaders · {firmEngagements} engagements</p>
        </div>
        <LeaderFYSelector />
      </div>

      {/* Firm-wide KPI strip */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.07)]"
        style={{ background: 'linear-gradient(135deg,#0A2540,#1a3a5c)' }}
      >
        <div className="px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-4">Firm-Wide Combined · {fyLabel}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Pipeline', value: firmTotal, big: true },
              { label: 'Green',          value: firmGreen },
              { label: 'Amber',          value: firmAmber },
              { label: 'Blue Sky',       value: firmBlueSky },
              { label: 'Collected YTD',  value: firmCollected },
              { label: 'Engagements',    value: firmEngagements, isCount: true },
            ].map(s => {
              const h = formatINRHero(s.value);
              return (
                <div key={s.label} className="text-white">
                  <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">{s.label}</p>
                  {s.isCount ? (
                    <p className={`font-tabular font-semibold text-lg`}>{s.value}</p>
                  ) : (
                    <p className={`font-tabular font-semibold ${s.big ? 'text-2xl' : 'text-lg'}`}>
                      {h.number}<span className="text-xs text-white/50 ml-0.5">{h.suffix}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Leader cards */}
      {leaders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-dashed border-border/60">
          <p>No leader data available for {fyLabel}.</p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {leaders.map((ld, i) => (
            <LeaderCard key={ld.id} ld={ld} index={i} fyLabel={fyLabel} />
          ))}
        </div>
      )}

      {/* Comparative Table */}
      <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h2 className="text-sm font-semibold text-foreground">Leader Comparison — {fyLabel}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 800 }}>
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Leader</th>
                <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Practice</th>
                <th className="text-right py-3 col-num text-[11px] uppercase tracking-wider text-emerald-700 font-medium">Green</th>
                <th className="text-right py-3 col-num text-[11px] uppercase tracking-wider text-amber-600 font-medium">Amber</th>
                <th className="text-right py-3 col-num text-[11px] uppercase tracking-wider text-cbva-navy font-medium">Blue Sky</th>
                <th className="text-right py-3 col-num text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Grand Total</th>
                <th className="text-right py-3 col-num text-[11px] uppercase tracking-wider text-muted-foreground font-medium">YTD Collected</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((ld) => (
                <tr key={ld.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground text-xs">{ld.name}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{ld.practice}</td>
                  <td className="py-3 text-right col-num font-tabular text-emerald-700 text-xs">{fmtIndian(ld.total_green)}</td>
                  <td className="py-3 text-right col-num font-tabular text-amber-600 text-xs">{fmtIndian(ld.total_amber)}</td>
                  <td className="py-3 text-right col-num font-tabular text-cbva-navy text-xs">{ld.total_blue_sky > 0 ? fmtIndian(ld.total_blue_sky) : '—'}</td>
                  <td className="py-3 text-right col-num font-tabular font-semibold text-foreground text-xs">{fmtIndian(ld.total_pipeline)}</td>
                  <td className="py-3 text-right col-num font-tabular text-slate-600 text-xs">{fmtIndian(ld.total_collected)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 border-t-2 border-border">
                <td className="py-3 px-4 text-xs font-bold uppercase text-foreground" colSpan={2}>TOTAL</td>
                <td className="py-3 text-right col-num font-tabular font-bold text-emerald-700 text-xs">{fmtIndian(firmGreen)}</td>
                <td className="py-3 text-right col-num font-tabular font-bold text-amber-600 text-xs">{fmtIndian(firmAmber)}</td>
                <td className="py-3 text-right col-num font-tabular font-bold text-cbva-navy text-xs">{fmtIndian(firmBlueSky)}</td>
                <td className="py-3 text-right col-num font-tabular font-bold text-foreground text-xs">{fmtIndian(firmTotal)}</td>
                <td className="py-3 text-right col-num font-tabular font-bold text-slate-700 text-xs">{fmtIndian(firmCollected)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
