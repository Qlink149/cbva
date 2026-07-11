// Single source of truth for team designations and their hierarchy order.
// Ordered Articles-first (most junior) up to Managing Partner (most senior),
// with "Other" always last. Team members below a leader use TEAM_DESIGNATIONS;
// leaders form a separate tier (LEADER_DESIGNATIONS) shown above Senior Manager.

export const TEAM_DESIGNATIONS = [
  'Articles',
  'Analyst',
  'Associate',
  'Manager',
  'Senior Manager',
  'Other',
];

export const LEADER_DESIGNATIONS = [
  'Director',
  'Business Leader',
  'Partner',
  'Managing Partner',
];

// Full ascending hierarchy: Articles -> Senior Manager -> leadership tier -> Other.
export const DESIGNATION_ORDER = [
  'Articles',
  'Analyst',
  'Associate',
  'Manager',
  'Senior Manager',
  'Director',
  'Business Leader',
  'Partner',
  'Managing Partner',
  'Other',
];

// Rank used for sorting. Unknown / "Other" designations sort last.
export function designationRank(designation) {
  const idx = DESIGNATION_ORDER.indexOf(designation);
  return idx === -1 ? DESIGNATION_ORDER.length : idx;
}

// Comparator for Array.prototype.sort — accepts either a designation string
// or an object with a `designation` property.
export function sortByDesignation(a, b) {
  const da = typeof a === 'string' ? a : a?.designation;
  const db = typeof b === 'string' ? b : b?.designation;
  return designationRank(da) - designationRank(db);
}
