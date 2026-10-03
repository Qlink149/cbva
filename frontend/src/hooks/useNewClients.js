import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

export const useNewClients = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: ['new-clients', leaderId, fiscalYear],
    queryFn: async () => {
      const res = await apiGet('/api/new-clients/', {
        leader_id: leaderId,
        fiscal_year: fiscalYear,
      });
      return res?.data ?? [];
    },
    enabled: !!leaderId && !!fiscalYear,
  });
