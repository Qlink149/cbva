import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/api/client';

const engKey = (leaderId, fiscalYear) => ['engagements', leaderId, fiscalYear];

const invalidateEngagementDerived = (qc, leaderId, fiscalYear) => {
  if (!fiscalYear) return;
  qc.invalidateQueries({ queryKey: ['consolidated-summary', fiscalYear] });
  if (leaderId) {
    qc.invalidateQueries({ queryKey: ['pipeline', leaderId, fiscalYear] });
    qc.invalidateQueries({ queryKey: ['collections', leaderId, fiscalYear] });
  }
};

const patchRawEngagement = (engagement, vars) => {
  const apiFields = toApiFields(vars);
  const next = { ...engagement, ...apiFields };
  if (apiFields.monthly_plan) {
    next.monthly_plan = { ...(engagement.monthly_plan || {}), ...apiFields.monthly_plan };
  }
  return next;
};

const patchEngagementsCache = (cached, vars) => {
  if (!cached) return cached;
  const patchList = (list) =>
    list.map((e) => (String(e.id) === String(vars.id) ? patchRawEngagement(e, vars) : e));

  if (Array.isArray(cached)) {
    return patchList(cached);
  }

  const body = cached.data ?? cached;
  if (Array.isArray(body)) {
    return patchList(body);
  }
  if (body?.data && Array.isArray(body.data)) {
    return {
      ...cached,
      data: {
        ...body,
        data: patchList(body.data),
      },
    };
  }
  return cached;
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
      invalidateEngagementDerived(qc, vars.leader_id, vars.fiscal_year);
    },
  });
};

export const useUpdateEngagement = (leaderId, fiscalYear) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/engagements/${id}`, toApiFields(body)),
    onMutate: async (vars) => {
      const key = engKey(leaderId, fiscalYear);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      if (previous) {
        qc.setQueryData(key, (old) => patchEngagementsCache(old, vars));
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(engKey(leaderId, fiscalYear), context.previous);
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: engKey(leaderId, fiscalYear) });
      invalidateEngagementDerived(qc, leaderId, fiscalYear);
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
      invalidateEngagementDerived(qc, leaderId, fiscalYear);
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
      invalidateEngagementDerived(qc, leaderId, fiscalYear);
    },
  });
};
