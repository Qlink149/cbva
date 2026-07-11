import { hasAnyRelationshipPartner } from '@/lib/relationshipPartners';
import { plannedForMonth, collectedForMonth } from '@/lib/collectionsRollup';

export const EMPTY_FILTER = '__empty__';

export const DEFAULT_ENGAGEMENT_FILTERS = {
  name: '',
  manager: [],
  relPartner: [],
  elStatus: [],
  clientScope: [],
  remarks: '',
  financials: {
    green: { min: '', max: '' },
    amber: { min: '', max: '' },
    blueSky: { min: '', max: '' },
    total: { min: '', max: '' },
    collected: { min: '', max: '' },
    balance: { min: '', max: '' },
  },
  /** Per FY month: { planned, collected, variance } each { min, max } */
  monthly: {},
};

export function emptyMonthFilterRange() {
  return {
    planned: { min: '', max: '' },
    collected: { min: '', max: '' },
    variance: { min: '', max: '' },
  };
}

export function countActiveEngagementFilters(filters, selectedMonths = []) {
  let count = 0;
  if (filters.name?.trim()) count += 1;
  if (filters.remarks?.trim()) count += 1;
  count += (filters.manager?.length || 0);
  count += (filters.relPartner?.length || 0);
  count += (filters.elStatus?.length || 0);
  count += (filters.clientScope?.length || 0);
  Object.values(filters.financials || {}).forEach((r) => {
    if (r.min !== '' || r.max !== '') count += 1;
  });
  selectedMonths.forEach((mk) => {
    const mf = filters.monthly?.[mk];
    if (!mf) return;
    ['planned', 'collected', 'variance'].forEach((field) => {
      const r = mf[field];
      if (r?.min !== '' || r?.max !== '') count += 1;
    });
  });
  return count;
}

function matchesMulti(fieldValue, selected) {
  if (!selected?.length) return true;
  const normalized = (fieldValue || '').trim();
  const isEmpty = !normalized || normalized === '-';
  return selected.some((val) => {
    if (val === EMPTY_FILTER) return isEmpty;
    return normalized === val;
  });
}

function monthFieldValue(client, monthKey, field, txMap) {
  if (field === 'planned') return plannedForMonth(client, monthKey);
  if (field === 'collected') return collectedForMonth(txMap, client.id, monthKey);
  const planned = plannedForMonth(client, monthKey);
  const collected = collectedForMonth(txMap, client.id, monthKey);
  return collected - planned;
}

export function applyEngagementFilters(clients, filters, { txMap = {}, selectedMonths = [] } = {}) {
  let list = clients;

  if (filters.name?.trim()) {
    const q = filters.name.trim().toLowerCase();
    list = list.filter((c) => (c.name || '').toLowerCase().includes(q));
  }

  if (filters.manager?.length) {
    list = list.filter((c) => matchesMulti(c.manager, filters.manager));
  }

  if (filters.relPartner?.length) {
    list = list.filter((c) => {
      const partners = (c.relPartner || '').split(/[,;|]+/).map((p) => p.trim()).filter(Boolean);
      const isEmpty = partners.length === 0;
      if (filters.relPartner.includes(EMPTY_FILTER) && isEmpty) return true;
      return hasAnyRelationshipPartner(c.relPartner, filters.relPartner.filter((v) => v !== EMPTY_FILTER));
    });
  }

  if (filters.elStatus?.length) {
    list = list.filter((c) => matchesMulti(c.elStatus, filters.elStatus));
  }

  if (filters.clientScope?.length) {
    list = list.filter((c) => matchesMulti(c.clientScope || 'Domestic', filters.clientScope));
  }

  if (filters.remarks?.trim()) {
    const q = filters.remarks.trim().toLowerCase();
    list = list.filter((c) => (c.remarks || '').toLowerCase().includes(q));
  }

  Object.entries(filters.financials || {}).forEach(([key, range]) => {
    if (range.min !== '') list = list.filter((c) => (c[key] || 0) >= parseFloat(range.min));
    if (range.max !== '') list = list.filter((c) => (c[key] || 0) <= parseFloat(range.max));
  });

  selectedMonths.forEach((mk) => {
    const mf = filters.monthly?.[mk];
    if (!mf) return;
    ['planned', 'collected', 'variance'].forEach((field) => {
      const range = mf[field];
      if (!range || (range.min === '' && range.max === '')) return;
      list = list.filter((c) => {
        const val = monthFieldValue(c, mk, field, txMap);
        if (range.min !== '' && val < parseFloat(range.min)) return false;
        if (range.max !== '' && val > parseFloat(range.max)) return false;
        return true;
      });
    });
  });

  return list;
}

export function uniqueManagers(clients) {
  const values = new Set();
  clients.forEach((c) => {
    const m = (c.manager || '').trim();
    if (m && m !== '-') values.add(m);
  });
  return Array.from(values).sort();
}

export function toggleFilterList(current, value) {
  if (current.includes(value)) return current.filter((v) => v !== value);
  return [...current, value];
}

export function setFinancialFilter(setFilters, key, bound, value) {
  setFilters((prev) => ({
    ...prev,
    financials: {
      ...prev.financials,
      [key]: { ...prev.financials[key], [bound]: value },
    },
  }));
}

export function clearFinancialFilter(setFilters, key) {
  setFilters((prev) => ({
    ...prev,
    financials: {
      ...prev.financials,
      [key]: { min: '', max: '' },
    },
  }));
}

export function setMonthFinancialFilter(setFilters, monthKey, field, bound, value) {
  setFilters((prev) => ({
    ...prev,
    monthly: {
      ...prev.monthly,
      [monthKey]: {
        ...(prev.monthly?.[monthKey] || emptyMonthFilterRange()),
        [field]: {
          ...(prev.monthly?.[monthKey]?.[field] || { min: '', max: '' }),
          [bound]: value,
        },
      },
    },
  }));
}

export function clearMonthFinancialFilter(setFilters, monthKey, field) {
  setFilters((prev) => ({
    ...prev,
    monthly: {
      ...prev.monthly,
      [monthKey]: {
        ...(prev.monthly?.[monthKey] || emptyMonthFilterRange()),
        [field]: { min: '', max: '' },
      },
    },
  }));
}

/** Drop monthly filter entries for months no longer visible in the table. */
export function pruneMonthlyFilters(filters, selectedMonths) {
  const keep = new Set(selectedMonths);
  const next = {};
  Object.entries(filters.monthly || {}).forEach(([mk, val]) => {
    if (keep.has(mk)) next[mk] = val;
  });
  return { ...filters, monthly: next };
}
