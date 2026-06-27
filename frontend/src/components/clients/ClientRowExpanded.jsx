import React, { useState } from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';

function fmt(val) {
  if (val === null || val === undefined) return '—';
  if (val === 0) return '₹0';
  const CR = 10000000, L = 100000;
  if (val / CR >= 1) return `₹${(val / CR).toFixed(2)} Cr`;
  return `₹${(val / L).toFixed(2)} L`;
}

function ChangeLog({ changes }) {
  if (!changes || changes.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Change History</p>
      <div className="space-y-1.5">
        {changes.map((c, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5 min-w-[100px]">{c.date}</span>
            <span className="text-slate-500">•</span>
            <span>
              <span className="font-medium capitalize">{c.field}</span>
              {' '}changed from{' '}
              <span className="font-tabular text-red-600">{fmt(c.from)}</span>
              {' '}→{' '}
              <span className="font-tabular text-emerald-600">{fmt(c.to)}</span>
              {c.note && <span className="text-muted-foreground ml-1">({c.note})</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClientRowExpanded({ client, actions, onAddAction, onDeleteAction }) {
  const [newAction, setNewAction] = useState({ description: '', deadline: '' });
  const clientActions = actions.filter(a => a.clientNum === client.num);

  function handleAdd() {
    if (!newAction.description.trim()) return;
    onAddAction({
      clientNum: client.num,
      clientName: client.name,
      description: newAction.description.trim(),
      deadline: newAction.deadline,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    });
    setNewAction({ description: '', deadline: '' });
  }

  return (
    <div className="px-6 py-4 space-y-5 bg-slate-50/70">
      {/* Change history */}
      {client.changes && client.changes.length > 0 && (
        <ChangeLog changes={client.changes} />
      )}

      {/* Action Points */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Action Points</p>

        {clientActions.length > 0 ? (
          <div className="space-y-1.5 mb-3">
            {clientActions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-white border border-border/60 rounded-lg px-3 py-2">
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
                <button onClick={() => onDeleteAction(a)} className="text-muted-foreground hover:text-red-500 transition-colors" title="Remove action">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic mb-3">No action points yet.</p>
        )}

        {/* Add new action */}
        <div className="flex items-center gap-2">
          <input
            className="flex-1 text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Add action point..."
            value={newAction.description}
            onChange={e => setNewAction(p => ({ ...p, description: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <input
            type="date"
            className="text-xs border border-border rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-ring w-32"
            value={newAction.deadline}
            onChange={e => setNewAction(p => ({ ...p, deadline: e.target.value }))}
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