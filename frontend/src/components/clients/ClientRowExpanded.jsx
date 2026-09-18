import React, { useState } from 'react';
import { Plus, Trash2, Calendar, Pencil } from 'lucide-react';
import { formatIstDate } from '@/lib/datetime';
import { formatAuditValue } from '@/lib/formatAuditValue';
import { useFyEditAccess } from '@/hooks/useFyEditAccess';
import { useClientActions } from '@/lib/ClientActionsContext';
import { isActionOverdue } from '@/lib/isActionOverdue';
import { toast } from 'sonner';

const ACTION_STATUSES = ['Pending', 'In Progress', 'Completed', 'Abandoned'];

function statusClass(status) {
  const s = status === 'Done' ? 'Completed' : status;
  if (s === 'Completed') return 'bg-emerald-100 text-emerald-700';
  if (s === 'In Progress') return 'bg-blue-100 text-blue-700';
  if (s === 'Abandoned') return 'bg-muted text-muted-foreground';
  return 'bg-amber-100 text-amber-700';
}

function formatHistoryDate(iso) {
  if (!iso) return '';
  return formatIstDate(iso, 'd MMM yyyy');
}

function ChangeLog({ changes, loading }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Change History</p>
      {loading && (
        <p className="text-xs text-muted-foreground italic">Loading changes...</p>
      )}
      {!loading && (!changes || changes.length === 0) && (
        <p className="text-xs text-muted-foreground italic">No budget changes yet.</p>
      )}
      {!loading && changes && changes.length > 0 && (
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {changes.map((c, i) => (
            <div key={i} className="text-xs text-slate-600 leading-snug">
              <div className="text-[10px] text-muted-foreground mb-0.5">
                {c.date}
                {c.by ? ` · ${c.by}` : ''}
              </div>
              <div>
                <span className="font-medium capitalize">{c.field?.replace(/_/g, ' ')}</span>
                {' '}changed from{' '}
                <span className="font-tabular text-red-600 break-words">{formatAuditValue(c.from)}</span>
                {' '}→{' '}
                <span className="font-tabular text-emerald-600 break-words">{formatAuditValue(c.to)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RemarksSection({ client, onUpdateRemarks }) {
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [addDraft, setAddDraft] = useState('');

  const history = client.remarksHistory || [];

  function startEdit() {
    setEditDraft(client.remarks || '');
    setEditOpen(true);
    setAddOpen(false);
  }

  function startAdd() {
    setAddDraft('');
    setAddOpen(true);
    setEditOpen(false);
  }

  function saveEdit() {
    onUpdateRemarks(client.id, editDraft, 'edit');
    setEditOpen(false);
  }

  function saveAdd() {
    if (!addDraft.trim()) return;
    onUpdateRemarks(client.id, addDraft.trim(), 'add');
    setAddDraft('');
    setAddOpen(false);
  }

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Remarks</p>

      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Current</p>
      {editOpen ? (
        <div className="space-y-2 mb-3">
          <textarea
            autoFocus
            className="w-full text-xs border border-border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-cbva-navy min-h-[72px] resize-none bg-white"
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditOpen(false)} className="text-xs text-muted-foreground px-2 py-1">Cancel</button>
            <button type="button" onClick={saveEdit} className="text-xs bg-cbva-navy text-white px-3 py-1 rounded-md">Save</button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-border/60 rounded-lg px-3 py-2 text-xs text-foreground mb-2 min-h-[40px]">
          {client.remarks?.trim() ? client.remarks : <span className="text-muted-foreground italic">No remark yet.</span>}
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={startEdit}
          className="flex items-center gap-1 text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white hover:bg-muted/40 transition-colors"
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <button
          type="button"
          onClick={startAdd}
          className="flex items-center gap-1 text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white hover:bg-muted/40 transition-colors"
        >
          <Plus className="w-3 h-3" /> Add note
        </button>
      </div>

      {addOpen && (
        <div className="space-y-2 mb-3">
          <textarea
            autoFocus
            className="w-full text-xs border border-border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-cbva-navy min-h-[72px] resize-none bg-white"
            placeholder="New note (current remark will move to history)..."
            value={addDraft}
            onChange={(e) => setAddDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="text-xs text-muted-foreground px-2 py-1">Cancel</button>
            <button type="button" onClick={saveAdd} className="text-xs bg-cbva-navy text-white px-3 py-1 rounded-md">Save note</button>
          </div>
        </div>
      )}

      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">History</p>
      {history.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No prior remarks.</p>
      ) : (
        <ul className="space-y-1">
          {history.map((h, i) => (
            <li key={i} className="text-xs text-slate-600">
              · {formatHistoryDate(h.at)}{h.by ? ` — ${h.by}` : ''}: {h.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ClientRowExpanded({
  client,
  actions,
  changes,
  changesLoading,
  onAddAction,
  onDeleteAction,
  onUpdateRemarks,
}) {
  const [newAction, setNewAction] = useState({ description: '', deadline: '', remarks: '' });
  const [adding, setAdding] = useState(false);
  const { canEdit, lockedMessage } = useFyEditAccess();
  const ctx = useClientActions() || {};
  const { isAddingAction, updateActionStatus, updateAction } = ctx;
  const clientActions = actions.filter((a) => (
    (a.engagementId && client.id && String(a.engagementId) === String(client.id))
    || a.clientNum === client.num
  ));
  const busy = adding || isAddingAction;

  async function handleAdd() {
    if (!newAction.description.trim() || busy) return;
    if (!canEdit) {
      toast.error(lockedMessage);
      return;
    }
    setAdding(true);
    try {
      await onAddAction({
        clientNum: client.num,
        clientName: client.name,
        engagementId: client.id,
        description: newAction.description.trim(),
        deadline: newAction.deadline,
        remarks: newAction.remarks.trim(),
      });
      setNewAction({ description: '', deadline: '', remarks: '' });
    } catch {
      // toast is handled by the mutation
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="px-6 py-4 bg-slate-50/70">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-start">
        <ChangeLog changes={changes} loading={changesLoading} />

        <RemarksSection client={client} onUpdateRemarks={onUpdateRemarks} />

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Action Points</p>

          {clientActions.length > 0 ? (
            <div className="space-y-1.5 mb-3 max-h-56 overflow-y-auto">
              {clientActions.map((a) => {
                const overdue = isActionOverdue(a.deadline, a.status);
                return (
                  <div key={a.id} className="flex flex-col gap-1.5 text-xs bg-white border border-border/60 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <select
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase shrink-0 border-0 cursor-pointer disabled:cursor-default ${statusClass(a.status)}`}
                        value={a.status === 'Done' ? 'Completed' : (a.status || 'Pending')}
                        disabled={!canEdit || !updateActionStatus}
                        onChange={(e) => {
                          if (!canEdit) { toast.error(lockedMessage); return; }
                          updateActionStatus?.(a.id, e.target.value);
                        }}
                      >
                        {ACTION_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <span className="flex-1 text-slate-700 min-w-0 break-words">{a.description}</span>
                      {a.deadline && (
                        <span className={`flex items-center gap-1 text-[10px] shrink-0 ${overdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                          <Calendar className="w-3 h-3" />
                          {a.deadline}
                          {overdue ? ' · Overdue' : ''}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          if (!canEdit) { toast.error(lockedMessage); return; }
                          onDeleteAction(a.id);
                        }}
                        className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                        title="Remove action"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      className="w-full text-[11px] border border-border/50 rounded px-2 py-1 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
                      placeholder="Remarks…"
                      defaultValue={a.remarks || ''}
                      disabled={!canEdit || !updateAction}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (!canEdit || next === (a.remarks || '')) return;
                        updateAction?.(a.id, { remarks: next });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic mb-3">No action points yet.</p>
          )}

          <div className="space-y-2">
            <input
              className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Add action point..."
              value={newAction.description}
              onChange={(e) => setNewAction((p) => ({ ...p, description: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              disabled={busy || !canEdit}
            />
            <input
              className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Remarks (optional)"
              value={newAction.remarks}
              onChange={(e) => setNewAction((p) => ({ ...p, remarks: e.target.value }))}
              disabled={busy || !canEdit}
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="flex-1 text-xs border border-border rounded-full px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
                value={newAction.deadline}
                onChange={(e) => setNewAction((p) => ({ ...p, deadline: e.target.value }))}
                disabled={busy || !canEdit}
              />
              <button
                onClick={handleAdd}
                disabled={busy || !canEdit || !newAction.description.trim()}
                className="flex items-center gap-1 text-xs bg-cbva-navy text-white px-3 py-2 rounded-full hover:bg-cbva-navy/80 transition-colors shrink-0 disabled:opacity-50"
              >
                <Plus className="w-3 h-3" /> {busy ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
