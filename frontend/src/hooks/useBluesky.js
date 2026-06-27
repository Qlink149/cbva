import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

export const useBluesky = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: ['bluesky', leaderId, fiscalYear],
    queryFn: () => apiGet('/api/bluesky', { leader_id: leaderId, fiscal_year: fiscalYear }),
    enabled: !!leaderId && !!fiscalYear,
  });
