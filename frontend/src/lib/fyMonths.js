export const FY_MONTHS = [
  { key: '04', label: 'Apr', full: 'April' },
  { key: '05', label: 'May', full: 'May' },
  { key: '06', label: 'Jun', full: 'June' },
  { key: '07', label: 'Jul', full: 'July' },
  { key: '08', label: 'Aug', full: 'August' },
  { key: '09', label: 'Sep', full: 'September' },
  { key: '10', label: 'Oct', full: 'October' },
  { key: '11', label: 'Nov', full: 'November' },
  { key: '12', label: 'Dec', full: 'December' },
  { key: '01', label: 'Jan', full: 'January' },
  { key: '02', label: 'Feb', full: 'February' },
  { key: '03', label: 'Mar', full: 'March' },
];

export function parseFySlug(slug) {
  if (!slug || slug.length !== 4) return null;
  const startYear = 2000 + parseInt(slug.slice(0, 2), 10);
  const endYear = 2000 + parseInt(slug.slice(2, 4), 10);
  return { startYear, endYear };
}

export function getCurrentMonthKey(asOf = new Date()) {
  return String(asOf.getMonth() + 1).padStart(2, '0');
}

export function getCurrentFySlugFromDate(asOf = new Date()) {
  const year = asOf.getFullYear();
  const month = asOf.getMonth() + 1;
  if (month >= 4) {
    return `${String(year % 100).padStart(2, '0')}${String((year + 1) % 100).padStart(2, '0')}`;
  }
  return `${String((year - 1) % 100).padStart(2, '0')}${String(year % 100).padStart(2, '0')}`;
}

export function getFyMonthCalendarYear(monthKey, fySlug) {
  const parsed = parseFySlug(fySlug);
  if (!parsed) return null;
  const monthNum = parseInt(monthKey, 10);
  return monthNum >= 4 ? parsed.startYear : parsed.endYear;
}

/** True if this FY month has started (inclusive of current calendar month). */
export function isFyMonthElapsed(monthKey, fySlug, asOf = new Date()) {
  const calYear = getFyMonthCalendarYear(monthKey, fySlug);
  if (!calYear) return false;
  const monthNum = parseInt(monthKey, 10);
  const asOfYear = asOf.getFullYear();
  const asOfMonth = asOf.getMonth() + 1;
  if (calYear < asOfYear) return true;
  if (calYear > asOfYear) return false;
  return monthNum <= asOfMonth;
}

/** Months selectable in filters — current FY only shows elapsed months. */
export function getAvailableFyMonths(fySlug, fiscalYears = [], asOf = new Date()) {
  if (!fySlug) return FY_MONTHS;
  const registryCurrent = fiscalYears.find(fy => fy.is_current)?.slug;
  const currentSlug = registryCurrent || getCurrentFySlugFromDate(asOf);
  if (fySlug !== currentSlug) return FY_MONTHS;
  return FY_MONTHS.filter(m => isFyMonthElapsed(m.key, fySlug, asOf));
}

export function getFyMonthLabel(monthKey) {
  if (!monthKey) return 'Full Year';
  return FY_MONTHS.find(m => m.key === monthKey)?.full ?? monthKey;
}

export function monthValueMatches(monthValue, monthKey) {
  if (!monthKey || !monthValue) return false;
  const full = getFyMonthLabel(monthKey);
  const short = FY_MONTHS.find(m => m.key === monthKey)?.label ?? '';
  const normalized = String(monthValue).trim().toLowerCase();
  return (
    normalized === full.toLowerCase()
    || normalized === short.toLowerCase()
    || normalized.startsWith(full.toLowerCase())
    || normalized.includes(full.toLowerCase())
  );
}

// ---------------------------------------------------------------------------
// Planned vs Collected helpers (Engagement/Collections rework). FY month keys
// run Apr..Mar; dynamic across all years (mirrors backend fy_calendar).
// ---------------------------------------------------------------------------

export const FY_MONTH_KEYS = FY_MONTHS.map((m) => m.key);
export const MONTH_SHORT_NAMES = Object.fromEntries(FY_MONTHS.map((m) => [m.key, m.label]));
export const MONTH_FULL_NAMES = Object.fromEntries(FY_MONTHS.map((m) => [m.key, m.full]));

/** Short label with calendar year, e.g. ("06","2627") -> "Jun 2026". */
export function getFyMonthLabelYear(monthKey, fySlug) {
  const short = MONTH_SHORT_NAMES[monthKey] ?? monthKey;
  const year = getFyMonthCalendarYear(monthKey, fySlug);
  return year ? `${short} ${year}` : short;
}

/**
 * Default month for a selected FY: the current calendar month.
 * - When the current month falls inside the selected FY -> that month
 *   (e.g. July of FY 26-27 -> "07").
 * - Past FY (already ended) -> "03" (March, last month).
 * - Future FY (not started) -> "04" (April, first month).
 * Fully dynamic, no hardcoded years.
 */
export function getDefaultMonthKey(fySlug, now = new Date()) {
  if (!fySlug) return '04';
  const parsed = parseFySlug(fySlug);
  if (!parsed) return '04';
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1-12
  const curMonthKey = String(curMonth).padStart(2, '0');
  // Current calendar month falls within this FY -> default to it
  if (getFyMonthCalendarYear(curMonthKey, fySlug) === curYear) {
    return curMonthKey;
  }
  // FY already ended -> last month; otherwise (future) -> first month
  const isPast = curYear > parsed.endYear || (curYear === parsed.endYear && curMonth > 3);
  return isPast ? '03' : '04';
}
