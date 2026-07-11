import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/api/client';

export const useCollections = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: ['collections', leaderId, fiscalYear],
    queryFn: () => apiGet('/api/collections', { leader_id: leaderId, fiscal_year: fiscalYear }),
    enabled: !!leaderId && !!fiscalYear,
    staleTime: 0,
    refetchOnMount: 'always',
  });

/** Upsert planned target for a month (creates the collection_entries row if absent). */
export const useSetMonthlyPlan = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ monthKey, planned }) =>
      apiPost('/api/collections', {
        leader_id: leaderId,
        fiscal_year: fiscalYear,
        month_key: monthKey,
        planned,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections', leaderId, fiscalYear] }),
  });
};

/** Update planned, collected, and/or remarks on an existing collection_entries row. */
export const useUpdateCollectionEntry = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, planned, collected, remarks }) =>
      apiPut(`/api/collections/${entryId}`, {
        ...(planned  !== undefined ? { planned }   : {}),
        ...(collected !== undefined ? { collected } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections', leaderId, fiscalYear] }),
  });
};

/** Save month-level collection remarks (creates entry row if needed). */
export const useUpdateCollectionRemarks = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ row, remarks }) => {
      if (row.entry_id) {
        return apiPut(`/api/collections/${row.entry_id}`, { remarks });
      }
      return apiPost('/api/collections', {
        leader_id: leaderId,
        fiscal_year: fiscalYear,
        month_key: row.month_key,
        planned: row.planned || 0,
        remarks,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections', leaderId, fiscalYear] }),
  });
};
