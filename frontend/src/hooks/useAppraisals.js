import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/api/client';

export const useAppraisalRounds = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: ['appraisal-rounds', leaderId, fiscalYear],
    queryFn: () => apiGet('/api/appraisals/rounds', { leader_id: leaderId, fiscal_year: fiscalYear }),
    select: (res) => res.data ?? res,
    enabled: !!leaderId && !!fiscalYear,
  });

export const useAppraisalRound = (roundId) =>
  useQuery({
    queryKey: ['appraisal-round', roundId],
    queryFn: () => apiGet(`/api/appraisals/rounds/${roundId}`),
    enabled: !!roundId,
  });

export const useUpsertRoundRatings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roundId, ...body }) => apiPut(`/api/appraisals/rounds/${roundId}/ratings`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['appraisal-round', vars.roundId] });
      qc.invalidateQueries({ queryKey: ['appraisal-rounds'] });
      qc.invalidateQueries({ queryKey: ['appraisal-scorecard'] });
    },
  });
};

export const useSubmitRound = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roundId) => apiPost(`/api/appraisals/rounds/${roundId}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appraisal-round'] });
      qc.invalidateQueries({ queryKey: ['appraisal-rounds'] });
      qc.invalidateQueries({ queryKey: ['appraisal-scorecard'] });
    },
  });
};

export const useScorecard = (leaderId, fiscalYear, period) =>
  useQuery({
    queryKey: ['appraisal-scorecard', leaderId, fiscalYear, period],
    queryFn: () =>
      apiGet('/api/appraisals/scorecard', {
        leader_id: leaderId,
        fiscal_year: fiscalYear,
        period,
      }),
    enabled: !!leaderId && !!fiscalYear && !!period,
  });
