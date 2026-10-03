import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut, apiPost } from '@/api/client';

export const blueskyKey = (leaderId, fiscalYear) => ['bluesky', leaderId, fiscalYear];

export const useBluesky = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: blueskyKey(leaderId, fiscalYear),
    queryFn: () => apiGet('/api/bluesky', { leader_id: leaderId, fiscal_year: fiscalYear }),
    enabled: !!leaderId && !!fiscalYear,
    staleTime: 3 * 60 * 1000,
  });

const invalidateBluesky = (qc, leaderId, fiscalYear) => {
  qc.invalidateQueries({ queryKey: blueskyKey(leaderId, fiscalYear) });
  if (fiscalYear) {
    qc.invalidateQueries({ queryKey: ['consolidated-summary', fiscalYear] });
  }
};

export const useUpdateBluesky = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, monthKey, ...body }) => {
      if (entryId) {
        return apiPut(`/api/bluesky/${entryId}`, body);
      }
      if (!monthKey || !leaderId || !fiscalYear) {
        return Promise.reject(new Error('monthKey required to create a Blue Sky row'));
      }
      return apiPost('/api/bluesky/', {
        leader_id: leaderId,
        fiscal_year: fiscalYear,
        month_key: monthKey,
        ...body,
      });
    },
    onSuccess: () => invalidateBluesky(qc, leaderId, fiscalYear),
  });
};

/** @deprecated Prefer useUpdateBluesky */
export const useUpdateBlueskyRemarks = (leaderId, fiscalYear) => {
  const update = useUpdateBluesky(leaderId, fiscalYear);
  return {
    ...update,
    mutate: ({ entryId, remarks, monthKey }) =>
      update.mutate({ entryId, monthKey, remarks }),
    mutateAsync: ({ entryId, remarks, monthKey }) =>
      update.mutateAsync({ entryId, monthKey, remarks }),
  };
};
