import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useLeaders } from '@/hooks/useLeaders';
import { useFinancialYears } from '@/hooks/useFinancialYears';
import { getCurrentFySlug } from '@/lib/fiscalYear';
import { GLOBAL_LEADER_KEY, GLOBAL_FY_KEY } from '@/lib/globalSelectorStorage';

const GlobalSelectorContext = createContext(null);

export function GlobalSelectorProvider({ children }) {
  const { user } = useAuth();
  const { data: leaders = [] } = useLeaders({ enabled: user?.role !== 'user' });
  const { data: fiscalYears = [], isLoading: fyLoading } = useFinancialYears({ enabled: !!user });
  const [selectedLeaderIdOverride, setSelectedLeaderIdOverride] = useState(null);
  const [activeFY, setActiveFYState] = useState(null);
  const hydratedRef = useRef(false);

  const leaderList = useMemo(
    () => (Array.isArray(leaders) ? leaders : []),
    [leaders],
  );

  const activeFiscalYears = useMemo(
    () => fiscalYears.filter((fy) => fy.is_active !== false),
    [fiscalYears],
  );

  const selectedLeaderId = selectedLeaderIdOverride
    ?? user?.leader_id
    ?? (user?.role !== 'user' && leaderList.length > 0 ? leaderList[0].id : null);

  useEffect(() => {
    if (!user) {
      setSelectedLeaderIdOverride(null);
      hydratedRef.current = false;
      return;
    }
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      if (user.role !== 'user') {
        const storedLeader = sessionStorage.getItem(GLOBAL_LEADER_KEY);
        if (storedLeader) setSelectedLeaderIdOverride(storedLeader);
      }
      const storedFy = sessionStorage.getItem(GLOBAL_FY_KEY);
      if (storedFy) setActiveFYState(storedFy);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    if (!activeFiscalYears.length || !hydratedRef.current) return;
    const slugs = activeFiscalYears.map((fy) => fy.slug);
    if (!activeFY || !slugs.includes(activeFY)) {
      setActiveFYState(getCurrentFySlug(activeFiscalYears) ?? slugs[0]);
    }
  }, [activeFiscalYears, activeFY]);

  const setSelectedLeaderId = useCallback((id) => {
    if (user?.role === 'user') return;
    setSelectedLeaderIdOverride(id);
    try {
      if (id) sessionStorage.setItem(GLOBAL_LEADER_KEY, id);
      else sessionStorage.removeItem(GLOBAL_LEADER_KEY);
    } catch {
      // ignore
    }
  }, [user?.role]);

  const setActiveFY = useCallback((slug) => {
    setActiveFYState(slug);
    try {
      if (slug) sessionStorage.setItem(GLOBAL_FY_KEY, slug);
      else sessionStorage.removeItem(GLOBAL_FY_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({
    selectedLeaderId,
    setSelectedLeaderId,
    activeFY,
    setActiveFY,
    fiscalYears: activeFiscalYears,
    activeFiscalYears,
    fyLoading,
  }), [
    selectedLeaderId,
    setSelectedLeaderId,
    activeFY,
    activeFiscalYears,
    fyLoading,
  ]);

  return (
    <GlobalSelectorContext.Provider value={value}>
      {children}
    </GlobalSelectorContext.Provider>
  );
}

export function useGlobalSelector() {
  const ctx = useContext(GlobalSelectorContext);
  if (!ctx) throw new Error('useGlobalSelector must be used within GlobalSelectorProvider');
  return ctx;
}
