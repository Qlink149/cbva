import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

export const useBaselines = (leaderId) =>
  useQuery({
    queryKey: ['baselines', leaderId],
    queryFn: () => apiGet('/api/baselines', leaderId ? { leader_id: leaderId } : {}),
    select: (res) => res.data ?? res,
  });
