import React, { useMemo } from 'react';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useLeaders, useLeader } from '@/hooks/useLeaders';
import { useAuth } from '@/lib/AuthContext';
import { getFyLabel } from '@/lib/fiscalYear';
import { getAvailableFyMonths } from '@/lib/fyMonths';

const selectClass = 'text-sm border border-border rounded-md px-3 py-1.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50';

export default function LeaderFYSelector({
  showFY = true,
  showLeader = true,
  showMonth = false,
  selectedMonth = '',
  onMonthChange,
}) {
  const { selectedLeaderId, setSelectedLeaderId, activeFY, setActiveFY, fiscalYears, fyLoading } = useGlobalSelector();
  const { user } = useAuth();
  const { data: leaders = [], isLoading } = useLeaders({ enabled: user?.role !== 'user' });

  const showLeaderDropdown = showLeader && user?.role !== 'user';
  const showLeaderLabel = showLeader && user?.role === 'user';
  const { data: scopedLeader } = useLeader(showLeaderLabel ? selectedLeaderId : null);

  const availableMonths = useMemo(
    () => getAvailableFyMonths(activeFY, fiscalYears),
    [activeFY, fiscalYears]
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showLeaderLabel && (
        <div
          className="text-sm px-3 py-1.5 min-w-[140px] border border-border rounded-md bg-muted/30"
          aria-label="Leader"
        >
          <span className="font-medium text-foreground">{user?.full_name}</span>
          {scopedLeader?.name && (
            <span className="text-muted-foreground text-xs ml-1">({scopedLeader.name})</span>
          )}
        </div>
      )}

      {showLeaderDropdown && (
        <select
          value={selectedLeaderId ?? ''}
          onChange={e => setSelectedLeaderId(e.target.value)}
          disabled={isLoading}
          className={`${selectClass} min-w-[140px]`}
          aria-label="Leader"
        >
          {isLoading ? (
            <option value="">Loading…</option>
          ) : (
            leaders.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))
          )}
        </select>
      )}

      {showMonth && (
        <select
          value={selectedMonth}
          onChange={e => onMonthChange?.(e.target.value)}
          className={`${selectClass} min-w-[130px]`}
          aria-label="Filter by month"
        >
          <option value="">All Months</option>
          {availableMonths.map(m => (
            <option key={m.key} value={m.key}>{m.full}</option>
          ))}
        </select>
      )}

      {showFY && (
        <select
          value={activeFY ?? ''}
          onChange={e => setActiveFY(e.target.value)}
          disabled={fyLoading || !fiscalYears.length}
          className={`${selectClass} min-w-[120px]`}
          aria-label="Fiscal year"
        >
          {fyLoading ? (
            <option value="">Loading FY…</option>
          ) : fiscalYears.length === 0 ? (
            <option value="">No fiscal years</option>
          ) : (
            fiscalYears.map(fy => (
              <option key={fy.slug} value={fy.slug}>{getFyLabel(fy.slug, fiscalYears)}</option>
            ))
          )}
        </select>
      )}
    </div>
  );
}
