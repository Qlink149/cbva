/** Fiscal year label helpers — DB is source of truth via useFinancialYears. */

export function getFyLabel(slug, fiscalYears = []) {
  const match = fiscalYears.find(fy => fy.slug === slug);
  if (match?.label) return match.label.replace(/-/g, '–');
  if (!slug) return '';
  if (slug.length === 4) {
    const start = `20${slug.slice(0, 2)}`;
    const end = `20${slug.slice(2, 4)}`;
    return `FY ${start.slice(2)}–${end.slice(2)}`;
  }
  return slug;
}

export function getCurrentFySlug(fiscalYears = []) {
  const current = fiscalYears.find(fy => fy.is_current);
  if (current) return current.slug;
  return fiscalYears[0]?.slug ?? null;
}

/**
 * Return the bare year-range portion of a standard 4-char slug,
 * e.g. "2526" -> "25-26". Used to match labelled reference rows
 * (like "FY 25-26") without hardcoding specific years.
 */
export function getFyRange(slug) {
  if (!slug || slug.length !== 4) return null;
  return `${slug.slice(0, 2)}-${slug.slice(2, 4)}`;
}

/**
 * Resolve the fiscal year immediately preceding `slug`.
 * Prefers the DB-driven fiscal-year list (source of truth); falls back to
 * deriving from a standard 4-char slug (e.g. "2627" -> "2526") so it works
 * for any year without hardcoding.
 */
export function getPrevFySlug(slug, fiscalYears = []) {
  if (!slug) return null;

  const earlier = fiscalYears
    .map(fy => fy?.slug)
    .filter(Boolean)
    .filter(s => s < slug)
    .sort();
  if (earlier.length) return earlier[earlier.length - 1];

  if (slug.length === 4) {
    const start = Number(slug.slice(0, 2));
    const end = Number(slug.slice(2, 4));
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(start - 1)}${pad(end - 1)}`;
    }
  }
  return null;
}
