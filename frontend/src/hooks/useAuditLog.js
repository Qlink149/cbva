import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const auditLogKey = (params) => ['audit-log', params];

export const useAuditLog = (params, options = {}) =>
  useQuery({
    queryKey: auditLogKey(params),
    queryFn: () => apiGet('/api/audit-log', params),
    select: (res) => ({
      data: res?.data ?? [],
      total: res?.total ?? 0,
      skip: res?.skip ?? 0,
      limit: res?.limit ?? 50,
    }),
    staleTime: 30_000,
    ...options,
  });

export const useEntityHistory = (entityType, entityId, options = {}) =>
  useQuery({
    queryKey: ['audit-log-entity', entityType, entityId],
    queryFn: () => apiGet(`/api/audit-log/entity/${entityType}/${entityId}`),
    enabled: !!entityType && !!entityId,
    select: (res) => res?.data ?? [],
    staleTime: 30_000,
    ...options,
  });

export async function exportAuditLog(params) {
  const token = localStorage.getItem('access_token');
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const url = `${BASE_URL}/api/audit-log/export?${search.toString()}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'audit-log.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}
