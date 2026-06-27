import React, { useMemo } from 'react';

export default function TeamMetrics({ hiringReqs = [], teamMembers = [] }) {
  const headcountRows = useMemo(() => {
    if (!teamMembers.length) return [];
    const groups = {};
    teamMembers.forEach(m => {
      const key = m.designation || m.role || 'Other';
      groups[key] = (groups[key] || 0) + 1;
    });
    return Object.entries(groups).map(([designation, existing]) => ({
      designation,
      boardApproved: existing,
      existing,
    }));
  }, [teamMembers]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="px-6 py-4 border-b border-border/60">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Team Metrics</p>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Hiring Updates</h3>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Role / Designation</th>
                  <th className="text-center py-2 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">No. Required</th>
                  <th className="text-center py-2 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Closed</th>
                  <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {hiringReqs.map((h, i) => {
                  const isFilled = h.closed >= h.required;
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-foreground">{h.role || h.role_title}</td>
                      <td className="py-2.5 px-4 text-center text-muted-foreground">{h.required}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`font-semibold ${isFilled ? 'text-emerald-600' : 'text-amber-600'}`}>{h.closed}</span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">{h.remarks || '—'}</td>
                    </tr>
                  );
                })}
                {hiringReqs.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-4 text-muted-foreground text-xs">No hiring data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {headcountRows.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Headcount — Board Approved vs Existing</h3>
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Designation</th>
                    <th className="text-center py-2 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Board Approved</th>
                    <th className="text-center py-2 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Existing Headcount</th>
                  </tr>
                </thead>
                <tbody>
                  {headcountRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-foreground">{row.designation}</td>
                      <td className="py-2.5 px-4 text-center text-muted-foreground">{row.boardApproved}</td>
                      <td className="py-2.5 px-4 text-center font-semibold text-foreground">{row.existing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
