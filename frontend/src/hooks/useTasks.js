import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/api/client';

const tasksKey = (leaderId, fiscalYear) => ['tasks', leaderId, fiscalYear ?? 'all'];

export const useTasks = (leaderId, fiscalYear) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: tasksKey(leaderId, fiscalYear),
    queryFn: () => apiGet('/api/tasks', { leader_id: leaderId, ...(fiscalYear ? { fiscal_year: fiscalYear } : {}) }),
    enabled: !!leaderId,
    select: (res) => res.data ?? res,
  });

  const createTask = useMutation({
    mutationFn: (body) => apiPost('/api/tasks', { ...body, leader_id: leaderId, ...(fiscalYear ? { fiscal_year: fiscalYear } : {}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(leaderId, fiscalYear) }),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/tasks/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(leaderId, fiscalYear) }),
  });

  const deleteTask = useMutation({
    mutationFn: (id) => apiDelete(`/api/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(leaderId, fiscalYear) }),
  });

  const patchTaskStatus = useMutation({
    mutationFn: ({ id, status }) => apiPatch(`/api/tasks/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(leaderId, fiscalYear) }),
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    createTask,
    updateTask,
    deleteTask,
    patchTaskStatus,
  };
};
