import React from 'react';
import { CalendarClock, AlertCircle } from 'lucide-react';

const QUARTERS = [
  { key: 'q1', label: 'Q1 (Apr–Jun)' },
  { key: 'q2', label: 'Q2 (Jul–Sep)' },
  { key: 'q3', label: 'Q3 (Oct–Dec)' },
  { key: 'q4', label: 'Q4 (Jan–Mar)' },
];

export default function MeetingsCard({ meetings = [], fyLabel = '' }) {
  const overdue = [];
  const upcoming = [];

  meetings.forEach((m) => {
    if (m.frequency === 'Waiver') return;
    QUARTERS.forEach((q) => {
      const status = m[q.key];
      const date = m[`${q.key}Date`] || '';
      if (status === 'Overdue') overdue.push({ client: m.client, quarter: q.label, date });
      else if (status === 'Planned') upcoming.push({ client: m.client, quarter: q.label, date });
    });
  });

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
                    key={`${item.client}-${item.quarter}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5"
                  >
                    <span className="text-xs font-medium text-red-700 truncate">{item.client}</span>
                    <span className="text-[10px] font-medium text-red-500 whitespace-nowrap">{item.date || item.quarter}</span>
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
              <p className="text-xs text-slate-400 italic">None planned.</p>
            ) : (
              <ul className="space-y-1">
                {upcoming.map((item, i) => (
                  <li
                    key={`${item.client}-${item.quarter}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200 px-3 py-1.5"
                  >
                    <span className="text-xs font-medium text-slate-700 truncate">{item.client}</span>
                    <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">{item.date || item.quarter}</span>
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
