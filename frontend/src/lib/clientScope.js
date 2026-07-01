/** Leaders whose engagements include International / Domestic client scope. */
const LEADERS_WITH_CLIENT_SCOPE = new Set(['amol']);

export const CLIENT_SCOPE_VALUES = ['Domestic', 'International'];

export const CLIENT_SCOPE_LABELS = {
  Domestic: 'Domestic',
  International: 'Intl',
};

export function leaderHasClientScope(leaderId) {
  return LEADERS_WITH_CLIENT_SCOPE.has(leaderId);
}

export function clientScopeLabel(scope) {
  return CLIENT_SCOPE_LABELS[scope] || scope || 'Domestic';
}
