import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Plus, X, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useClientActions } from '@/lib/ClientActionsContext';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel } from '@/lib/fiscalYear';
import { getAvailableFyMonths, getFyMonthCalendarYear } from '@/lib/fyMonths';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';
import { useTasks } from '@/hooks/useTasks';
import { useFyEditAccess } from '@/hooks/useFyEditAccess';
import { toast } from 'sonner';
import { isActionOverdue } from '@/lib/isActionOverdue';
import ClientCombobox from '@/components/clients/ClientCombobox';
import { useLeaderFyScopedState } from '@/hooks/useLeaderFyScopedState';
import { PAGE_FILTER_SCOPES, isValidMonthKey } from '@/lib/pageFilterStorage';

const DEFAULT_ACTION_FILTERS = { status: '', engagement: '', month: '' };

const ACTION_STATUS_STYLES = {
  Pending: 'bg-slate-100 text-slate-500',
  'In Progress': 'bg-status-amber-bg text-status-amber',
  Completed: 'bg-status-green-bg text-status-green',
  Abandoned: 'bg-muted text-muted-foreground',
  Done: 'bg-status-green-bg text-status-green',
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

const ACTION_STATUSES = ['Pending', 'In Progress', 'Completed', 'Abandoned'];
const EMPTY_FORM = { title: '', assignee_name: '', client_name: '', priority: 'Medium', deadline: '', notes: '' };
const EMPTY_ACTION_FORM = { engagementId: '', description: '', deadline: '', remarks: '' };

export default function Actions({ user }) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddAction, setShowAddAction] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [actionForm, setActionForm] = useState(EMPTY_ACTION_FORM);
  const {
    clients = [],
    clientActions,
    addAction,
    updateActionStatus,
    updateAction,
    deleteAction,
    isAddingAction,
  } = useClientActions();
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();

  const [actionFilters, setActionFilters] = useLeaderFyScopedState(
    PAGE_FILTER_SCOPES.ACTIONS_FILTERS,
    () => DEFAULT_ACTION_FILTERS,
    {
      validate: (stored, { activeFY: fy, fallback }) => {
        const next = { ...fallback, ...(stored && typeof stored === 'object' ? stored : {}) };
        if (!isValidMonthKey(next.month, fy, fiscalYears)) next.month = '';
        return next;
      },
    },
  );
  const statusFilter = actionFilters.status;
  const engagementFilter = actionFilters.engagement;
  const monthFilter = actionFilters.month;

  const setStatusFilter = useCallback((value) => {
    setActionFilters((prev) => ({ ...prev, status: value }));
  }, [setActionFilters]);
  const setEngagementFilter = useCallback((value) => {
    setActionFilters((prev) => ({ ...prev, engagement: value }));
  }, [setActionFilters]);
  const setMonthFilter = useCallback((value) => {
    setActionFilters((prev) => ({ ...prev, month: value }));
  }, [setActionFilters]);

  useEffect(() => {
    if (!engagementFilter || clients.length === 0) return;
    const exists = clients.some((c) => String(c.id) === engagementFilter);
    if (!exists) setEngagementFilter('');
  }, [clients, engagementFilter, setEngagementFilter]);
  const { canEdit, lockedMessage } = useFyEditAccess();
  const fyLabel = getFyLabel(activeFY, fiscalYears);

  const { tasks, isLoading: tasksLoading, createTask, deleteTask } = useTasks(selectedLeaderId, activeFY);

  const availableMonths = useMemo(
    () => getAvailableFyMonths(activeFY, fiscalYears),
    [activeFY, fiscalYears],
  );

  const filteredActions = useMemo(() => {
    return clientActions.filter((a) => {
      if (statusFilter) {
        const s = a.status === 'Done' ? 'Completed' : a.status;
        if (s !== statusFilter) return false;
      }
      if (engagementFilter && String(a.engagementId) !== engagementFilter) return false;
      if (monthFilter) {
        const created = a.createdAt ? new Date(a.createdAt) : null;
        if (!created || Number.isNaN(created.getTime())) return false;
        const calYear = getFyMonthCalendarYear(monthFilter, activeFY);
        const monthNum = parseInt(monthFilter, 10);
        if (created.getFullYear() !== calYear || created.getMonth() + 1 !== monthNum) return false;
      }
      return true;
    });
  }, [clientActions, statusFilter, engagementFilter, monthFilter, activeFY]);

  const handleAddTask = () => {
    if (!form.title.trim()) return;
    createTask.mutate({ ...form, status: 'Pending' }, {
      onSuccess: () => {
        setShowAddTask(false);
        setForm(EMPTY_FORM);
      },
    });
  };

  const handleAddAction = async () => {
    if (!actionForm.description.trim() || !actionForm.engagementId) {
      toast.error('Select a client and enter an action.');
      return;
    }
    if (!canEdit) {
      toast.error(lockedMessage);
      return;
    }
    const client = clients.find((c) => String(c.id) === String(actionForm.engagementId));
    try {
      await addAction({
        engagementId: actionForm.engagementId,
        clientNum: client?.num,
        clientName: client?.name,
        description: actionForm.description.trim(),
        deadline: actionForm.deadline,
        remarks: actionForm.remarks.trim(),
      });
      setShowAddAction(false);
      setActionForm(EMPTY_ACTION_FORM);
    } catch {
      // toast from mutation
    }
  };

  if (tasksLoading) {
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
            Client action points & day-to-day tasks · {fyLabel} · {selectedLeaderId}
          </p>
        </div>
        <LeaderFYSelector />
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {fyLabel} is read-only. An admin can enable editing under Admin Settings → Financial Years.
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground">
            Action Points · {fyLabel} · {selectedLeaderId}
          </h2>
          <div className="flex items-center gap-2">
            <select
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background"
              value={engagementFilter}
              onChange={(e) => setEngagementFilter(e.target.value)}
              aria-label="Filter by engagement point"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
            <select
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Filter by month"
            >
              <option value="">All months</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>{m.full}</option>
              ))}
            </select>
            <select
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {ACTION_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!canEdit) { toast.error(lockedMessage); return; }
                setShowAddAction(!showAddAction);
              }}
              disabled={!canEdit}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> New Action Point
            </button>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          {showAddAction && (
            <div className="border-b border-border/60 p-4 bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-foreground">New Action Point</p>
                <button onClick={() => { setShowAddAction(false); setActionForm(EMPTY_ACTION_FORM); }}>
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              <ClientCombobox
                clients={clients}
                value={actionForm.engagementId}
                onChange={(id) => setActionForm((f) => ({ ...f, engagementId: id }))}
                disabled={!canEdit}
              />
              <textarea
                className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring mb-2 min-h-[64px] resize-none"
                placeholder="Action *"
                value={actionForm.description}
                onChange={(e) => setActionForm((f) => ({ ...f, description: e.target.value }))}
              />
              <input
                type="date"
                className="w-full text-xs border border-border rounded-lg px-2 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring mb-2"
                value={actionForm.deadline}
                onChange={(e) => setActionForm((f) => ({ ...f, deadline: e.target.value }))}
              />
              <input
                type="text"
                className="w-full text-xs border border-border rounded-lg px-2 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring mb-2"
                placeholder="Remarks (optional)"
                maxLength={500}
                value={actionForm.remarks}
                onChange={(e) => setActionForm((f) => ({ ...f, remarks: e.target.value }))}
              />
              <button
                onClick={handleAddAction}
                disabled={!actionForm.description.trim() || !actionForm.engagementId || isAddingAction}
                className="w-full text-xs font-medium bg-primary text-primary-foreground py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isAddingAction ? 'Adding...' : 'Add Action Point'}
              </button>
            </div>
          )}

          {filteredActions.length === 0 && !showAddAction ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {statusFilter
                  ? `No ${statusFilter} action points for ${selectedLeaderId}.`
                  : `No action points yet for ${selectedLeaderId}. Click "New Action Point" and pick a client, or add from Engagements.`}
              </p>
            </div>
          ) : filteredActions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Client</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Action</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Deadline</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Remarks</th>
                    <th className="py-3 px-4 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActions.map((a) => {
                    const overdue = isActionOverdue(a.deadline, a.status);
                    return (
                      <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 text-xs font-medium text-foreground">{a.clientName || '—'}</td>
                        <td className="py-3 px-4 text-xs text-slate-600">{a.description}</td>
                        <td className={`py-3 px-4 text-xs ${overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                          {a.deadline ? <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(a.deadline), 'dd MMM yyyy')}{overdue && ' (Overdue)'}</span> : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none ${ACTION_STATUS_STYLES[a.status] || 'bg-muted text-muted-foreground'}`}
                            value={a.status === 'Done' ? 'Completed' : a.status}
                            onChange={(e) => {
                              if (!canEdit) { toast.error(lockedMessage); return; }
                              updateActionStatus(a.id, e.target.value);
                            }}
                          >
                            {ACTION_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            disabled={!canEdit}
                            maxLength={500}
                            className="w-full min-w-[120px] text-xs border border-transparent hover:border-border rounded px-1.5 py-1 bg-transparent focus:outline-none focus:border-ring disabled:opacity-60"
                            defaultValue={a.remarks || ''}
                            key={`${a.id}-${a.remarks}`}
                            onBlur={(e) => {
                              const next = e.target.value.trim();
                              if (next !== (a.remarks || '').trim()) {
                                updateAction(a.id, { remarks: next });
                              }
                            }}
                            placeholder="—"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => {
                              if (!canEdit) { toast.error(lockedMessage); return; }
                              deleteAction(a.id);
                            }}
                            className="text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

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
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="text" className="text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Assignee name" value={form.assignee_name} onChange={(e) => setForm((f) => ({ ...f, assignee_name: e.target.value }))} />
                <select className="text-xs border border-border rounded-lg px-2 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                  {['Low', 'Medium', 'High', 'Urgent'].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="text" className="text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Client (optional)" value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} />
                <input type="date" className="text-xs border border-border rounded-lg px-2 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
              </div>
              <button onClick={handleAddTask} disabled={!form.title.trim() || createTask.isPending} className="w-full text-xs font-medium bg-primary text-primary-foreground py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {createTask.isPending ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          )}
          {tasks.filter((t) => t.status !== 'Done').length === 0 && !showAddTask ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-muted-foreground">No active tasks yet. Click &quot;New Task&quot; to add one.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {tasks.filter((t) => t.status !== 'Done').map((task) => {
                const overdue = isActionOverdue(task.deadline, task.status);
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
