import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/api/client';

const EMPTY = [];
const headcountKey = (leaderId, fiscalYear) => ['headcount', leaderId, fiscalYear];

export const useHeadcount = (leaderId, fiscalYear) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: headcountKey(leaderId, fiscalYear),
    queryFn: () => apiGet('/api/headcount', { leader_id: leaderId, fiscal_year: fiscalYear }),
    enabled: !!leaderId && !!fiscalYear,
    select: (res) => res.data ?? res,
  });

  const setApproved = useMutation({
    mutationFn: ({ designation, board_approved }) =>
      apiPost('/api/headcount', {
        leader_id: leaderId,
        fiscal_year: fiscalYear,
        designation,
        board_approved,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: headcountKey(leaderId, fiscalYear) }),
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
