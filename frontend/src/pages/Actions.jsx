import React, { useState } from 'react';
import { Plus, X, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { isPast, isToday, format } from 'date-fns';
import { useClientActions } from '@/lib/ClientActionsContext';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel } from '@/lib/fiscalYear';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';
import { useActions, useCreateAction, usePatchActionStatus } from '@/hooks/useActions';
import { useTasks } from '@/hooks/useTasks';
import { useFyEditAccess } from '@/hooks/useFyEditAccess';
import { toast } from 'sonner';

const STATUS_STYLES = {
  'In-Progress': 'bg-status-amber-bg text-status-amber',
  'Not Started': 'bg-slate-100 text-slate-500',
  'Closed': 'bg-status-green-bg text-status-green',
};

const TASK_STATUS_STYLES = {
  Pending: 'bg-slate-100 text-slate-500',
  'In Progress': 'bg-status-amber-bg text-status-amber',
  Done: 'bg-status-green-bg text-status-green',
};

const PRIORITY_STYLES = {
  Low: 'bg-slate-100 text-slate-500',
  Medium: 'bg-blue-50 text-blue-600',
  High: 'bg-amber-50 text-amber-600',
  Urgent: 'bg-red-50 text-red-600',
};

const EMPTY_FORM = { title: '', assignee_name: '', client_name: '', priority: 'Medium', deadline: '', notes: '' };
const EMPTY_ACTION_FORM = {
  category: '',
  description: '',
  status: 'Not Started',
  notes: '',
  due_date: '',
};

export default function Actions({ user }) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddAction, setShowAddAction] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [actionForm, setActionForm] = useState(EMPTY_ACTION_FORM);
  const { clientActions, updateActionStatus, deleteAction } = useClientActions();
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();
  const { canEdit, lockedMessage } = useFyEditAccess();
  const fyLabel = getFyLabel(activeFY, fiscalYears);

  const { data: leaderActions = [], isLoading: actionsLoading } = useActions(selectedLeaderId, activeFY);
  const createAction = useCreateAction(selectedLeaderId, activeFY);
  const patchActionStatus = usePatchActionStatus(selectedLeaderId, activeFY);

  const { tasks, isLoading: tasksLoading, createTask, deleteTask } = useTasks(selectedLeaderId, activeFY);

  const handleAddTask = () => {
    if (!form.title.trim()) return;
    createTask.mutate({ ...form, status: 'Pending' }, {
      onSuccess: () => {
        setShowAddTask(false);
        setForm(EMPTY_FORM);
      },
    });
  };

  const handleAddAction = () => {
    if (!actionForm.description.trim() || !selectedLeaderId || !activeFY) return;
    createAction.mutate(
      {
        leader_id: selectedLeaderId,
        fiscal_year: activeFY,
        category: actionForm.category.trim(),
        description: actionForm.description.trim(),
        status: actionForm.status,
        notes: actionForm.notes.trim(),
        due_date: actionForm.due_date || null,
      },
      {
        onSuccess: () => {
          setShowAddAction(false);
          setActionForm(EMPTY_ACTION_FORM);
        },
      }
    );
  };

  const isLoading = actionsLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Actions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Key actions & business plan tasks · {fyLabel} · {selectedLeaderId}
          </p>
        </div>
        <LeaderFYSelector />
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {fyLabel} is read-only. An admin can enable editing under Admin Settings → Financial Years.
        </div>
      )}

      {/* Key Actions Table */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground">
            Key Actions — Business Plan {fyLabel} · {selectedLeaderId}
          </h2>
          <button
            onClick={() => {
              if (!canEdit) { toast.error(lockedMessage); return; }
              setShowAddAction(!showAddAction);
            }}
            disabled={!canEdit}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> New Key Action
          </button>
        </div>

        <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          {showAddAction && (
            <div className="border-b border-border/60 p-4 bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-foreground">New Key Action</p>
                <button onClick={() => { setShowAddAction(false); setActionForm(EMPTY_ACTION_FORM); }}>
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <input
                  className="text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Category (e.g. Growth, Talent)"
                  value={actionForm.category}
                  onChange={(e) => setActionForm((f) => ({ ...f, category: e.target.value }))}
                />
                <select
                  className="text-xs border border-border rounded-lg px-2 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={actionForm.status}
                  onChange={(e) => setActionForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In-Progress">In-Progress</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <textarea
                className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring mb-2 min-h-[64px] resize-none"
                placeholder="Description *"
                value={actionForm.description}
                onChange={(e) => setActionForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <input
                  type="date"
                  className="text-xs border border-border rounded-lg px-2 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={actionForm.due_date}
                  onChange={(e) => setActionForm((f) => ({ ...f, due_date: e.target.value }))}
                />
                <input
                  className="text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Remarks (optional)"
                  value={actionForm.notes}
                  onChange={(e) => setActionForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <button
                onClick={handleAddAction}
                disabled={!actionForm.description.trim() || createAction.isPending}
                className="w-full text-xs font-medium bg-primary text-primary-foreground py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {createAction.isPending ? 'Adding...' : 'Add Key Action'}
              </button>
            </div>
          )}

          {leaderActions.length === 0 && !showAddAction ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No key actions yet for {selectedLeaderId}. Click &quot;New Key Action&quot; to add one.
              </p>
            </div>
          ) : leaderActions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium w-8 col-num">#</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Category</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Description</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-remarks">Remarks</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderActions.map((item) => (
                    <tr key={item.id ?? item.num} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 text-muted-foreground text-xs col-num">{item.num}</td>
                      <td className="py-3 px-4 font-medium text-foreground text-xs">{item.category}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs max-w-xs">{item.description}</td>
                      <td className="py-3 px-4">
                        <select
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none ${STATUS_STYLES[item.status] || 'bg-muted text-muted-foreground'}`}
                          value={item.status}
                          onChange={(e) => patchActionStatus.mutate({ id: item.id, status: e.target.value })}
                        >
                          <option value="In-Progress">In-Progress</option>
                          <option value="Not Started">Not Started</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground col-remarks">{item.notes || '—'}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{item.due_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {/* Client Action Points — persisted per engagement */}
      {clientActions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Client Action Points</h2>
          <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Client</th>
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Action</th>
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Deadline</th>
                  <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                  <th className="py-3 px-4 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {clientActions.map((a) => {
                  const overdue = a.deadline && isPast(new Date(a.deadline)) && !isToday(new Date(a.deadline)) && a.status !== 'Done';
                  return (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 text-xs font-medium text-foreground">{a.clientName}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{a.description}</td>
                      <td className={`py-3 px-4 text-xs ${overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                        {a.deadline ? <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(a.deadline), 'dd MMM yyyy')}{overdue && ' (Overdue)'}</span> : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none ${TASK_STATUS_STYLES[a.status] || 'bg-muted text-muted-foreground'}`}
                          value={a.status}
                          onChange={e => updateActionStatus(a.id, e.target.value)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Done">Done</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <button onClick={() => deleteAction(a.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Day-to-Day Tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Day-to-Day Tasks</h2>
          <button
            onClick={() => {
              if (!canEdit) { toast.error(lockedMessage); return; }
              setShowAddTask(!showAddTask);
            }}
            disabled={!canEdit}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
        </div>
        <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          {showAddTask && (
            <div className="border-b border-border/60 p-4 bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-foreground">New Task</p>
                <button onClick={() => { setShowAddTask(false); setForm(EMPTY_FORM); }}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
              </div>
              <input
                className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring mb-2"
                placeholder="Task title *"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="text" className="text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Assignee name" value={form.assignee_name} onChange={e => setForm(f => ({ ...f, assignee_name: e.target.value }))} />
                <select className="text-xs border border-border rounded-lg px-2 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="text" className="text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Client (optional)" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
                <input type="date" className="text-xs border border-border rounded-lg px-2 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <button onClick={handleAddTask} disabled={!form.title.trim() || createTask.isPending} className="w-full text-xs font-medium bg-primary text-primary-foreground py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {createTask.isPending ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          )}
          {tasks.filter(t => t.status !== 'Done').length === 0 && !showAddTask ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-muted-foreground">No active tasks yet. Click "New Task" to add one.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {tasks.filter(t => t.status !== 'Done').map(task => {
                const overdue = task.deadline && isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'Done';
                return (
                  <div key={task.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{task.title}</p>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority] || 'bg-muted text-muted-foreground'}`}>{task.priority}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${TASK_STATUS_STYLES[task.status]}`}>{task.status}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {task.assignee_name && <span className="text-[10px] text-muted-foreground">→ {task.assignee_name}</span>}
                        {task.client_name && <span className="text-[10px] text-muted-foreground">· {task.client_name}</span>}
                        {task.deadline && <span className={`text-[10px] ${overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>{overdue ? 'Overdue: ' : ''}{format(new Date(task.deadline), 'dd MMM')}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask.mutate(task.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 mt-1"
                      title="Delete task"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
