import { FY_MONTHS } from '@/lib/fyMonths';

export const MEETING_QUARTER_GROUPS = [
  { key: 'q1', label: 'Q1 (Apr–Jun)', months: ['04', '05', '06'] },
  { key: 'q2', label: 'Q2 (Jul–Sep)', months: ['07', '08', '09'] },
  { key: 'q3', label: 'Q3 (Oct–Dec)', months: ['10', '11', '12'] },
  { key: 'q4', label: 'Q4 (Jan–Mar)', months: ['01', '02', '03'] },
];

export const FY_MONTH_KEYS = FY_MONTHS.map((m) => m.key);

const QUARTER_MONTHS = MEETING_QUARTER_GROUPS.reduce((acc, g) => {
  acc[g.key] = g.months;
  return acc;
}, {});

/** Client-side backfill when API returns legacy quarterly fields only. */
export function resolveMeetingMonthly(apiRow) {
  if (apiRow?.monthly_status && Object.keys(apiRow.monthly_status).length > 0) {
    const monthly = {};
    FY_MONTH_KEYS.forEach((mk) => {
      const entry = apiRow.monthly_status[mk] || {};
      monthly[mk] = { status: entry.status || '', date: entry.date || '' };
    });
    return monthly;
  }
  const monthly = {};
  Object.entries(QUARTER_MONTHS).forEach(([q, months]) => {
    const status = apiRow?.[`${q}_status`] || '';
    const date = apiRow?.[`${q}_date`] || '';
    months.forEach((mk) => {
      monthly[mk] = { status, date };
    });
  });
  FY_MONTH_KEYS.forEach((mk) => {
    if (!monthly[mk]) monthly[mk] = { status: '', date: '' };
  });
  return monthly;
}
