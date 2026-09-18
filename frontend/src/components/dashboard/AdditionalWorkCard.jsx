import React, { useMemo, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { formatINRFull } from '@/lib/formatCurrency';
import { parseRupeeInput } from '@/lib/parseAmount';
import { useCreateAdditionalWork } from '@/hooks/useAdditionalWork';
import { toast } from 'sonner';

const MONTH_LABELS = {
  '04': 'Apr', '05': 'May', '06': 'Jun', '07': 'Jul',
  '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov',
  '12': 'Dec', '01': 'Jan', '02': 'Feb', '03': 'Mar',
};

export default function AdditionalWorkCard({
  rows = [],
  fyLabel = '',
  leaderId,
  fiscalYear,
  canEdit = false,
  isLoading = false,
}) {
  const createMutation = useCreateAdditionalWork(leaderId, fiscalYear);
  const [clientName, setClientName] = useState('');
  const [amountDraft, setAmountDraft] = useState('');
  const [monthKey, setMonthKey] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));

  const total = useMemo(() => rows.reduce((s, r) => s + (r.amount || 0), 0), [rows]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!canEdit) {
      toast.error('This fiscal year is locked for editing.');
      return;
    }
    const name = clientName.trim();
    const amount = parseRupeeInput(amountDraft);
    if (!name) {
      toast.error('Client name is required');
      return;
    }
    if (amount == null || amount < 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      await createMutation.mutateAsync({
        client_name: name,
        month_key: monthKey,
        amount,
        notes: '',
      });
      setClientName('');
      setAmountDraft('');
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to add additional work');
    }
  }

  if (isLoading) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 animate-pulse">
        <div className="h-4 w-40 bg-slate-200 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-8 bg-slate-200 rounded" />
          <div className="h-8 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-slate-400" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            Additional Work{fyLabel ? ` · ${fyLabel}` : ''}
          </p>
        </div>
        <span className="text-xs font-semibold font-tabular text-slate-600">{formatINRFull(total)}</span>
      </div>
      <p className="text-[10px] text-slate-400 mb-3">Separate from Blue Sky Additional.</p>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 italic mb-3">No additional work logged yet.</p>
      ) : (
        <ul className="space-y-1 max-h-40 overflow-y-auto mb-3">
          {rows.slice(0, 10).map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200/80 px-3 py-1.5"
            >
              <span className="text-xs font-medium text-slate-700 truncate">
                {r.client_name}
                <span className="text-slate-400 font-normal ml-1.5">
                  {MONTH_LABELS[r.month_key] || r.month_key}
                </span>
              </span>
              <span className="text-[10px] font-tabular text-slate-500 whitespace-nowrap">
                {formatINRFull(r.amount || 0)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-center pt-1 border-t border-slate-200/80">
          <input
            className="flex-1 min-w-[120px] text-xs border border-slate-200 rounded px-2 py-1.5 bg-white"
            placeholder="Client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
          <select
            className="text-xs border border-slate-200 rounded px-2 py-1.5 bg-white"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
          >
            {Object.entries(MONTH_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          <input
            className="w-24 text-xs border border-slate-200 rounded px-2 py-1.5 bg-white font-tabular"
            placeholder="Amount"
            value={amountDraft}
            onChange={(e) => setAmountDraft(e.target.value)}
          />
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="text-xs font-medium px-2.5 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
