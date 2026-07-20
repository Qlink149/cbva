import React, { useState } from 'react';
import { Plus, Trash2, Calendar, Pencil } from 'lucide-react';
import { formatINRFull } from '@/lib/formatCurrency';
import { formatIstDate } from '@/lib/datetime';

function fmt(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string') return val;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') {
    if (val === 0) return '₹0';
    return formatINRFull(val);
  }
  return String(val);
}

function formatHistoryDate(iso) {
  if (!iso) return '';
  return formatIstDate(iso, 'd MMM yyyy');
}

function ChangeLog({ changes, loading }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Change History</p>
      {loading && (
        <p className="text-xs text-muted-foreground italic">Loading changes...</p>
      )}
      {!loading && (!changes || changes.length === 0) && (
        <p className="text-xs text-muted-foreground italic">No budget changes yet.</p>
      )}
      {!loading && changes && changes.length > 0 && (
        <div className="space-y-1.5">
          {changes.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5 min-w-[88px]">
                {c.date}
                {c.by ? ` · ${c.by}` : ''}
              </span>
              <span className="text-slate-500">•</span>
              <span>
                <span className="font-medium capitalize">{c.field?.replace(/_/g, ' ')}</span>
                {' '}changed from{' '}
                <span className="font-tabular text-red-600">{fmt(c.from)}</span>
                {' '}→{' '}
                <span className="font-tabular text-emerald-600">{fmt(c.to)}</span>
              </span>
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
    <div>
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
  const [newAction, setNewAction] = useState({ description: '', deadline: '' });
  const clientActions = actions.filter((a) => a.clientNum === client.num);

  function handleAdd() {
    if (!newAction.description.trim()) return;
    onAddAction({
      clientNum: client.num,
      clientName: client.name,
      engagementId: client.id,
      description: newAction.description.trim(),
      deadline: newAction.deadline,
    });
    setNewAction({ description: '', deadline: '' });
  }

  return (
    <div className="px-6 py-4 space-y-5 bg-slate-50/70">
      <ChangeLog changes={changes} loading={changesLoading} />

      <RemarksSection client={client} onUpdateRemarks={onUpdateRemarks} />

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Action Points</p>

        {clientActions.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {clientActions.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs bg-white border border-border/60 rounded-lg px-3 py-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                  a.status === 'Done' ? 'bg-emerald-100 text-emerald-700' :
                  a.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{a.status}</span>
                <span className="flex-1 text-slate-700">{a.description}</span>
                {a.deadline && (
                  <span className="flex items-center gap-1 text-muted-foreground text-[10px]">
                    <Calendar className="w-3 h-3" />
                    {a.deadline}
                  </span>
                )}
                <button onClick={() => onDeleteAction(a.id)} className="text-muted-foreground hover:text-red-500 transition-colors" title="Remove action">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic mb-3">No action points yet.</p>
        )}

        <div className="flex items-center gap-2">
          <input
            className="flex-1 text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Add action point..."
            value={newAction.description}
            onChange={(e) => setNewAction((p) => ({ ...p, description: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <input
            type="date"
            className="text-xs border border-border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-ring w-32"
            value={newAction.deadline}
            onChange={(e) => setNewAction((p) => ({ ...p, deadline: e.target.value }))}
          />
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 text-xs bg-cbva-navy text-white px-3 py-2 rounded-lg hover:bg-cbva-navy/80 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
