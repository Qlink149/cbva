import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api/client';

const teamKey = (leaderId, fiscalYear) => ['team', leaderId, fiscalYear];

export const useTeam = (leaderId, fiscalYear) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: teamKey(leaderId, fiscalYear),
    queryFn: () => apiGet('/api/team', { leader_id: leaderId, fiscal_year: fiscalYear }),
    enabled: !!leaderId && !!fiscalYear,
    select: (res) => res.data ?? res,
  });

  const addMember = useMutation({
    mutationFn: (body) =>
      apiPost('/api/team', { ...body, leader_id: leaderId, fiscal_year: fiscalYear }),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKey(leaderId, fiscalYear) }),
  });

  const updateMember = useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/team/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKey(leaderId, fiscalYear) }),
  });

  const deleteMember = useMutation({
    mutationFn: (id) => apiDelete(`/api/team/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKey(leaderId, fiscalYear) }),
  });

  return {
    teamMembers: query.data ?? [],
    isLoading: query.isLoading,
    addMember,
    updateMember,
    deleteMember,
  };
};
