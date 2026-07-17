import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { formatINRFull } from '@/lib/formatCurrency';
import {
  FY_MONTHS,
  getCurrentMonthKey,
  getFyMonthLabelYear,
  getAvailableFyMonths,
  MONTH_FULL_NAMES,
} from '@/lib/fyMonths';
import { priorYearActualRowsForLeader } from '@/lib/consolidatedSummary';

/** Show em-dash for missing or zero amounts — never hide the cell. */
function fmt(val, emptyLabel = '—') {
  if (val === null || val === undefined || val === '' || Number(val) === 0) return emptyLabel;
  if (val === 'TBD') return 'TBD';
  return formatINRFull(val);
}

function emptyAmounts(placeholder = null) {
  return { green: placeholder, amber: placeholder, blueSky: placeholder, total: placeholder };
}

function matchMonthKey(label) {
  if (!label) return null;
  const lower = String(label).toLowerCase();
  for (const m of FY_MONTHS) {
    const full = (MONTH_FULL_NAMES[m.key] || m.full || '').toLowerCase();
    if (full && lower.includes(full)) return m.key;
  }
  return null;
}

function AmountCells({ row, emphasize = false, emptyLabel = '—' }) {
  return (
    <>
      <td className={`py-2.5 text-right col-num font-tabular text-slate-600 whitespace-nowrap ${emphasize ? 'font-semibold' : ''}`}>{fmt(row.green, emptyLabel)}</td>
      <td className={`py-2.5 text-right col-num font-tabular text-slate-600 whitespace-nowrap ${emphasize ? 'font-semibold' : ''}`}>{fmt(row.amber, emptyLabel)}</td>
      <td className={`py-2.5 text-right col-num font-tabular text-slate-600 whitespace-nowrap ${emphasize ? 'font-semibold' : ''}`}>{fmt(row.blueSky, emptyLabel)}</td>
      <td className={`py-2.5 text-right col-num font-tabular font-semibold text-slate-700 whitespace-nowrap`}>{fmt(row.total, emptyLabel)}</td>
    </>
  );
}

/**
 * Monthly Plan Evolution:
 * - Prior-year actual YTD (from consolidated) at top
 * - Initial / Board plan rows when present
 * - Current month always visible with live Green/Amber/Blue Sky/Total
 * - Prior months hidden behind header arrow; expand to show "TBD"
 */
export default function MonthlyEvolutionCard({
  pipelineData = [],
  fyLabel = '',
  fySlug = '',
  leaderId = '',
  consolidatedRows = [],
  consolidatedColumns = [],
}) {
  const [prevOpen, setPrevOpen] = useState(false);
  const currentMonthKey = getCurrentMonthKey();

  const actualYtdRows = useMemo(
    () => priorYearActualRowsForLeader(consolidatedRows, consolidatedColumns, leaderId, fySlug),
    [consolidatedRows, consolidatedColumns, leaderId, fySlug]
  );

  const { planRows, prevMonthRows, currentRow } = useMemo(() => {
    const plans = (pipelineData || [])
      .filter((r) => {
        const t = (r.snapshot_type || '').toLowerCase();
        const label = (r.label || '').toLowerCase();
        return t === 'initial' || t === 'board' || label.includes('initial plan') || label.includes('board plan');
      })
      .map((r) => ({
        key: `plan-${r.label}`,
        label: r.label,
        green: r.green,
        amber: r.amber,
        blueSky: r.blueSky,
        total: r.total,
      }));

    const monthlyByKey = {};
    (pipelineData || []).forEach((r) => {
      const mk = matchMonthKey(r.label);
      if (mk) monthlyByKey[mk] = r;
    });

    const elapsed = getAvailableFyMonths(fySlug).map((m) => m.key);
    const monthKeys = elapsed.length
      ? elapsed
      : FY_MONTHS.map((m) => m.key).filter((k) => {
          const order = FY_MONTHS.findIndex((m) => m.key === k);
          const cur = FY_MONTHS.findIndex((m) => m.key === currentMonthKey);
          return order >= 0 && cur >= 0 && order <= cur;
        });

    const prev = [];
    let current = null;

    monthKeys.forEach((mk) => {
      const label = getFyMonthLabelYear(mk, fySlug) || MONTH_FULL_NAMES[mk] || mk;
      if (mk === currentMonthKey) {
        const src = monthlyByKey[mk];
        current = src
          ? {
              key: `month-${mk}`,
              label,
              green: src.green,
              amber: src.amber,
              blueSky: src.blueSky,
              total: src.total,
            }
          : { key: `month-${mk}`, label, ...emptyAmounts() };
      } else {
        prev.push({ key: `month-${mk}`, label, ...emptyAmounts('TBD'), isTbd: true });
      }
    });

    return { planRows: plans, prevMonthRows: prev, currentRow: current };
  }, [pipelineData, fySlug, currentMonthKey, leaderId]);

  const hasAny =
    actualYtdRows.some((r) => r.total != null) ||
    planRows.length > 0 ||
    currentRow ||
    prevMonthRows.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden w-full">
      <div className="px-6 pt-5 pb-2.5 border-b border-border/60 flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Monthly Plan Evolution</p>
          <p className="text-sm text-muted-foreground mt-0.5">{fyLabel || '—'}</p>
        </div>
        {prevMonthRows.length > 0 && (
          <button
            type="button"
            onClick={() => setPrevOpen((o) => !o)}
            aria-expanded={prevOpen}
            aria-label={prevOpen ? 'Hide previous months' : 'Show previous months'}
            className="shrink-0 mt-0.5 p-1.5 rounded-md text-muted-foreground hover:text-cbva-navy hover:bg-muted/60 transition-colors"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${prevOpen ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="border-b border-border">
              <th className="text-left py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground col-num">Particular</th>
              <th className="text-right py-3 col-num text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Green</th>
              <th className="text-right py-3 col-num text-[10px] font-semibold uppercase tracking-wider text-amber-600">Amber</th>
              <th className="text-right py-3 col-num text-[10px] font-semibold uppercase tracking-wider text-cbva-navy">Blue Sky</th>
              <th className="text-right py-3 col-num text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {actualYtdRows.map((row) => (
              <tr key={row.key} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                <td className="py-2.5 font-medium text-slate-700 col-num">{row.label}</td>
                <AmountCells row={row} />
              </tr>
            ))}

            {planRows.map((row) => (
              <tr key={row.key} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                <td className="py-2.5 font-medium text-slate-700 col-num">{row.label || '—'}</td>
                <AmountCells row={row} />
              </tr>
            ))}

            {prevOpen && prevMonthRows.map((row) => (
              <tr key={row.key} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                <td className="py-2.5 font-medium text-slate-500 col-num">{row.label}</td>
                <AmountCells row={row} emptyLabel="TBD" />
              </tr>
            ))}

            {currentRow && (
              <tr className="border-b border-border/40 bg-muted/20 font-semibold hover:bg-muted/10 transition-colors">
                <td className="py-2.5 font-medium text-slate-700 col-num">
                  {currentRow.label}
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-sky-700">Current</span>
                </td>
                <AmountCells row={currentRow} emphasize />
              </tr>
            )}

            {!hasAny && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted-foreground">No plan evolution rows yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
