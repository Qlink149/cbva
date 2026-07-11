import React, { useMemo } from 'react';
import { TEAM_DESIGNATIONS, sortByDesignation } from '@/lib/designations';

const CORE_DESIGNATIONS = TEAM_DESIGNATIONS.filter(d => d !== 'Other');

const HIRING_STATUS_STYLES = {
  'Open': 'text-status-blue',
  'In Progress': 'text-amber-600',
  'Filled': 'text-emerald-600',
  'On Hold': 'text-muted-foreground',
};

export default function TeamMetrics({ hiringReqs = [], teamMembers = [], approvedByDesignation = {} }) {
  const headcountRows = useMemo(() => {
    const currentByDesignation = {};
    teamMembers.forEach(m => {
      const key = m.designation || 'Other';
      currentByDesignation[key] = (currentByDesignation[key] || 0) + 1;
    });

    const set = new Set(CORE_DESIGNATIONS);
    Object.keys(currentByDesignation).forEach(d => set.add(d));
    Object.keys(approvedByDesignation).forEach(d => set.add(d));

    return Array.from(set)
      .sort(sortByDesignation)
      .map(designation => {
        const existing = currentByDesignation[designation] || 0;
        const boardApproved = approvedByDesignation[designation] || 0;
        return { designation, boardApproved, existing, vacancies: boardApproved - existing };
      });
  }, [teamMembers, approvedByDesignation]);

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
                  <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Level</th>
                  <th className="text-center py-2 px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-remarks">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {hiringReqs.map((h, i) => (
                  <tr key={h.id || i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-foreground">{h.role_title}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{h.level || '—'}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`font-semibold ${HIRING_STATUS_STYLES[h.status] || 'text-muted-foreground'}`}>{h.status}</span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground col-remarks">{h.remarks || '—'}</td>
                  </tr>
                ))}
                {hiringReqs.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-4 text-muted-foreground text-xs">No hiring data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {headcountRows.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Headcount — Board Approved vs Current</h3>
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left py-2 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Designation</th>
                    <th className="text-center py-2 px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Current</th>
                    <th className="text-center py-2 px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Board Approved</th>
                    <th className="text-center py-2 px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Vacancies</th>
                  </tr>
                </thead>
                <tbody>
                  {headcountRows.map((row) => (
                    <tr key={row.designation} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-foreground">{row.designation}</td>
                      <td className="py-2.5 px-2 text-center font-semibold text-foreground">{row.existing}</td>
                      <td className="py-2.5 px-2 text-center text-muted-foreground">{row.boardApproved}</td>
                      <td className={`py-2.5 px-2 text-center font-semibold ${row.vacancies > 0 ? 'text-status-amber' : 'text-muted-foreground'}`}>{row.vacancies}</td>
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
