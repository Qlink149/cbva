import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

export const useLeaders = (options = {}) =>
  useQuery({
    queryKey: ['leaders'],
    queryFn: () => apiGet('/api/leaders'),
    staleTime: 5 * 60 * 1000,
    ...options,
  });

export const useLeader = (leaderId) =>
  useQuery({
    queryKey: ['leaders', leaderId],
    queryFn: () => apiGet(`/api/leaders/${leaderId}`),
    enabled: !!leaderId,
    staleTime: 5 * 60 * 1000,
  });
