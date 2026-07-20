import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useLeaders } from '@/hooks/useLeaders';
import { useFinancialYears } from '@/hooks/useFinancialYears';
import { getCurrentFySlug } from '@/lib/fiscalYear';

const GlobalSelectorContext = createContext(null);

export function GlobalSelectorProvider({ children }) {
  const { user } = useAuth();
  const { data: leaders = [] } = useLeaders({ enabled: user?.role !== 'user' });
  const { data: fiscalYears = [], isLoading: fyLoading } = useFinancialYears({ enabled: !!user });
  const [selectedLeaderIdOverride, setSelectedLeaderIdOverride] = useState(null);
  const [activeFY, setActiveFY] = useState(null);

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
    }
  }, [user]);

  useEffect(() => {
    if (!activeFiscalYears.length) return;
    const slugs = activeFiscalYears.map((fy) => fy.slug);
    if (!activeFY || !slugs.includes(activeFY)) {
      setActiveFY(getCurrentFySlug(activeFiscalYears) ?? slugs[0]);
    }
  }, [activeFiscalYears, activeFY]);

  const setSelectedLeaderId = useCallback((id) => {
    if (user?.role === 'user') return;
    setSelectedLeaderIdOverride(id);
  }, [user?.role]);

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
