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

export function otherPersonOptions(allOptions = [], primaryOptions = []) {
  const primary = new Set(primaryOptions.map((p) => p.toLowerCase()));
  return normalizePersonOptions(allOptions.filter((name) => !primary.has(name.toLowerCase())));
}
