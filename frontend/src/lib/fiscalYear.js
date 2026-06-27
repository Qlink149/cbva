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
