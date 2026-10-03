/**
 * Overdue = deadline calendar date is before today AND status is still open.
 * Closed statuses: Completed, Done (legacy), Abandoned, Closed (legacy).
 * Uses Asia/Kolkata for "today" to match firm timezone.
 */
const CLOSED_STATUSES = new Set(['Completed', 'Done', 'Abandoned', 'Closed']);
const IST = 'Asia/Kolkata';

function calendarDateIST(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
}

function todayIST() {
  return calendarDateIST(new Date());
}

export function isActionOverdue(deadline, status) {
  if (!deadline) return false;
  if (CLOSED_STATUSES.has(status)) return false;
  const due = calendarDateIST(deadline);
  const today = todayIST();
  if (!due || !today) return false;
  return due < today;
}
