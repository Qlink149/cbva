import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/api/client';

const additionalWorkKey = (leaderId, fiscalYear) => ['additional-work', leaderId, fiscalYear];
const newClientsKey = (leaderId, fiscalYear) => ['new-clients', leaderId, fiscalYear];

export function useCreateManualEntry(leaderId, fiscalYear) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryType, sourceTab, client_name, nature_of_work, logged_month }) => {
      const payload = {
        leader_id: leaderId,
        fiscal_year: fiscalYear,
        client_name,
        nature_of_work,
        logged_month,
        entry_type: entryType,
        source_tab: sourceTab,
        amount: 0,
        notes: '',
      };
      if (entryType === 'new_client') {
        return apiPost('/api/new-clients/', payload);
      }
      return apiPost('/api/additional-work/', payload);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: additionalWorkKey(leaderId, fiscalYear) });
      if (vars.entryType === 'new_client') {
        qc.invalidateQueries({ queryKey: newClientsKey(leaderId, fiscalYear) });
      }
    },
  });
}
