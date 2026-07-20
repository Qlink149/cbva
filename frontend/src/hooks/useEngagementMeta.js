import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete, apiPatch } from '@/api/client';
import { formatIstDate } from '@/lib/datetime';

const changesKey = (engagementId) => ['engagement-changes', engagementId];
const actionsKey = (leaderId, fiscalYear) => ['engagement-actions', leaderId, fiscalYear];

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
        field: c.field,
        from: c.old_value,
        to: c.new_value,
        by: c.changed_by_name,
      }));
    },
    staleTime: 30 * 1000,
  });
}

export function useEngagementActions(leaderId, fiscalYear) {
  const qc = useQueryClient();
  const queryKey = actionsKey(leaderId, fiscalYear);

  const query = useQuery({
    queryKey,
    queryFn: () => apiGet('/api/engagement-actions', { leader_id: leaderId, fiscal_year: fiscalYear }),
    enabled: !!leaderId && !!fiscalYear,
    select: (res) => (res.data ?? res ?? []).map((a) => ({
      id: a.id,
      engagementId: a.engagement_id,
      clientNum: a.engagement_num,
      clientName: '',
      description: a.description,
      deadline: a.deadline || '',
      status: a.status,
      createdAt: a.created_at,
    })),
    staleTime: 60 * 1000,
  });

  const createAction = useMutation({
    mutationFn: (body) => apiPost('/api/engagement-actions', body),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const deleteAction = useMutation({
    mutationFn: (id) => apiDelete(`/api/engagement-actions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const patchActionStatus = useMutation({
    mutationFn: ({ id, status }) => apiPatch(`/api/engagement-actions/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    actions: query.data ?? [],
    isLoading: query.isLoading,
    createAction,
    deleteAction,
    patchActionStatus,
  };
}
