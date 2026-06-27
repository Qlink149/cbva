import React, { useMemo, useState } from 'react';
import { formatINR } from '@/lib/formatCurrency';
import { Wallet, ChevronDown } from 'lucide-react';

const FY_MONTHS = [
  { key: '04', label: 'Apr', full: 'April' },
  { key: '05', label: 'May', full: 'May' },
  { key: '06', label: 'Jun', full: 'June' },
  { key: '07', label: 'Jul', full: 'July' },
  { key: '08', label: 'Aug', full: 'August' },
  { key: '09', label: 'Sep', full: 'September' },
  { key: '10', label: 'Oct', full: 'October' },
  { key: '11', label: 'Nov', full: 'November' },
  { key: '12', label: 'Dec', full: 'December' },
  { key: '01', label: 'Jan', full: 'January' },
  { key: '02', label: 'Feb', full: 'February' },
  { key: '03', label: 'Mar', full: 'March' },
];

const PERIOD_OPTIONS = [
  { key: 'all', label: 'Full Year' },
  { key: 'q1', label: 'Q1 (Apr–Jun)' },
  { key: 'q2', label: 'Q2 (Jul–Sep)' },
  { key: 'q3', label: 'Q3 (Oct–Dec)' },
  { key: 'q4', label: 'Q4 (Jan–Mar)' },
];

const PERIOD_MONTHS = {
  all: ['04','05','06','07','08','09','10','11','12','01','02','03'],
  q1: ['04','05','06'],
  q2: ['07','08','09'],
  q3: ['10','11','12'],
  q4: ['01','02','03'],
};

function getCurrentQuarter() {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 4 && month <= 6) return 'q1';
  if (month >= 7 && month <= 9) return 'q2';
  if (month >= 10 && month <= 12) return 'q3';
  return 'q4';
}

export default function CollectionsTable({ monthlyLines = [], boardTotal = 0, selectedMonth, onMonthSelect }) {
  const [period, setPeriod] = useState(getCurrentQuarter);
  const [showPeriodDrop, setShowPeriodDrop] = useState(false);

  const defaultGoal = boardTotal > 0 ? boardTotal / 12 : 0;

  const now = new Date();
  const activeKeys = PERIOD_MONTHS[period];

  const rows = useMemo(() => {
    return FY_MONTHS.filter(m => activeKeys.includes(m.key)).map(m => {
      const monthLines = monthlyLines.filter(l => {
        if (!l.month) return false;
        return String(new Date(l.month).getMonth() + 1).padStart(2, '0') === m.key;
      });

      const planned = monthLines.find(l => !l.engagement_id)?.expected_collection ?? defaultGoal;
      const collected = monthLines.filter(l => l.engagement_id).reduce((s, l) => s + (l.actual_collection || 0), 0);
      const outstanding = Math.max(0, planned - collected);
      const variance = collected - planned;
      const isPast = new Date(`2025-${m.key}-01`) <= now || new Date(`2026-${m.key}-01`) <= now;

      return { ...m, planned, collected, outstanding, variance, isPast };
    });
  }, [monthlyLines, period, defaultGoal, now]);

  const ytdRows = rows.filter(r => r.isPast || r.collected > 0);
  const ytdPlanned = ytdRows.reduce((s, r) => s + r.planned, 0);
  const ytdCollected = ytdRows.reduce((s, r) => s + r.collected, 0);
  const ytdVariance = ytdCollected - ytdPlanned;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Collections</h3>
          </div>


        </div>

        {/* KPI chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            YTD Planned <span className="font-tabular font-semibold">{formatINR(ytdPlanned)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            YTD Collected <span className="font-tabular font-semibold">{formatINR(ytdCollected)}</span>
          </span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-tabular ${ytdVariance >= 0 ? 'bg-status-green-bg text-status-green' : 'bg-status-red-bg text-status-red'}`}>
            {ytdVariance >= 0 ? '▲' : '▼'} Variance {formatINR(Math.abs(ytdVariance))}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Month</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Planned</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Collected</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Outstanding</th>
              <th className="text-right py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.key}
                onClick={() => onMonthSelect && onMonthSelect(selectedMonth?.key === row.key ? null : row)}
                className={`border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer ${selectedMonth?.key === row.key ? 'bg-indigo-50/60 ring-1 ring-inset ring-indigo-200' : ''}`}
              >
                <td className="py-3 px-4 font-medium text-foreground flex items-center gap-1.5">
                  {row.full}
                  {selectedMonth?.key === row.key && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">Selected</span>}
                </td>
                <td className="py-3 px-4 text-right font-tabular text-muted-foreground">{formatINR(row.planned)}</td>
                <td className="py-3 px-4 text-right font-tabular font-semibold text-foreground">{formatINR(row.collected)}</td>
                <td className="py-3 px-4 text-right font-tabular text-slate-500">
                  {row.outstanding > 0 ? formatINR(row.outstanding) : '—'}
                </td>
                <td className={`py-3 px-4 text-right font-tabular font-semibold ${
                  row.variance > 0 ? 'text-status-green' : row.variance < 0 ? 'text-status-red' : 'text-muted-foreground'
                }`}>
                  {row.variance === 0 && row.collected === 0 ? '—' : (
                    <>{row.variance >= 0 ? '+' : ''}{formatINR(row.variance)}</>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 border-t border-border">
              <td className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-foreground">Total</td>
              <td className="py-3 px-4 text-right font-tabular font-bold text-foreground">{formatINR(rows.reduce((s, r) => s + r.planned, 0))}</td>
              <td className="py-3 px-4 text-right font-tabular font-bold text-foreground">{formatINR(rows.reduce((s, r) => s + r.collected, 0))}</td>
              <td className="py-3 px-4 text-right font-tabular font-bold text-slate-500">{formatINR(rows.reduce((s, r) => s + r.outstanding, 0))}</td>
              <td className={`py-3 px-4 text-right font-tabular font-bold ${ytdVariance >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                {ytdVariance >= 0 ? '+' : ''}{formatINR(ytdVariance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}