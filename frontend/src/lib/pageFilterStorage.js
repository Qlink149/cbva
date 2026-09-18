import { getAvailableFyMonths } from '@/lib/fyMonths';

export const PAGE_FILTER_SCOPES = {
  ENG_FILTERS: 'eng_filters',
  ENG_COLUMN_VISIBILITY: 'eng_column_visibility',
  NEW_CLIENTS_MONTH: 'new_clients_month',
  ACTIONS_FILTERS: 'actions_filters',
};

const PAGE_FILTER_PREFIXES = [
  'cbva_eng_filters_',
  'cbva_eng_column_visibility_',
  'cbva_new_clients_month_',
  'cbva_actions_filters_',
];

export function buildScopedKey(scope, leaderId, fy) {
  if (!scope || !leaderId || !fy) return null;
  return `cbva_${scope}_${leaderId}_${fy}`;
}

export function readScopedJson(key, fallback) {
  if (!key) return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeScopedJson(key, value) {
  if (!key) return;
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function removeScopedJson(key) {
  if (!key) return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function clearPageFilterSession() {
  try {
    const keys = Object.keys(sessionStorage).filter((key) =>
      PAGE_FILTER_PREFIXES.some((prefix) => key.startsWith(prefix)),
    );
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
}

export function isValidMonthKey(monthKey, fySlug, fiscalYears = []) {
  if (!monthKey) return true;
  const available = getAvailableFyMonths(fySlug, fiscalYears);
  return available.some((m) => m.key === monthKey);
}

export function isValidMonthKeys(monthKeys, fySlug, fiscalYears = []) {
  if (!Array.isArray(monthKeys) || monthKeys.length === 0) return false;
  const available = new Set(getAvailableFyMonths(fySlug, fiscalYears).map((m) => m.key));
  return monthKeys.every((mk) => available.has(mk));
}
