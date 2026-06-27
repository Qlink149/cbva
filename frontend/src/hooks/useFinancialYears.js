import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

export const useFinancialYears = (options = {}) =>
  useQuery({
    queryKey: ['financial-years'],
    queryFn: async () => {
      const res = await apiGet('/api/financial-years/');
      return res?.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    ...options,
  });
