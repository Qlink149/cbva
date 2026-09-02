// Single source of truth for team designations and their hierarchy order.
// Ordered Articles-first (most junior) up to Managing Partner (most senior),
// with "Other" always last. Team members below a leader use TEAM_DESIGNATIONS;
// leaders form a separate tier (LEADER_DESIGNATIONS) shown above Senior Manager.

export const TEAM_DESIGNATIONS = [
  'Articles',
  'Associate',
  'Executive',
  'Senior Executive',
  'Assistant Manager',
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

// Full ascending hierarchy from live CBVA data (see docs/AUDIT_2026-08.md addendum A.6).
export const DESIGNATION_ORDER = [
  'Articles',
  'Associate',
  'Executive',
  'Senior Executive',
  'Assistant Manager',
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

/** Names of team members at Assistant Manager and above (T3 manager filter). */
export function seniorTeamNames(members = []) {
  const cutoff = designationRank('Assistant Manager');
  return members
    .filter((m) => designationRank(m?.designation) >= cutoff)
    .map((m) => m.full_name);
}

/**
 * Picker for the leader currently in the FY selector (Manager and Rel. Partner).
 * That leader's AM+ team, plus the leader. Not firmwide, not other leaders,
 * not free-text names already stored on engagements.
 */
export function leaderScopedManagerOptions(teamMembers = [], leaderName = '') {
  const names = seniorTeamNames(teamMembers);
  const leader = String(leaderName || '').trim();
  if (leader && !names.some((n) => n.toLowerCase() === leader.toLowerCase())) {
    names.push(leader);
  }
  return [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

// Comparator for Array.prototype.sort — accepts either a designation string
// or an object with a `designation` property.
export function sortByDesignation(a, b) {
  const da = typeof a === 'string' ? a : a?.designation;
  const db = typeof b === 'string' ? b : b?.designation;
  return designationRank(da) - designationRank(db);
}
