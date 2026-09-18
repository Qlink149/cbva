import React, { useMemo } from 'react';
import { ListChecks, AlertCircle } from 'lucide-react';
import { isActionOverdue } from '@/lib/isActionOverdue';

export default function ActionsCard({ actions = [], fyLabel = '', isLoading = false }) {
  const { overdue, upcoming } = useMemo(() => {
    const overdueItems = [];
    const upcomingItems = [];
    actions.forEach((a) => {
      if (isActionOverdue(a.due_date || a.deadline, a.status)) overdueItems.push(a);
      else if (!['Completed', 'Done', 'Abandoned', 'Closed'].includes(a.status)) upcomingItems.push(a);
    });
    return { overdue: overdueItems, upcoming: upcomingItems };
  }, [actions]);

  if (isLoading) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 animate-pulse">
        <div className="h-4 w-32 bg-slate-200 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-8 bg-slate-200 rounded" />
          <div className="h-8 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  const label = (a) => {
    const text = a.description || a.category || 'Untitled action';
    return a.clientName ? `${a.clientName}: ${text}` : text;
  };
  const isEmpty = overdue.length === 0 && upcoming.length === 0;

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <ListChecks className="w-4 h-4 text-slate-400" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Actions{fyLabel ? ` · ${fyLabel}` : ''}
        </p>
      </div>

      {isEmpty ? (
        <p className="text-sm text-slate-400 italic">No open action items.</p>
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
                {overdue.map((a, i) => (
                  <li
                    key={a.id ?? a.num ?? i}
                    className="flex items-start justify-between gap-3 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5"
                  >
                    <span className="text-xs font-medium text-red-700 min-w-0 truncate">{label(a)}</span>
                    {a.due_date || a.deadline ? (
                      <span className="text-[10px] font-medium text-red-500 whitespace-nowrap">{a.due_date || a.deadline}</span>
                    ) : null}
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
              <ul className="space-y-1">
                {upcoming.map((a, i) => (
                  <li
                    key={a.id ?? a.num ?? i}
                    className="flex items-start justify-between gap-3 rounded-lg bg-white border border-slate-200 px-3 py-1.5"
                  >
                    <span className="text-xs font-medium text-slate-700 min-w-0 truncate">{label(a)}</span>
                    {a.due_date || a.deadline ? (
                      <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">{a.due_date || a.deadline}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
