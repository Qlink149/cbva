export function firstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || '';
}

export function displayPersonName(value, mode = 'short') {
  const name = String(value || '').trim();
  if (!name) return '-';
  return mode === 'short' ? firstName(name) : name;
}

export function normalizePersonOptions(options = []) {
  return [...new Set(options.map((o) => String(o || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Merge option lists and ensure current value(s) appear. */
export function mergePersonOptions(...lists) {
  return normalizePersonOptions(
    lists.flatMap((list) => {
      if (Array.isArray(list)) return list;
      if (list == null || list === '') return [];
      return [list];
    }),
  );
}

export function otherPersonOptions(allOptions = [], primaryOptions = []) {
  const primary = new Set(primaryOptions.map((p) => p.toLowerCase()));
  return normalizePersonOptions(allOptions.filter((name) => !primary.has(name.toLowerCase())));
}

export function namesMatch(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}
