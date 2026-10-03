import { clearPageFilterSession } from '@/lib/pageFilterStorage';

export const GLOBAL_LEADER_KEY = 'cbva_global_leader';
export const GLOBAL_FY_KEY = 'cbva_global_fy';

export function clearGlobalSelectorSession() {
  try {
    sessionStorage.removeItem(GLOBAL_LEADER_KEY);
    sessionStorage.removeItem(GLOBAL_FY_KEY);
    clearPageFilterSession();
  } catch {
    // ignore
  }
}
