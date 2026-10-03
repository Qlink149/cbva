import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api/client';

const key = (leaderId, fiscalYear) => ['additional-work', leaderId, fiscalYear];

export const useAdditionalWork = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: key(leaderId, fiscalYear),
    queryFn: async () => {
      const res = await apiGet('/api/additional-work/', {
        leader_id: leaderId,
        fiscal_year: fiscalYear,
      });
      return res?.data ?? [];
    },
    enabled: !!leaderId && !!fiscalYear,
  });

export const useCreateAdditionalWork = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      apiPost('/api/additional-work/', {
        leader_id: leaderId,
        fiscal_year: fiscalYear,
        ...body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(leaderId, fiscalYear) }),
  });
};

export const useUpdateAdditionalWork = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/additional-work/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(leaderId, fiscalYear) }),
  });
};

export const useDeleteAdditionalWork = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => apiDelete(`/api/additional-work/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(leaderId, fiscalYear) }),
  });
};
