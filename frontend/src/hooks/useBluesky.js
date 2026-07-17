import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/api/client';

export const blueskyKey = (leaderId, fiscalYear) => ['bluesky', leaderId, fiscalYear];

export const useBluesky = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: blueskyKey(leaderId, fiscalYear),
    queryFn: () => apiGet('/api/bluesky', { leader_id: leaderId, fiscal_year: fiscalYear }),
    enabled: !!leaderId && !!fiscalYear,
    staleTime: 3 * 60 * 1000,
  });

export const useUpdateBlueskyRemarks = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, remarks }) =>
      apiPut(`/api/bluesky/${entryId}`, { remarks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: blueskyKey(leaderId, fiscalYear) });
    },
  });
};
