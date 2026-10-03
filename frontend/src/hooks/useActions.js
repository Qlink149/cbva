import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiPatch } from '@/api/client';

const actionsKey = (leaderId, fiscalYear) => ['actions', leaderId, fiscalYear];

export const useActions = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: actionsKey(leaderId, fiscalYear),
    queryFn: () => apiGet('/api/actions', { leader_id: leaderId, fiscal_year: fiscalYear }),
    enabled: !!leaderId && !!fiscalYear,
    select: (res) => res.data ?? res,
  });

export const useCreateAction = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPost('/api/actions/', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: actionsKey(leaderId, fiscalYear) }),
  });
};

export const useUpdateAction = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/actions/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: actionsKey(leaderId, fiscalYear) }),
  });
};

export const usePatchActionStatus = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => apiPatch(`/api/actions/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: actionsKey(leaderId, fiscalYear) }),
  });
};
