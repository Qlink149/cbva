import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

export const useCollections = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: ['collections', leaderId, fiscalYear],
    queryFn: () => apiGet('/api/collections', { leader_id: leaderId, fiscal_year: fiscalYear }),
    enabled: !!leaderId && !!fiscalYear,
  });
