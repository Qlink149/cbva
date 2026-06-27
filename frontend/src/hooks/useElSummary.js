import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/api/client';

const normalize = (s) => ({
  id: s.id,
  elSigned: s.el_signed,
  elNotSigned: s.el_not_signed,
  receivedTillApr: s.received_till_apr,
  receivedTillApr2026: s.received_till_apr_2026,
  receivedTillMay: s.received_till_may,
  receivedTillJun9: s.received_till_jun9,
  toReceiveMay: s.to_receive_may,
  toReceiveJune: s.to_receive_june,
  toReceiveJuly: s.to_receive_july,
  totalTillJune: s.total_till_june,
  pctCollected: s.pct_collected,
  amberElSigned: s.amber_el_signed,
  amberElNotSigned: s.amber_el_not_signed,
  amberReceived: s.amber_received,
});

export const useElSummary = (leaderId, fiscalYear) =>
  useQuery({
    queryKey: ['el-summary', leaderId, fiscalYear],
    queryFn: async () => {
      try {
        const res = await apiGet('/api/el-summary/', { leader_id: leaderId, fiscal_year: fiscalYear });
        return normalize(res);
      } catch (err) {
        if (err?.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: !!leaderId && !!fiscalYear,
    retry: (failCount, err) => err?.response?.status !== 404 && failCount < 2,
  });
