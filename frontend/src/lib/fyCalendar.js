import { parseFySlug } from '@/lib/fyMonths';

const FY_MONTH_KEYS = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03'];

export function getFyMonthCalendarYear(monthKey, fySlug) {
  const parsed = parseFySlug(fySlug);
  if (!parsed) return null;
  const monthNum = parseInt(monthKey, 10);
  return monthNum >= 4 ? parsed.startYear : parsed.endYear;
}

/** First calendar date when month_key becomes locked (20th of following month). */
export function getMonthLockDate(fiscalYear, monthKey) {
  const calYear = getFyMonthCalendarYear(monthKey, fiscalYear);
  if (!calYear || !FY_MONTH_KEYS.includes(monthKey)) return null;
  const monthNum = parseInt(monthKey, 10);
  if (monthNum === 12) {
    return new Date(calYear + 1, 0, 20);
  }
  return new Date(calYear, monthNum, 20);
}

/** Mirrors backend is_month_locked — admins bypass via isAdmin flag. */
export function isMonthLocked(fiscalYear, monthKey, { isAdmin = false, asOf = new Date() } = {}) {
  if (isAdmin) return false;
  const lockDate = getMonthLockDate(fiscalYear, monthKey);
  if (!lockDate) return false;
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  return today >= lockDate;
}
