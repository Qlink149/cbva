import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api/client';

const normalize = (m) => ({
  id: m.id,
  client: m.client_name,
  frequency: m.meeting_frequency || 'Quarterly',
  q1: m.q1_status || '',
  q2: m.q2_status || '',
  q3: m.q3_status || '',
  q4: m.q4_status || '',
  remarks: m.notes || '',
  datesTillPeriod: m.dates_till_period || '',
  nextPeriod: m.next_period || '',
  responsiblePerson: m.responsible_person || '',
  activity: m.activity || '',
  sortOrder: m.sort_order ?? 0,
});

const toApi = (fields) => {
  const out = {};
  if (fields.client != null) out.client_name = fields.client;
  if (fields.frequency != null) out.meeting_frequency = fields.frequency;
  if (fields.remarks != null) out.notes = fields.remarks;
  if (fields.q1 != null) out.q1_status = fields.q1;
  if (fields.q2 != null) out.q2_status = fields.q2;
  if (fields.q3 != null) out.q3_status = fields.q3;
  if (fields.q4 != null) out.q4_status = fields.q4;
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
