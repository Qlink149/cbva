import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api/client';

const teamKey = (leaderId) => ['team', leaderId];

export const useTeam = (leaderId) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: teamKey(leaderId),
    queryFn: () => apiGet('/api/team', { leader_id: leaderId }),
    enabled: !!leaderId,
    select: (res) => res.data ?? res,
  });

  const addMember = useMutation({
    mutationFn: (body) => apiPost('/api/team', { ...body, leader_id: leaderId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKey(leaderId) }),
  });

  const updateMember = useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/team/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKey(leaderId) }),
  });

  const deleteMember = useMutation({
    mutationFn: (id) => apiDelete(`/api/team/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKey(leaderId) }),
  });

  return {
    teamMembers: query.data ?? [],
    isLoading: query.isLoading,
    addMember,
    updateMember,
    deleteMember,
  };
};
