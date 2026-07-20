import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/api/client';

const normalize = (row) => ({
  ...row,
  blueSky: row.blue_sky,
});

export const usePipeline = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: ['pipeline', leaderId, fiscalYear],
    queryFn: async () => {
      const res = await apiGet('/api/pipeline', { leader_id: leaderId, fiscal_year: fiscalYear });
      return { ...res, data: (res.data ?? []).map(normalize) };
    },
    enabled: !!leaderId && !!fiscalYear,
    staleTime: 3 * 60 * 1000,
  });

/** Prior-year actuals for Monthly Plan Evolution (DB fy_actual rows). */
export const useFyActuals = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: ['fy-actuals', leaderId, fiscalYear],
    queryFn: async () => {
      const res = await apiGet('/api/pipeline/fy-actuals', {
        leader_id: leaderId,
        fiscal_year: fiscalYear,
      });
      return {
        ...res,
        data: (res.data ?? []).map(normalize),
      };
    },
    enabled: !!leaderId && !!fiscalYear,
    staleTime: 60 * 1000,
  });

export const useUpsertFyActual = (leaderId, viewingFy) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fiscalYear, green = 0, amber = 0, blueSky = 0 }) => {
      const g = Number(green) || 0;
      const a = Number(amber) || 0;
      const b = Number(blueSky) || 0;
      return apiPut('/api/pipeline/fy-actuals', {
        leader_id: leaderId,
        fiscal_year: fiscalYear,
        green: g,
        amber: a,
        blue_sky: b,
        total: g + a + b,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fy-actuals', leaderId, viewingFy] });
      qc.invalidateQueries({ queryKey: ['pipeline', leaderId, viewingFy] });
    },
  });
};
