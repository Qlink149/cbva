import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/api/client';

const tasksKey = (leaderId) => ['tasks', leaderId];

export const useTasks = (leaderId) => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: tasksKey(leaderId),
    queryFn: () => apiGet('/api/tasks', { leader_id: leaderId }),
    enabled: !!leaderId,
    select: (res) => res.data ?? res,
  });

  const createTask = useMutation({
    mutationFn: (body) => apiPost('/api/tasks', { ...body, leader_id: leaderId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(leaderId) }),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/tasks/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(leaderId) }),
  });

  const deleteTask = useMutation({
    mutationFn: (id) => apiDelete(`/api/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(leaderId) }),
  });

  const patchTaskStatus = useMutation({
    mutationFn: ({ id, status }) => apiPatch(`/api/tasks/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(leaderId) }),
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
