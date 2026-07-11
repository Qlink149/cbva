import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/api/client';

const EMPTY = [];
const headcountKey = (leaderId) => ['headcount', leaderId];

export const useHeadcount = (leaderId) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: headcountKey(leaderId),
    queryFn: () => apiGet('/api/headcount', { leader_id: leaderId }),
    enabled: !!leaderId,
    select: (res) => res.data ?? res,
  });

  const setApproved = useMutation({
    mutationFn: ({ designation, board_approved }) =>
      apiPost('/api/headcount', { leader_id: leaderId, designation, board_approved }),
    onSuccess: () => qc.invalidateQueries({ queryKey: headcountKey(leaderId) }),
  });

  const plans = query.data ?? EMPTY;
  const approvedByDesignation = useMemo(
    () => plans.reduce((acc, p) => {
      acc[p.designation] = p.board_approved;
      return acc;
    }, {}),
    [plans]
  );

  return {
    plans,
    approvedByDesignation,
    isLoading: query.isLoading,
    setApproved,
  };
};
