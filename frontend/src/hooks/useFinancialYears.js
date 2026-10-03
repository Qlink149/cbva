import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

export const useFinancialYears = (options = {}) =>
  useQuery({
    queryKey: ['financial-years'],
    queryFn: async () => {
      const res = await apiGet('/api/financial-years/');
      return res?.data ?? [];
    },
    // Must stay fresh — Admin "Editable" toggles unlock creates across the app
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    ...options,
  });
