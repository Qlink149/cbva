import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

const normalize = (row) => ({
  ...row,
  blueSky: row.blue_sky,
});

export const usePipeline = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: ['pipeline', leaderId, fiscalYear],
    queryFn: async () => {
      const res = await apiGet('/api/pipeline', { leader_id: leaderId, fiscal_year: fiscalYear });
      return { ...res, data: (res.data ?? []).map(normalize) };
    },
    enabled: !!leaderId && !!fiscalYear,
  });
