import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/api/client';

const txKey = (leaderId, fiscalYear, month) =>
  ['collection-transactions', leaderId, fiscalYear, month ?? 'all'];

export const useCollectionTransactions = (leaderId, fiscalYear, month) =>
  useQuery({
    queryKey: txKey(leaderId, fiscalYear, month),
    queryFn: () =>
      apiGet('/api/collection-transactions', {
        leader_id: leaderId,
        fiscal_year: fiscalYear,
        ...(month ? { month } : {}),
      }),
    enabled: !!leaderId && !!fiscalYear,
    staleTime: 0,
    select: (res) => res.data ?? res,
  });

export const useAddTransaction = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPost('/api/collection-transactions', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection-transactions', leaderId, fiscalYear] });
      qc.invalidateQueries({ queryKey: ['collections', leaderId, fiscalYear] });
      qc.invalidateQueries({ queryKey: ['engagements', leaderId, fiscalYear] });
      qc.invalidateQueries({ queryKey: ['consolidated-summary', fiscalYear] });
    },
  });
};

export const useDeleteTransaction = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => apiDelete(`/api/collection-transactions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collection-transactions', leaderId, fiscalYear] });
      qc.invalidateQueries({ queryKey: ['collections', leaderId, fiscalYear] });
      qc.invalidateQueries({ queryKey: ['engagements', leaderId, fiscalYear] });
      qc.invalidateQueries({ queryKey: ['consolidated-summary', fiscalYear] });
    },
  });
};
