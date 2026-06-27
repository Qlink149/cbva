import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api/client';

const hiringKey = (leaderId) => ['hiring', leaderId];

export const useHiring = (leaderId) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: hiringKey(leaderId),
    queryFn: () => apiGet('/api/hiring', { leader_id: leaderId }),
    enabled: !!leaderId,
    select: (res) => res.data ?? res,
  });

  const addHiring = useMutation({
    mutationFn: (body) => apiPost('/api/hiring', { ...body, leader_id: leaderId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: hiringKey(leaderId) }),
  });

  const updateHiring = useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/hiring/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: hiringKey(leaderId) }),
  });

  const deleteHiring = useMutation({
    mutationFn: (id) => apiDelete(`/api/hiring/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: hiringKey(leaderId) }),
  });

  return {
    hiringReqs: query.data ?? [],
    isLoading: query.isLoading,
    addHiring,
    updateHiring,
    deleteHiring,
  };
};
