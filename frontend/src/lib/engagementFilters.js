import { hasAnyRelationshipPartner } from '@/lib/relationshipPartners';

export const EMPTY_FILTER = '__empty__';

export const DEFAULT_ENGAGEMENT_FILTERS = {
  name: '',
  manager: [],
  relPartner: [],
  elStatus: [],
  remarks: '',
  financials: {
    green: { min: '', max: '' },
    amber: { min: '', max: '' },
    blueSky: { min: '', max: '' },
    total: { min: '', max: '' },
    collected: { min: '', max: '' },
    balance: { min: '', max: '' },
    mayCol: { min: '', max: '' },
    juneCol: { min: '', max: '' },
    julyCol: { min: '', max: '' },
  },
};

export function countActiveEngagementFilters(filters) {
  let count = 0;
  if (filters.name?.trim()) count += 1;
  if (filters.remarks?.trim()) count += 1;
  count += (filters.manager?.length || 0);
  count += (filters.relPartner?.length || 0);
  count += (filters.elStatus?.length || 0);
  Object.values(filters.financials || {}).forEach(r => {
    if (r.min !== '' || r.max !== '') count += 1;
  });
  return count;
}

function matchesMulti(fieldValue, selected) {
  if (!selected?.length) return true;
  const normalized = (fieldValue || '').trim();
  const isEmpty = !normalized || normalized === '-';
  return selected.some(val => {
    if (val === EMPTY_FILTER) return isEmpty;
    return normalized === val;
  });
}

export function applyEngagementFilters(clients, filters) {
  let list = clients;

  if (filters.name?.trim()) {
    const q = filters.name.trim().toLowerCase();
    list = list.filter(c => (c.name || '').toLowerCase().includes(q));
  }

  if (filters.manager?.length) {
    list = list.filter(c => matchesMulti(c.manager, filters.manager));
  }

  if (filters.relPartner?.length) {
    list = list.filter(c => {
      const partners = (c.relPartner || '').split(/[,;|]+/).map(p => p.trim()).filter(Boolean);
      const isEmpty = partners.length === 0;
      if (filters.relPartner.includes(EMPTY_FILTER) && isEmpty) return true;
      return hasAnyRelationshipPartner(c.relPartner, filters.relPartner.filter(v => v !== EMPTY_FILTER));
    });
  }

  if (filters.elStatus?.length) {
    list = list.filter(c => matchesMulti(c.elStatus, filters.elStatus));
  }

  if (filters.remarks?.trim()) {
    const q = filters.remarks.trim().toLowerCase();
    list = list.filter(c => (c.remarks || '').toLowerCase().includes(q));
  }

  Object.entries(filters.financials || {}).forEach(([key, range]) => {
    if (range.min !== '') list = list.filter(c => (c[key] || 0) >= parseFloat(range.min));
    if (range.max !== '') list = list.filter(c => (c[key] || 0) <= parseFloat(range.max));
  });

  return list;
}

export function uniqueManagers(clients) {
  const values = new Set();
  clients.forEach(c => {
    const m = (c.manager || '').trim();
    if (m && m !== '-') values.add(m);
  });
  return Array.from(values).sort();
}

export function toggleFilterList(current, value) {
  if (current.includes(value)) return current.filter(v => v !== value);
  return [...current, value];
}

export function setFinancialFilter(setFilters, key, bound, value) {
  setFilters(prev => ({
    ...prev,
    financials: {
      ...prev.financials,
      [key]: { ...prev.financials[key], [bound]: value },
    },
  }));
}

export function clearFinancialFilter(setFilters, key) {
  setFilters(prev => ({
    ...prev,
    financials: {
      ...prev.financials,
      [key]: { min: '', max: '' },
    },
  }));
}
