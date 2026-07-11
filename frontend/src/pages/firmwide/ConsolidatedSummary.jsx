import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINRFull } from '@/lib/formatCurrency';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel } from '@/lib/fiscalYear';
import { useLeaders } from '@/hooks/useLeaders';
import { useConsolidated } from '@/hooks/useConsolidated';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';
import { buildCsv, TONE_STYLES } from '@/lib/consolidatedSummary';

const fmt = (v) => (v == null ? '—' : formatINRFull(v));

const BORDER = 'border border-[#BFBFBF]';

export default function ConsolidatedSummary() {
  const { activeFY, fiscalYears, fyLoading } = useGlobalSelector();
  const { data: leaders = [] } = useLeaders();

  const { isLoading, isFetching, columns, rows } = useConsolidated(activeFY);
  const fyLabel = getFyLabel(activeFY, fiscalYears);

  const nameByLeader = useMemo(
    () => Object.fromEntries((Array.isArray(leaders) ? leaders : []).map((l) => [l.id, l.name])),
    [leaders]
  );

  const loading = fyLoading || !activeFY || isLoading;

  const stickyFirstCol =
    'sticky left-0 z-20 min-w-[240px] border-r border-[#BFBFBF] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]';
  const stickyHeader =
    'sticky top-0 z-30 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.08)]';
  const stickyCorner =
    'sticky left-0 top-0 z-40 min-w-[240px] border-r border-[#BFBFBF] shadow-[2px_2px_4px_-2px_rgba(0,0,0,0.12)]';

  const handleExport = () => {
    const csv = buildCsv(rows, columns);
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consolidated-summary-${activeFY ?? 'fy'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const rowStyle = (tone, bold = false) => {
    if (!tone || !TONE_STYLES[tone]) {
      return { background: bold ? '#D9D9D9' : undefined, color: '#000000', fontWeight: bold ? 700 : 400 };
    }
    const s = TONE_STYLES[tone];
    return { background: s.bg, color: s.color, fontWeight: bold ? 700 : 500 };
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Consolidated Summary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Management consolidated view · {fyLabel || 'Select fiscal year'}
            {isFetching && !loading ? ' · Updating…' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LeaderFYSelector showLeader={false} />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || !rows.length}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {loading && <Skeleton className="h-96 w-full" />}

      {!loading && rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="p-4 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-3">
              Summary · {fyLabel}
            </p>
            <div
              className="overflow-auto rounded-lg border border-[#BFBFBF]"
              style={{ maxHeight: 'calc(100vh - 180px)', minHeight: '560px' }}
            >
              {/* border-separate is required for sticky th/td to work reliably */}
              <table className="w-max min-w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th
                      className={`${stickyCorner} text-left px-3 py-2 font-bold text-white ${BORDER}`}
                      style={{ fontSize: 11, background: '#808080' }}
                    >
                      Particulars
                    </th>
                    {columns.map((c) => (
                      <th
                        key={c.code}
                        title={c.leader_id ? nameByLeader[c.leader_id] ?? c.code : undefined}
                        className={`${stickyHeader} text-right px-2 py-2 font-bold text-white col-num min-w-[5.5rem] ${BORDER}`}
                        style={{ fontSize: 11, background: '#808080' }}
                      >
                        {c.code}
                      </th>
                    ))}
                    <th
                      className={`${stickyHeader} text-right px-2 py-2 font-bold text-white col-num min-w-[6rem] ${BORDER}`}
                      style={{ fontSize: 11, background: '#808080' }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    if (row.kind === 'section') {
                      return (
                        <tr key={`s-${idx}`}>
                          <td
                            className={`${stickyFirstCol} px-3 py-2 font-bold text-foreground ${BORDER}`}
                            style={{ fontSize: 11, background: '#E8E8E8' }}
                          >
                            {row.label}
                          </td>
                          {columns.map((c) => (
                            <td key={c.code} className={`${BORDER} py-2`} style={{ background: '#E8E8E8' }} aria-hidden />
                          ))}
                          <td className={`${BORDER} py-2`} style={{ background: '#E8E8E8' }} aria-hidden />
                        </tr>
                      );
                    }
                    if (row.kind === 'subheader') {
                      return (
                        <tr key={`h-${idx}`}>
                          <td
                            className={`${stickyFirstCol} px-3 py-1.5 font-semibold italic text-muted-foreground ${BORDER}`}
                            style={{ fontSize: 11, background: '#F3F3F3' }}
                          >
                            {row.label}
                          </td>
                          {columns.map((c) => (
                            <td key={c.code} className={`${BORDER} py-1.5`} style={{ background: '#F3F3F3' }} aria-hidden />
                          ))}
                          <td className={`${BORDER} py-1.5`} style={{ background: '#F3F3F3' }} aria-hidden />
                        </tr>
                      );
                    }

                    const isTotal = row.label?.toLowerCase() === 'total' || row.label === 'Total Bluesky';
                    const style = rowStyle(row.tone, isTotal);
                    const cellBg = style.background ?? '#FFFFFF';

                    return (
                      <tr key={`d-${idx}`}>
                        <td
                          className={`${stickyFirstCol} px-3 py-2 whitespace-nowrap ${BORDER}`}
                          style={{ ...style, fontSize: 11, background: cellBg }}
                        >
                          {row.label}
                        </td>
                        {columns.map((c) => {
                          const val = row.values?.[c.code];
                          return (
                            <td
                              key={c.code}
                              className={`px-2 py-2 text-right font-tabular col-num whitespace-nowrap ${BORDER}`}
                              style={{ ...style, fontSize: 11, background: cellBg }}
                              title={row.is_dynamic ? 'Live from engagements' : undefined}
                            >
                              {fmt(val)}
                            </td>
                          );
                        })}
                        <td
                          className={`px-2 py-2 text-right font-tabular font-semibold col-num whitespace-nowrap ${BORDER}`}
                          style={{ ...style, fontSize: 11, background: cellBg }}
                        >
                          {fmt(row.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          No consolidated data for {fyLabel}. Import the management consolidated sheet to seed this view.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Read-only consolidated view · Historical rows from management sheet · Current FY plan, bifurcation,
          and collections update live from engagements · Blank leaders (AK, SP, VP) shown as “—” · Total column
          auto-sums across leaders.
        </p>
      )}
    </div>
  );
}
