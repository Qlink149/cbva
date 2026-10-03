import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api/client';

const layerParams = (layer, fiscalYear, leaderId) => ({
  layer,
  ...(layer !== 'all_time' ? { fiscal_year: fiscalYear } : {}),
  ...(layer === 'leader' ? { leader_id: leaderId } : {}),
});

export const useKraCategories = () =>
  useQuery({
    queryKey: ['kra-categories'],
    queryFn: () => apiGet('/api/kra/categories'),
    select: (res) => res.data ?? res,
  });

export const useKraCompetencies = (layer, fiscalYear, leaderId) =>
  useQuery({
    queryKey: ['kra-competencies', layer, fiscalYear, leaderId],
    queryFn: () => apiGet('/api/kra/competencies', layerParams(layer, fiscalYear, leaderId)),
    enabled: layer === 'all_time' || !!fiscalYear,
  });

export const useCreateCompetency = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPost('/api/kra/competencies', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kra-competencies'] }),
  });
};

export const useUpdateCompetency = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/kra/competencies/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kra-competencies'] }),
  });
};

export const useDeleteCompetency = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => apiDelete(`/api/kra/competencies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kra-competencies'] }),
  });
};

export const useKraKpis = (layer, fiscalYear, leaderId) =>
  useQuery({
    queryKey: ['kra-kpis', layer, fiscalYear, leaderId],
    queryFn: () => apiGet('/api/kra/kpis', layerParams(layer, fiscalYear, leaderId)),
    enabled: layer === 'all_time' || !!fiscalYear,
  });

export const useCreateKpi = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPost('/api/kra/kpis', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kra-kpis'] }),
  });
};

export const useUpdateKpi = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/kra/kpis/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kra-kpis'] }),
  });
};

export const useDeleteKpi = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => apiDelete(`/api/kra/kpis/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kra-kpis'] }),
  });
};

export const useKraWeights = (layer, fiscalYear, leaderId) =>
  useQuery({
    queryKey: ['kra-weights', layer, fiscalYear, leaderId],
    queryFn: () => apiGet('/api/kra/weights', layerParams(layer, fiscalYear, leaderId)),
    enabled: layer === 'all_time' || !!fiscalYear,
  });

export const useUpsertKraWeights = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPut('/api/kra/weights', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kra-weights'] }),
  });
};

export const useCopyKraLayer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPost('/api/kra/copy', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kra-kpis'] });
      qc.invalidateQueries({ queryKey: ['kra-weights'] });
      qc.invalidateQueries({ queryKey: ['kra-competencies'] });
      qc.invalidateQueries({ queryKey: ['kra-resolved'] });
    },
  });
};

export const useRemoveLeaderKra = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fiscal_year, leader_id }) =>
      apiDelete('/api/kra/copy', { fiscal_year, leader_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kra-kpis'] });
      qc.invalidateQueries({ queryKey: ['kra-weights'] });
      qc.invalidateQueries({ queryKey: ['kra-competencies'] });
      qc.invalidateQueries({ queryKey: ['kra-resolved'] });
    },
  });
};

export const useResolvedKra = (fiscalYear, leaderId) =>
  useQuery({
    queryKey: ['kra-resolved', fiscalYear, leaderId],
    queryFn: () => apiGet('/api/kra/resolved', { fiscal_year: fiscalYear, leader_id: leaderId }),
    enabled: !!fiscalYear,
  });
