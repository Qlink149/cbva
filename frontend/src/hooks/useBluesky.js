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

export const useUpdateBluesky = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, ...body }) => apiPut(`/api/bluesky/${entryId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: blueskyKey(leaderId, fiscalYear) });
      if (fiscalYear) {
        qc.invalidateQueries({ queryKey: ['consolidated-summary', fiscalYear] });
      }
    },
  });
};

/** @deprecated Prefer useUpdateBluesky */
export const useUpdateBlueskyRemarks = (leaderId, fiscalYear) => {
  const update = useUpdateBluesky(leaderId, fiscalYear);
  return {
    ...update,
    mutate: ({ entryId, remarks }) => update.mutate({ entryId, remarks }),
    mutateAsync: ({ entryId, remarks }) => update.mutateAsync({ entryId, remarks }),
  };
};
