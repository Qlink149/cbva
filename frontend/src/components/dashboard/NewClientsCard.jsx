import React, { useMemo } from 'react';
import { UserPlus } from 'lucide-react';
import { formatINRFull } from '@/lib/formatCurrency';

const selectClass = 'text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring';

export default function NewClientsCard({
  clients = [],
  fyLabel = '',
  isLoading = false,
  selectedMonth = '',
  onMonthChange,
  availableMonths = [],
}) {
  const total = useMemo(
    () => clients.reduce((s, c) => s + (c.total || 0), 0),
    [clients],
  );

  if (isLoading) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 animate-pulse">
        <div className="h-4 w-36 bg-slate-200 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-8 bg-slate-200 rounded" />
          <div className="h-8 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-slate-400" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            New Clients{fyLabel ? ` · ${fyLabel}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {availableMonths.length > 0 && onMonthChange && (
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className={`${selectClass} min-w-[110px]`}
              aria-label="Filter by month"
            >
              <option value="">All Months</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          )}
          <span className="text-xs font-semibold font-tabular text-slate-600">
            {clients.length} · {formatINRFull(total)}
          </span>
        </div>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No new engagements created this FY yet.</p>
      ) : (
        <ul className="space-y-1 max-h-56 overflow-y-auto">
          {clients.slice(0, 12).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200/80 px-3 py-1.5"
            >
              <span className="text-xs font-medium text-slate-700 truncate">{c.name}</span>
              <span className="text-[10px] font-tabular text-slate-500 whitespace-nowrap">
                {formatINRFull(c.total || 0)}
              </span>
            </li>
          ))}
          {clients.length > 12 && (
            <li className="text-[11px] text-slate-400 pt-1">+{clients.length - 12} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
