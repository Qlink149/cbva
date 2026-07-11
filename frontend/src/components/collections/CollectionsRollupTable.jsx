import React from 'react';
import { formatINRFull } from '@/lib/formatCurrency';
import { getFyMonthLabelYear } from '@/lib/fyMonths';

const HDR_BG = '#F8FAFC';

function VarianceCell({ planned, collected, variance, bold = false, extra = '', style }) {
  const base = `py-3 px-2 text-right font-tabular text-xs${bold ? ' font-bold' : ''} ${extra}`;
  if (planned === 0 && collected === 0) {
    return <td className={`${base} text-muted-foreground/50`} style={style}>—</td>;
  }
  return (
    <td className={`${base} ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`} style={style}>
      {variance >= 0 ? `+${formatINRFull(variance)}` : `(${formatINRFull(Math.abs(variance))})`}
    </td>
  );
}

/**
 * Read-only client-wise Planned vs Collected roll-up. Derived from engagements
 * (monthly_plan) + collection transactions; no inline editing.
 */
export default function CollectionsRollupTable({ rows = [], totals = {}, months = [], fySlug }) {
  const stickyFooter = 'sticky bottom-0 z-10';
  const stickyFooterLeft = 'sticky bottom-0 left-0 z-20';

  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="overflow-auto" style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 200px)', minHeight: '560px' }}>
        <table className="text-sm border-separate w-full" style={{ borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: HDR_BG, height: 36 }}>
              <th
                rowSpan={2}
                className="sticky left-0 top-0 z-30 text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border"
                style={{ background: HDR_BG, minWidth: 220, width: 220 }}
              >
                Client
              </th>
              {months.map((mk) => (
                <th
                  key={mk}
                  colSpan={3}
                  className="sticky top-0 z-20 text-center py-2 px-2 text-[11px] uppercase tracking-wider text-cbva-navy font-semibold border-l border-border/40"
                  style={{ background: HDR_BG }}
                >
                  {getFyMonthLabelYear(mk, fySlug)}
                </th>
              ))}
            </tr>
            <tr className="[&>th]:border-b [&>th]:border-border" style={{ background: HDR_BG }}>
              {months.map((mk) => (
                <React.Fragment key={mk}>
                  <th
                    className="sticky z-20 text-right py-2 px-2 text-[10px] uppercase tracking-wider text-cbva-navy font-medium border-l border-border/40"
                    style={{ background: HDR_BG, minWidth: 84, top: 36 }}
                  >
                    Planned
                  </th>
                  <th
                    className="sticky z-20 text-right py-2 px-2 text-[10px] uppercase tracking-wider text-emerald-700 font-medium"
                    style={{ background: HDR_BG, minWidth: 84, top: 36 }}
                  >
                    Collected
                  </th>
                  <th
                    className="sticky z-20 text-right py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium"
                    style={{ background: HDR_BG, minWidth: 84, top: 36 }}
                  >
                    Variance
                  </th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="group border-b border-border/40 hover:bg-muted/30">
                <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 py-3 px-4 text-left text-foreground text-xs font-medium border-b border-border/40">
                  {row.name}
                </td>
                {months.map((mk) => {
                  const m = row.months[mk] || { planned: 0, collected: 0, variance: 0 };
                  return (
                    <React.Fragment key={mk}>
                      <td className="py-3 px-2 text-right font-tabular text-cbva-navy text-xs border-l border-border/40 border-b border-border/40">
                        {m.planned > 0 ? formatINRFull(m.planned) : '-'}
                      </td>
                      <td className="py-3 px-2 text-right font-tabular text-emerald-700 text-xs border-b border-border/40">
                        {m.collected > 0 ? formatINRFull(m.collected) : '—'}
                      </td>
                      <VarianceCell planned={m.planned} collected={m.collected} variance={m.variance} extra="border-b border-border/40" />
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={1 + months.length * 3} className="py-10 text-center text-sm text-muted-foreground">
                  No engagements to roll up for this selection.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: HDR_BG }}>
              <td className={`${stickyFooterLeft} py-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-foreground border-t border-border`} style={{ background: HDR_BG }}>
                Total
              </td>
              {months.map((mk) => {
                const m = totals[mk] || { planned: 0, collected: 0, variance: 0 };
                return (
                  <React.Fragment key={mk}>
                    <td className={`${stickyFooter} py-3 px-2 text-right font-tabular font-bold text-cbva-navy text-xs border-l border-border/40 border-t border-border`} style={{ background: HDR_BG }}>
                      {m.planned > 0 ? formatINRFull(m.planned) : '-'}
                    </td>
                    <td className={`${stickyFooter} py-3 px-2 text-right font-tabular font-bold text-emerald-700 text-xs border-t border-border`} style={{ background: HDR_BG }}>
                      {m.collected > 0 ? formatINRFull(m.collected) : '-'}
                    </td>
                    <VarianceCell planned={m.planned} collected={m.collected} variance={m.variance} bold extra={`${stickyFooter} border-t border-border`} style={{ background: HDR_BG }} />
                  </React.Fragment>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
