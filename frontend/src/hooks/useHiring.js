import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api/client';

const hiringKey = (leaderId, fiscalYear) => ['hiring', leaderId, fiscalYear];

export const useHiring = (leaderId, fiscalYear) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: hiringKey(leaderId, fiscalYear),
    queryFn: () => apiGet('/api/hiring', { leader_id: leaderId, fiscal_year: fiscalYear }),
    enabled: !!leaderId && !!fiscalYear,
    select: (res) => res.data ?? res,
  });

  const addHiring = useMutation({
    mutationFn: (body) =>
      apiPost('/api/hiring', { ...body, leader_id: leaderId, fiscal_year: fiscalYear }),
    onSuccess: () => qc.invalidateQueries({ queryKey: hiringKey(leaderId, fiscalYear) }),
  });

  const updateHiring = useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/hiring/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: hiringKey(leaderId, fiscalYear) }),
  });

  const deleteHiring = useMutation({
    mutationFn: (id) => apiDelete(`/api/hiring/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: hiringKey(leaderId, fiscalYear) }),
  });

  return {
    hiringReqs: query.data ?? [],
    isLoading: query.isLoading,
    addHiring,
    updateHiring,
    deleteHiring,
  };
};
