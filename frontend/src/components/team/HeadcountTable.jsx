import React, { useMemo } from 'react';

export default function HeadcountTable({ teamMembers = [], fyLabel = '' }) {
  const rows = useMemo(() => {
    const groups = {};
    teamMembers.forEach(m => {
      const key = m.designation || m.role || 'Other';
      if (!groups[key]) groups[key] = { designation: key, startOfYear: 0, additionalApproved: 0, additionalInYear: 0 };
      groups[key].startOfYear += 1;
    });
    return Object.values(groups);
  }, [teamMembers]);

  const totals = rows.reduce(
    (acc, r) => ({
      startOfYear: acc.startOfYear + r.startOfYear,
      additionalApproved: acc.additionalApproved + r.additionalApproved,
      additionalInYear: acc.additionalInYear + r.additionalInYear,
    }),
    { startOfYear: 0, additionalApproved: 0, additionalInYear: 0 }
  );

  if (!rows.length) {
    return (
      <div className="bg-card rounded-2xl border border-border/60 p-8 text-center text-sm text-muted-foreground">
        No headcount data available{fyLabel ? ` for ${fyLabel}` : ''}.
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-6 py-5 border-b border-border/60">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Headcount{fyLabel ? ` · ${fyLabel}` : ''}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Designation</th>
              <th className="text-center py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Existing Headcount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-3 px-4 font-medium text-foreground">{row.designation}</td>
                <td className="py-3 px-4 text-center font-semibold text-foreground">{row.startOfYear}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 border-t border-border">
              <td className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-foreground">Total</td>
              <td className="py-3 px-4 text-center font-bold text-foreground">{totals.startOfYear}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
