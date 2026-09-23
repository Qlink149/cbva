import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api/client';
import { resolveMeetingMonthly, FY_MONTH_KEYS } from '@/lib/meetingMonths';

const normalize = (m) => {
  const monthly = resolveMeetingMonthly(m);
  return {
    id: m.id,
    client: m.client_name,
    frequency: m.meeting_frequency || 'Quarterly',
    monthly,
    remarks: m.notes || '',
    minutes: m.minutes || '',
    datesTillPeriod: m.dates_till_period || '',
    nextPeriod: m.next_period || '',
    responsiblePerson: m.responsible_person || '',
    activity: m.activity || '',
    sortOrder: m.sort_order ?? 0,
  };
};

const toApi = (fields) => {
  const out = {};
  if (fields.client != null) out.client_name = fields.client;
  if (fields.frequency != null) out.meeting_frequency = fields.frequency;
  if (fields.remarks != null) out.notes = fields.remarks;
  if (fields.minutes != null) out.minutes = fields.minutes;
  if (fields.monthly_status != null) out.monthly_status = fields.monthly_status;
  return out;
};

export const useClientMeetings = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: ['client-meetings', leaderId, fiscalYear],
    queryFn: async () => {
      const res = await apiGet('/api/client-meetings/', { leader_id: leaderId, fiscal_year: fiscalYear });
      return (res?.data ?? []).map(normalize);
    },
    enabled: !!leaderId && !!fiscalYear,
  });

export const useCreateClientMeeting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => apiPost('/api/client-meetings/', body),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['client-meetings', vars.leader_id, vars.fiscal_year] }),
  });
};

export const useUpdateClientMeeting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, leaderId, fiscalYear, ...fields }) =>
      apiPut(`/api/client-meetings/${id}`, toApi(fields)),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['client-meetings', vars.leaderId, vars.fiscalYear] }),
  });
};

export const useDeleteClientMeeting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => apiDelete(`/api/client-meetings/${id}`),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['client-meetings', vars.leaderId, vars.fiscalYear] }),
  });
};

export { FY_MONTH_KEYS };
