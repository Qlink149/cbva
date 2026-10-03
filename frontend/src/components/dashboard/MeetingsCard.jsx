import React, { useMemo } from 'react';
import { CalendarClock, AlertCircle } from 'lucide-react';
import { FY_MONTHS } from '@/lib/fyMonths';
import { resolveMeetingMonthly } from '@/lib/meetingMonths';

export default function MeetingsCard({ meetings = [], fyLabel = '', isLoading = false }) {
  const { overdue, upcoming } = useMemo(() => {
    const overdueItems = [];
    const upcomingItems = [];
    meetings.forEach((m) => {
      if (m.frequency === 'Waiver') return;
      const monthly = m.monthly || resolveMeetingMonthly(m);
      FY_MONTHS.forEach(({ key, label }) => {
        const cell = monthly[key] || {};
        const status = cell.status;
        const date = cell.date || '';
        if (status === 'Overdue') overdueItems.push({ client: m.client, monthLabel: label, date });
        else if (status === 'Planned') upcomingItems.push({ client: m.client, monthLabel: label, date });
      });
    });
    return { overdue: overdueItems, upcoming: upcomingItems };
  }, [meetings]);

  if (isLoading) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 animate-pulse">
        <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-8 bg-slate-200 rounded" />
          <div className="h-8 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  const isEmpty = overdue.length === 0 && upcoming.length === 0;

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="w-4 h-4 text-slate-400" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Client Meetings{fyLabel ? ` · ${fyLabel}` : ''}
        </p>
      </div>

      {isEmpty ? (
        <p className="text-sm text-slate-400 italic">No overdue or upcoming client meetings.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">
                Overdue ({overdue.length})
              </p>
            </div>
            {overdue.length === 0 ? (
              <p className="text-xs text-slate-400 italic">None overdue.</p>
            ) : (
              <ul className="space-y-1">
                {overdue.map((item, i) => (
                  <li
                    key={`${item.client}-${item.monthLabel}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5"
                  >
                    <span className="text-xs font-medium text-red-700 truncate">{item.client}</span>
                    <span className="text-[10px] font-medium text-red-500 whitespace-nowrap">{item.date || item.monthLabel}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Upcoming ({upcoming.length})
            </p>
            {upcoming.length === 0 ? (
              <p className="text-xs text-slate-400 italic">None upcoming.</p>
            ) : (
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {upcoming.slice(0, 8).map((item, i) => (
                  <li
                    key={`${item.client}-${item.monthLabel}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200/80 px-3 py-1.5"
                  >
                    <span className="text-xs font-medium text-slate-700 truncate">{item.client}</span>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">{item.date || item.monthLabel}</span>
                  </li>
                ))}
                {upcoming.length > 8 && (
                  <li className="text-[11px] text-slate-400 pt-1">+{upcoming.length - 8} more</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
