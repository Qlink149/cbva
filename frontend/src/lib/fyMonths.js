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

