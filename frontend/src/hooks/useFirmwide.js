import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
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

export const useFirmwideClientsInfinite = (fiscalYear, { limit = 100 } = {}) =>
  useInfiniteQuery({
    queryKey: ['firmwide-clients-infinite', fiscalYear, limit],
    enabled: !!fiscalYear,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiGet('/api/firmwide/clients', {
        fiscal_year: fiscalYear,
        skip: pageParam,
        limit,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const total = lastPage?.total;
      const loaded = allPages.reduce((acc, p) => acc + (p?.data?.length ?? 0), 0);

      if (typeof total !== 'number') return undefined;
      if (loaded >= total) return undefined;
      return loaded;
    },
  });

export const useFirmwideTeam = (fiscalYear) =>
  useQuery({
    queryKey: ['firmwide-team', fiscalYear],
    queryFn: () => apiGet('/api/firmwide/team', fiscalYear ? { fiscal_year: fiscalYear } : undefined),
    select: (res) => res.data ?? res,
  });
