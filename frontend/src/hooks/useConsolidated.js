import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

/**
 * Consolidated summary — single API merges imported management sheet
 * with live engagement / pipeline / collection data.
 */
export function useConsolidated(selectedFy) {
  const query = useQuery({
    queryKey: ['consolidated-summary', selectedFy],
    queryFn: () => apiGet('/api/consolidated-summary', { fiscal_year: selectedFy }),
    enabled: !!selectedFy,
    staleTime: 60 * 1000,
  });

  const payload = query.data ?? {};
  return {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    columns: payload.columns ?? [],
    rows: payload.rows ?? [],
  };
}
