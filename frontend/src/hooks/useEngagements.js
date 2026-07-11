import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/api/client';

const engKey = (leaderId, fiscalYear) => ['engagements', leaderId, fiscalYear];

const invalidateEngagementDerived = (qc, fiscalYear) => {
  if (fiscalYear) {
    qc.invalidateQueries({ queryKey: ['consolidated-summary', fiscalYear] });
    qc.invalidateQueries({ queryKey: ['pipeline'] });
    qc.invalidateQueries({ queryKey: ['collections'] });
  }
};

// Normalize API snake_case fields to camelCase so existing UI code doesn't need to change
const normalize = (e) => ({
  ...e,
  relPartner: e.rel_partner,
  manager: e.person_responsible ?? '',
  elStatus: e.el_status,
  blueSky: e.blue_sky,
  clientScope: e.client_scope ?? 'Domestic',
  remarksHistory: e.remarks_history ?? [],
  mayCol: e.may_col,
  juneCol: e.june_col,
  julyCol: e.july_col,
  monthlyPlan: e.monthly_plan ?? {},
});

// Convert camelCase UI field names back to snake_case for API calls
export const toApiFields = (obj) => {
  const { relPartner, manager, elStatus, blueSky, clientScope, mayCol, juneCol, julyCol, monthlyPlan, ...rest } = obj;
  const out = { ...rest };
  if (relPartner !== undefined) out.rel_partner = relPartner;
  if (manager !== undefined) out.person_responsible = manager;
  if (elStatus !== undefined) out.el_status = elStatus;
  if (blueSky !== undefined) out.blue_sky = blueSky;
  if (clientScope !== undefined) out.client_scope = clientScope;
  if (mayCol !== undefined) out.may_col = mayCol;
  if (juneCol !== undefined) out.june_col = juneCol;
  if (julyCol !== undefined) out.july_col = julyCol;
  if (monthlyPlan !== undefined) out.monthly_plan = monthlyPlan;
  return out;
};

export const useEngagements = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: engKey(leaderId, fiscalYear),
    queryFn: () => apiGet('/api/engagements', { leader_id: leaderId, fiscal_year: fiscalYear }),
    enabled: !!leaderId && !!fiscalYear,
    select: (res) => (res.data ?? res).map(normalize),
    staleTime: 3 * 60 * 1000,
  });

export const useCreateEngagement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPost('/api/engagements', toApiFields(body)),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: engKey(vars.leader_id, vars.fiscal_year) });
      invalidateEngagementDerived(qc, vars.fiscal_year);
    },
  });
};

export const useUpdateEngagement = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/engagements/${id}`, toApiFields(body)),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: engKey(leaderId, fiscalYear) });
      invalidateEngagementDerived(qc, fiscalYear);
      if (vars.id) {
        qc.invalidateQueries({ queryKey: ['engagement-changes', vars.id] });
      }
    },
  });
};

export const useDeleteEngagement = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => apiDelete(`/api/engagements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: engKey(leaderId, fiscalYear) });
      invalidateEngagementDerived(qc, fiscalYear);
    },
  });
};

export const useUpdateRemarks = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remarks, mode = 'edit' }) =>
      apiPatch(`/api/engagements/${id}/remarks`, { remarks, mode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: engKey(leaderId, fiscalYear) });
      invalidateEngagementDerived(qc, fiscalYear);
    },
  });
};
