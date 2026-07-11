import React, { useMemo, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useHeadcount } from '@/hooks/useHeadcount';
import { TEAM_DESIGNATIONS, sortByDesignation } from '@/lib/designations';

const CORE_DESIGNATIONS = TEAM_DESIGNATIONS.filter(d => d !== 'Other');

export default function HeadcountTable({ teamMembers = [], leaderId, fyLabel = '' }) {
  const { approvedByDesignation, setApproved } = useHeadcount(leaderId);

  const currentByDesignation = useMemo(() => {
    const groups = {};
    teamMembers.forEach(m => {
      const key = m.designation || 'Other';
      groups[key] = (groups[key] || 0) + 1;
    });
    return groups;
  }, [teamMembers]);

  const designations = useMemo(() => {
    const set = new Set(CORE_DESIGNATIONS);
    Object.keys(currentByDesignation).forEach(d => set.add(d));
    Object.keys(approvedByDesignation).forEach(d => set.add(d));
    return Array.from(set).sort(sortByDesignation);
  }, [currentByDesignation, approvedByDesignation]);

  const [edits, setEdits] = useState({});

  useEffect(() => {
    setEdits({});
  }, [approvedByDesignation]);

  const approvedValue = (d) => (edits[d] !== undefined ? edits[d] : String(approvedByDesignation[d] ?? 0));

  const commit = (d) => {
    const raw = edits[d];
    if (raw === undefined) return;
    const parsed = parseInt(raw, 10) || 0;
    if (parsed === (approvedByDesignation[d] ?? 0)) return;
    setApproved.mutate({ designation: d, board_approved: parsed });
  };

  const rows = designations.map(d => {
    const current = currentByDesignation[d] || 0;
    const approved = parseInt(approvedValue(d), 10) || 0;
    return { designation: d, current, approved, vacancies: approved - current };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      current: acc.current + r.current,
      approved: acc.approved + r.approved,
      vacancies: acc.vacancies + r.vacancies,
    }),
    { current: 0, approved: 0, vacancies: 0 }
  );

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-6 py-5 border-b border-border/60">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Hiring Pending / Vacancies{fyLabel ? ` · ${fyLabel}` : ''}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Designation</th>
              <th className="text-center py-3 px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Current Headcount</th>
              <th className="text-center py-3 px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Board-Approved</th>
              <th className="text-center py-3 px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Vacancies</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.designation} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="py-3 px-4 font-medium text-foreground">{row.designation}</td>
                <td className="py-3 px-2 text-center font-semibold text-foreground">{row.current}</td>
                <td className="py-2 px-2 text-center">
                  <Input
                    type="number"
                    min="0"
                    className="w-20 h-8 mx-auto text-center"
                    value={approvedValue(row.designation)}
                    onChange={(e) => setEdits(p => ({ ...p, [row.designation]: e.target.value }))}
                    onBlur={() => commit(row.designation)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  />
                </td>
                <td className={`py-3 px-2 text-center font-semibold ${row.vacancies > 0 ? 'text-status-amber' : 'text-muted-foreground'}`}>
                  {row.vacancies}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 border-t border-border">
              <td className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-foreground">Total</td>
              <td className="py-3 px-2 text-center font-bold text-foreground">{totals.current}</td>
              <td className="py-3 px-2 text-center font-bold text-foreground">{totals.approved}</td>
              <td className={`py-3 px-2 text-center font-bold ${totals.vacancies > 0 ? 'text-status-amber' : 'text-foreground'}`}>{totals.vacancies}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
