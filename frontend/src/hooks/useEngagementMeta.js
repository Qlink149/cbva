import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete, apiPatch } from '@/api/client';
import { formatIstDate } from '@/lib/datetime';
import { toast } from 'sonner';

const changesKey = (engagementId) => ['engagement-changes', engagementId];
const actionsKey = (leaderId, fiscalYear, statusFilter) => [
  'engagement-actions',
  leaderId,
  fiscalYear,
  statusFilter || 'all',
];

export function apiErrorMessage(err) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const msg = detail.map((item) => item?.msg || item?.message || '').filter(Boolean).join('; ');
    if (msg) return msg;
  }
  return err?.message || 'Request failed';
}

function mapAction(a) {
  const status = a.status === 'Done' ? 'Completed' : a.status;
  return {
    id: a.id,
    engagementId: a.engagement_id,
    clientNum: a.engagement_num,
    clientName: a.client_name || '',
    description: a.description,
    deadline: a.deadline || '',
    remarks: a.remarks || '',
    status,
    createdAt: a.created_at,
  };
}

export function useEngagementChanges(engagementId, enabled = false) {
  return useQuery({
    queryKey: changesKey(engagementId),
    queryFn: () => apiGet(`/api/engagements/${engagementId}/changes`),
    enabled: !!engagementId && enabled,
    select: (res) => {
      const rows = res.data ?? res ?? [];
      return rows.map((c) => ({
        date: c.changed_at
          ? formatIstDate(c.changed_at, 'd MMM yyyy')
          : '',
        field: c.label || c.field,
        from: c.old_value,
        to: c.new_value,
        by: c.changed_by_name,
      }));
    },
    staleTime: 30 * 1000,
  });
}

export function useEngagementActions(leaderId, fiscalYear, statusFilter = '') {
  const qc = useQueryClient();
  const queryKey = actionsKey(leaderId, fiscalYear, statusFilter);

  const query = useQuery({
    queryKey,
    queryFn: () => apiGet('/api/engagement-actions/', {
      leader_id: leaderId,
      fiscal_year: fiscalYear,
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    enabled: !!leaderId && !!fiscalYear,
    select: (res) => (res.data ?? res ?? []).map(mapAction),
    staleTime: 60 * 1000,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['engagement-actions', leaderId, fiscalYear] });
  };

  const createAction = useMutation({
    mutationFn: (body) => apiPost('/api/engagement-actions/', body),
    onSuccess: () => {
      toast.success('Action point saved');
      invalidateAll();
    },
    onError: (err) => toast.error(apiErrorMessage(err) || 'Failed to add action point'),
  });

  const deleteAction = useMutation({
    mutationFn: (id) => apiDelete(`/api/engagement-actions/${id}`),
    onSuccess: () => {
      toast.success('Action point deleted');
      invalidateAll();
    },
    onError: (err) => toast.error(apiErrorMessage(err) || 'Failed to delete action point'),
  });

  const patchActionStatus = useMutation({
    mutationFn: ({ id, status }) => apiPatch(`/api/engagement-actions/${id}/status`, { status }),
    onSuccess: () => invalidateAll(),
    onError: (err) => toast.error(apiErrorMessage(err) || 'Failed to update status'),
  });

  const patchAction = useMutation({
    mutationFn: ({ id, ...body }) => apiPatch(`/api/engagement-actions/${id}`, body),
    onSuccess: () => invalidateAll(),
    onError: (err) => toast.error(apiErrorMessage(err) || 'Failed to update action'),
  });

  return {
    actions: query.data ?? [],
    isLoading: query.isLoading,
    createAction,
    deleteAction,
    patchActionStatus,
    patchAction,
  };
}
