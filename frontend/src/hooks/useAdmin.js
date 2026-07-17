import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api/client';

// ─── Users ────────────────────────────────────────────────────────────────────

export const useAdminUsers = () =>
  useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiGet('/api/admin/users'),
    select: (res) => res.data ?? res,
  });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPost('/api/admin/users', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/admin/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
};

export const useDeactivateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => apiDelete(`/api/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const useAppSettings = (options = {}) =>
  useQuery({
    queryKey: ['app-settings'],
    queryFn: () => apiGet('/api/admin/settings'),
    select: (res) => res.public_settings ?? res,
    ...options,
  });

export const useUpdateAppSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPut('/api/admin/settings', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-settings'] }),
  });
};

// ─── Master Data ──────────────────────────────────────────────────────────────

export const useAdminClients = () =>
  useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => apiGet('/api/admin/clients'),
    select: (res) => res.data ?? res,
  });

export const useCreateAdminClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPost('/api/admin/clients', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-clients'] }),
  });
};

export const useAdminEngagementTypes = () =>
  useQuery({
    queryKey: ['admin-engagement-types'],
    queryFn: () => apiGet('/api/admin/engagement-types'),
    select: (res) => res.data ?? res,
  });

export const useCreateEngagementType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPost('/api/admin/engagement-types', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-engagement-types'] }),
  });
};

export const useAdminFinancialYears = () =>
  useQuery({
    queryKey: ['admin-financial-years'],
    queryFn: () => apiGet('/api/admin/financial-years'),
    select: (res) => res.data ?? res,
  });

export const useCreateFinancialYear = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPost('/api/admin/financial-years', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-financial-years'] });
      qc.invalidateQueries({ queryKey: ['financial-years'] });
    },
  });
};

export const useUpdateFinancialYear = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/admin/financial-years/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-financial-years'] });
      qc.invalidateQueries({ queryKey: ['financial-years'] });
    },
  });
};

// ─── Initial / Board Plans ────────────────────────────────────────────────────

export const useAdminPlans = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: ['admin-plans', leaderId, fiscalYear],
    queryFn: () => apiGet('/api/admin/plans', { leader_id: leaderId, fiscal_year: fiscalYear }),
    enabled: !!leaderId && !!fiscalYear,
  });

export const useUpsertAdminPlans = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPut('/api/admin/plans', body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-plans', vars.leader_id, vars.fiscal_year] });
      qc.invalidateQueries({ queryKey: ['pipeline', vars.leader_id, vars.fiscal_year] });
    },
  });
};

// ─── Firmwide Dashboard ───────────────────────────────────────────────────────

export const useFirmwideDashboardAggregate = (fiscalYear) =>
  useQuery({
    queryKey: ['firmwide-dashboard', fiscalYear],
    queryFn: () => apiGet('/api/firmwide/dashboard-aggregate', { fiscal_year: fiscalYear }),
    enabled: !!fiscalYear,
  });
