import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

export const useFirmwideSummary = (fiscalYear) =>
  useQuery({
    queryKey: ['firmwide-summary', fiscalYear],
    queryFn: () => apiGet('/api/firmwide/summary', { fiscal_year: fiscalYear }),
    enabled: !!fiscalYear,
    select: (res) => res.data ?? res,
  });

export const useFirmwideLeaders = (fiscalYear, month) =>
  useQuery({
    queryKey: ['firmwide-leaders', fiscalYear, month ?? 'all'],
    queryFn: () => {
      const params = { fiscal_year: fiscalYear };
      if (month) params.month = month;
      return apiGet('/api/firmwide/leaders', params);
    },
    enabled: !!fiscalYear,
    select: (res) => res.data ?? res,
    staleTime: 0,
  });

export const useFirmwideClients = (fiscalYear) =>
  useQuery({
    queryKey: ['firmwide-clients', fiscalYear],
    queryFn: () => apiGet('/api/firmwide/clients', { fiscal_year: fiscalYear }),
    enabled: !!fiscalYear,
  });

export const useFirmwideTeam = () =>
  useQuery({
    queryKey: ['firmwide-team'],
    queryFn: () => apiGet('/api/firmwide/team'),
    select: (res) => res.data ?? res,
  });
