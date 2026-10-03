import React, { useMemo, useState } from 'react';
import { Plus, X, CheckCircle2 } from 'lucide-react';
import { FY_MONTHS, getCurrentMonthKey } from '@/lib/fyMonths';
import { useCreateManualEntry } from '@/hooks/useManualEntry';
import { useMonthEditAccess } from '@/hooks/useMonthEditAccess';
import { useFyEditAccess } from '@/hooks/useFyEditAccess';
import { toast } from 'sonner';

/**
 * Shared manual-entry toggle: Client name / Nature of work (free text) / Month.
 * Used identically on Engagements, Collections, and Meetings tabs.
 */
export default function ManualEntryToggle({
  leaderId,
  fiscalYear,
  entryType = 'additional_work',
  sourceTab,
  canEdit: canEditProp,
  label = 'Add entry',
}) {
  const { canEdit: fyCanEdit, lockedMessage } = useFyEditAccess();
  const { canEditMonth, monthLockedMessage } = useMonthEditAccess();
  const canEdit = canEditProp ?? fyCanEdit;

  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [natureOfWork, setNatureOfWork] = useState('');
  const [loggedMonth, setLoggedMonth] = useState(() => getCurrentMonthKey());
  const createMutation = useCreateManualEntry(leaderId, fiscalYear);
  const monthEditable = useMemo(() => canEditMonth(loggedMonth), [canEditMonth, loggedMonth]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canEdit) {
      toast.error(lockedMessage);
      return;
    }
    if (!monthEditable) {
      toast.error(monthLockedMessage);
      return;
    }
    const name = clientName.trim();
    const nature = natureOfWork.trim();
    if (!name) {
      toast.error('Client name is required');
      return;
    }
    if (!nature) {
      toast.error('Nature of work is required');
      return;
    }
    try {
      await createMutation.mutateAsync({
        entryType,
        sourceTab,
        client_name: name,
        nature_of_work: nature,
        logged_month: loggedMonth,
      });
      setClientName('');
      setNatureOfWork('');
      setOpen(false);
      toast.success('Entry added');
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to add entry');
    }
  }

  return (
    <div className="mb-4">
      {!open ? (
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-cbva-navy text-white hover:bg-cbva-navy/90 transition-colors font-medium disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> {label}
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Manual entry</p>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Client name *"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
          <input
            className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Nature of work *"
            value={natureOfWork}
            onChange={(e) => setNatureOfWork(e.target.value)}
          />
          <select
            className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none"
            value={loggedMonth}
            onChange={(e) => setLoggedMonth(e.target.value)}
          >
            {FY_MONTHS.map((m) => (
              <option key={m.key} value={m.key}>{m.full}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={createMutation.isPending || !monthEditable}
            className="flex items-center justify-center gap-1.5 w-full text-xs font-medium py-2 rounded-lg bg-cbva-navy text-white hover:bg-cbva-navy/90 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" /> Save entry
          </button>
        </form>
      )}
    </div>
  );
}
