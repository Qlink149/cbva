import React, { createContext, useContext, useState, useEffect } from 'react';
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

  const leaderList = Array.isArray(leaders) ? leaders : [];
  // For now only expose FY 2026-27 in the year dropdown
  const activeFiscalYears = (() => {
    const only2627 = fiscalYears.filter(fy => fy.slug === '2627');
    if (only2627.length) return only2627;
    return fiscalYears.filter(fy => fy.is_active !== false);
  })();

  const selectedLeaderId = selectedLeaderIdOverride
    ?? user?.leader_id
    ?? (user?.role !== 'user' && leaderList.length > 0 ? leaderList[0].id : null);

  useEffect(() => {
    if (!user) {
      setSelectedLeaderIdOverride(null);
    }
  }, [user]);

  useEffect(() => {
    if (!fiscalYears.length) return;
    const slugs = activeFiscalYears.map(fy => fy.slug);
    if (!activeFY || !slugs.includes(activeFY)) {
      setActiveFY(slugs.includes('2627') ? '2627' : (getCurrentFySlug(activeFiscalYears) ?? slugs[0]));
    }
  }, [fiscalYears, activeFiscalYears, activeFY]);

  const setSelectedLeaderId = (id) => {
    if (user?.role === 'user') return;
    setSelectedLeaderIdOverride(id);
  };

  return (
    <GlobalSelectorContext.Provider value={{
      selectedLeaderId,
      setSelectedLeaderId,
      activeFY,
      setActiveFY,
      fiscalYears: activeFiscalYears,
      activeFiscalYears: activeFiscalYears,
      fyLoading,
    }}>
      {children}
    </GlobalSelectorContext.Provider>
  );
}

export function useGlobalSelector() {
  const ctx = useContext(GlobalSelectorContext);
  if (!ctx) throw new Error('useGlobalSelector must be used within GlobalSelectorProvider');
  return ctx;
}
