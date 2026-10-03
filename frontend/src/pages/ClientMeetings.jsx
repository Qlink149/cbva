import React, { useState } from 'react';
import { Plus, CheckCircle2, AlertCircle, Calendar, X, Ban, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { getFyLabel } from '@/lib/fiscalYear';
import { useLeader } from '@/hooks/useLeaders';
import {
  useClientMeetings,
  useCreateClientMeeting,
  useUpdateClientMeeting,
  useDeleteClientMeeting,
  FY_MONTH_KEYS,
} from '@/hooks/useClientMeetings';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';
import { useFyEditAccess } from '@/hooks/useFyEditAccess';
import { MEETING_QUARTER_GROUPS } from '@/lib/meetingMonths';
import { getFyMonthLabelYear } from '@/lib/fyMonths';
import { toast } from 'sonner';

const ROLLUP_DOT_STYLES = {
  Completed: 'bg-status-green',
  Overdue: 'bg-red-500',
  Planned: 'bg-cbva-navy',
  '': 'bg-muted-foreground/30',
};

const HDR_BG = '#F8FAFC';
const FREQ_OPTIONS = ['Monthly', 'Quarterly', 'Custom', 'Waiver'];
const STATUS_OPTIONS = ['Planned', 'Completed', 'Overdue'];

const STATUS_STYLES = {
  Planned: 'bg-blue-50 text-cbva-navy border border-cbva-navy/20',
  Completed: 'bg-status-green-bg text-status-green border border-status-green/20',
  Overdue: 'bg-red-50 text-red-600 border border-red-200',
  '': 'bg-muted text-muted-foreground',
};

function StatusCell({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const style = STATUS_STYLES[value] || STATUS_STYLES[''];
  if (disabled) {
    return (
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES['']} whitespace-nowrap`}>—</span>
    );
  }
  return (
    <div className="relative">
      <button type="button" className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${style} whitespace-nowrap`} onClick={() => setOpen((v) => !v)}>
        {value || '—'}
      </button>
      {open && (
        <div className="absolute z-30 left-0 top-6 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[110px]">
          {STATUS_OPTIONS.map((s) => (
            <button key={s} type="button" className="block w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors" onClick={() => { onChange(s); setOpen(false); }}>{s}</button>
          ))}
          <button type="button" className="block w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors" onClick={() => { onChange(''); setOpen(false); }}>Clear</button>
        </div>
      )}
    </div>
  );
}

export default function ClientMeetings() {
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();
  const { canEdit, lockedMessage } = useFyEditAccess();
  const fyLabel = getFyLabel(activeFY, fiscalYears);
  const { data: leader } = useLeader(selectedLeaderId);
  const { data: meetings = [], isLoading } = useClientMeetings(selectedLeaderId, activeFY);
  const createMeeting = useCreateClientMeeting();
  const updateMeeting = useUpdateClientMeeting();
  const deleteMeeting = useDeleteClientMeeting();

  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState({ client: '', frequency: 'Quarterly', remarks: '' });
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [collapsedQuarters, setCollapsedQuarters] = useState(
    () => new Set(MEETING_QUARTER_GROUPS.map((g) => g.key)),
  );

  const visibleMonthCols = MEETING_QUARTER_GROUPS.reduce(
    (sum, g) => sum + (collapsedQuarters.has(g.key) ? 1 : g.months.length),
    0,
  );
  const bodyColSpan = 2 + visibleMonthCols + 2;

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleQuarter(key) {
    setCollapsedQuarters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAllQuarters() {
    setCollapsedQuarters(new Set());
  }

  function collapseAllQuarters() {
    setCollapsedQuarters(new Set(MEETING_QUARTER_GROUPS.map((g) => g.key)));
  }

  function updateField(id, field, val) {
    if (!canEdit) {
      toast.error(lockedMessage);
      return;
    }
    updateMeeting.mutate({ id, leaderId: selectedLeaderId, fiscalYear: activeFY, [field]: val });
  }

  function updateMonthField(id, monthKey, patch) {
    if (!canEdit) {
      toast.error(lockedMessage);
      return;
    }
    updateMeeting.mutate({
      id,
      leaderId: selectedLeaderId,
      fiscalYear: activeFY,
      monthly_status: { [monthKey]: patch },
    });
  }

  function addRow() {
    if (!canEdit) {
      toast.error(lockedMessage);
      return;
    }
    if (!newRow.client.trim()) {
      toast.error('Client name is required.');
      return;
    }
    createMeeting.mutate({
      leader_id: selectedLeaderId,
      fiscal_year: activeFY,
      client_name: newRow.client,
      meeting_frequency: newRow.frequency,
      notes: newRow.remarks,
      monthly_status: {},
      sort_order: meetings.length + 1,
    }, {
      onSuccess: () => {
        setNewRow({ client: '', frequency: 'Quarterly', remarks: '' });
        setShowAdd(false);
        toast.success('Client meeting added');
      },
      onError: (err) => {
        toast.error(err?.response?.data?.detail || err?.message || 'Failed to add client meeting');
      },
    });
  }

  function removeRow(id) {
    if (!canEdit) {
      toast.error(lockedMessage);
      return;
    }
    deleteMeeting.mutate({ id, leaderId: selectedLeaderId, fiscalYear: activeFY });
  }

  const activeMeetings = meetings.filter((m) => m.frequency !== 'Waiver');
  const waived = meetings.filter((m) => m.frequency === 'Waiver').length;
  const allStatuses = activeMeetings.flatMap((m) => FY_MONTH_KEYS.map((mk) => m.monthly?.[mk]?.status || ''));
  const upcoming = allStatuses.filter((s) => s === 'Planned').length;
  const overdue = allStatuses.filter((s) => s === 'Overdue').length;
  const completed = allStatuses.filter((s) => s === 'Completed').length;

  if (isLoading) {
    return (
      <div className="space-y-6 pb-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Client Meetings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Meeting tracker · {fyLabel} · {leader?.name ?? '—'}
          </p>
        </div>
        <LeaderFYSelector />
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {fyLabel} is read-only. An admin can enable editing under Admin Settings → Financial Years.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border/60 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-cbva-navy" />
          </div>
          <div>
            <p className="text-2xl font-medium text-foreground">{upcoming}</p>
            <p className="text-[11px] text-muted-foreground">Planned</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-status-green-bg flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-status-green" />
          </div>
          <div>
            <p className="text-2xl font-medium text-foreground">{completed}</p>
            <p className="text-[11px] text-muted-foreground">Completed</p>
          </div>
        </div>
        <div className={`rounded-xl border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center gap-3 ${overdue > 0 ? 'bg-red-50 border-red-200' : 'bg-card border-border/60'}`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${overdue > 0 ? 'bg-red-100' : 'bg-muted'}`}>
            <AlertCircle className={`w-4 h-4 ${overdue > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className={`text-2xl font-medium ${overdue > 0 ? 'text-red-600' : 'text-foreground'}`}>{overdue}</p>
            <p className="text-[11px] text-muted-foreground">Overdue</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Ban className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-medium text-foreground">{waived}</p>
            <p className="text-[11px] text-muted-foreground">Waived</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-foreground">Meeting Schedule</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs">
              <button type="button" onClick={expandAllQuarters} className="px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Expand all</button>
              <span className="text-border">|</span>
              <button type="button" onClick={collapseAllQuarters} className="px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Collapse all</button>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!canEdit) {
                  toast.error(lockedMessage);
                  return;
                }
                setShowAdd(true);
              }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-cbva-navy text-white hover:bg-cbva-navy/90 transition-colors font-medium ${!canEdit ? 'opacity-50' : ''}`}
            >
              <Plus className="w-3.5 h-3.5" /> Add Client
            </button>
          </div>
        </div>
        {meetings.length === 0 && !showAdd ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No client meetings for {fyLabel}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate" style={{ minWidth: 1400, borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: HDR_BG, height: 36 }}>
                  <th rowSpan={2} className="sticky left-0 z-30 text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border" style={{ background: HDR_BG, minWidth: 180 }}>Client Name</th>
                  <th rowSpan={2} className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border" style={{ background: HDR_BG, minWidth: 100 }}>Frequency</th>
                  {MEETING_QUARTER_GROUPS.map((g) => {
                    const isCollapsed = collapsedQuarters.has(g.key);
                    return (
                      <th key={g.key} colSpan={isCollapsed ? 1 : g.months.length} className="text-center py-2 px-2 text-[11px] uppercase tracking-wider text-cbva-navy font-semibold border-l border-border/40" style={{ background: HDR_BG }}>
                        <button type="button" onClick={() => toggleQuarter(g.key)} className="inline-flex items-center gap-1 hover:text-cbva-navy/80 transition-colors">
                          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {g.label}
                        </button>
                      </th>
                    );
                  })}
                  <th rowSpan={2} className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border" style={{ background: HDR_BG, minWidth: 140 }}>Remarks</th>
                  <th rowSpan={2} className="border-b border-border w-8" style={{ background: HDR_BG }} />
                </tr>
                <tr className="[&>th]:border-b [&>th]:border-border" style={{ background: HDR_BG }}>
                  {MEETING_QUARTER_GROUPS.flatMap((g) => {
                    if (collapsedQuarters.has(g.key)) {
                      return [
                        <th key={g.key} className="text-center py-2 px-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-l border-border/40" style={{ background: HDR_BG, minWidth: 88 }}>
                          Status
                        </th>,
                      ];
                    }
                    return g.months.map((mk) => (
                      <th key={mk} className="text-center py-2 px-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-l border-border/40" style={{ background: HDR_BG, minWidth: 88 }}>
                        {getFyMonthLabelYear(mk, activeFY).split(' ')[0]}
                      </th>
                    ));
                  })}
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => {
                  const isWaived = m.frequency === 'Waiver';
                  const isExpanded = expandedIds.has(m.id);
                  return (
                    <React.Fragment key={m.id}>
                      <tr className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${isWaived ? 'bg-muted/20' : ''}`}>
                        <td className={`py-3 px-4 font-medium text-foreground text-xs sticky left-0 z-10 border-b border-border/40 ${isWaived ? 'bg-muted/40' : 'bg-card'}`}>
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => toggleExpand(m.id)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Meeting minutes">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                            <span className={`truncate ${isWaived ? 'text-muted-foreground' : ''}`}>{m.client}</span>
                            {isWaived && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60 whitespace-nowrap">Waived</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 border-b border-border/40">
                          <select disabled={!canEdit} className="text-xs border border-transparent hover:border-border rounded px-1.5 py-0.5 bg-transparent focus:outline-none focus:border-ring focus:bg-white transition-colors text-foreground disabled:opacity-60 disabled:cursor-not-allowed" value={m.frequency} onChange={(e) => updateField(m.id, 'frequency', e.target.value)}>
                            {FREQ_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                          </select>
                        </td>
                        {MEETING_QUARTER_GROUPS.flatMap((g) => {
                          if (collapsedQuarters.has(g.key)) {
                            const statuses = g.months.map((mk) => m.monthly?.[mk]?.status || '');
                            const completedCount = statuses.filter((s) => s === 'Completed').length;
                            const hasOverdue = statuses.some((s) => s === 'Overdue');
                            const countColor = isWaived
                              ? 'text-muted-foreground'
                              : hasOverdue
                                ? 'text-red-600'
                                : completedCount === g.months.length
                                  ? 'text-status-green'
                                  : 'text-muted-foreground';
                            return [
                              <td key={g.key} className={`py-2 px-1 text-center border-b border-border/40 border-l border-border/30 ${isWaived ? 'opacity-50' : ''}`}>
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex items-center gap-0.5">
                                    {statuses.map((s, i) => (
                                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${ROLLUP_DOT_STYLES[s] || ROLLUP_DOT_STYLES['']}`} />
                                    ))}
                                  </div>
                                  <span className={`text-[10px] font-medium ${countColor}`}>{completedCount}/{g.months.length}</span>
                                </div>
                              </td>,
                            ];
                          }
                          return g.months.map((mk) => {
                            const cell = m.monthly?.[mk] || { status: '', date: '' };
                            return (
                              <td key={mk} className={`py-2 px-1 text-center border-b border-border/40 border-l border-border/30 ${isWaived ? 'opacity-50' : ''}`}>
                                <div className="flex flex-col items-center gap-1">
                                  <input
                                    type="date"
                                    disabled={isWaived || !canEdit}
                                    className="text-[10px] border border-transparent hover:border-border rounded px-1 py-0.5 bg-transparent focus:outline-none focus:border-ring focus:bg-white transition-colors text-foreground disabled:cursor-not-allowed w-full max-w-[108px]"
                                    value={cell.date || ''}
                                    onChange={(e) => updateMonthField(m.id, mk, { date: e.target.value })}
                                  />
                                  <StatusCell
                                    value={cell.status}
                                    onChange={(v) => updateMonthField(m.id, mk, { status: v })}
                                    disabled={isWaived || !canEdit}
                                  />
                                </div>
                              </td>
                            );
                          });
                        })}
                        <td className="py-3 px-4 border-b border-border/40">
                          <input disabled={!canEdit} className="w-full text-xs border border-transparent hover:border-border rounded px-1.5 py-0.5 bg-transparent focus:outline-none focus:border-ring focus:bg-white transition-colors text-muted-foreground disabled:opacity-60" placeholder="Add remark..." maxLength={60} value={m.remarks} onChange={(e) => updateField(m.id, 'remarks', e.target.value)} />
                        </td>
                        <td className="py-3 px-3 border-b border-border/40">
                          {canEdit && (
                            <button type="button" onClick={() => removeRow(m.id)} className="text-muted-foreground hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border/50 bg-muted/10">
                          <td colSpan={bodyColSpan} className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              <FileText className="w-3.5 h-3.5 text-muted-foreground mt-1 shrink-0" />
                              <div className="flex-1">
                                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Meeting Minutes</label>
                                <textarea
                                  disabled={!canEdit}
                                  className="mt-1 w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] resize-y disabled:opacity-60"
                                  placeholder="Record meeting minutes, key decisions and action items..."
                                  defaultValue={m.minutes}
                                  onBlur={(e) => { if (canEdit && e.target.value !== m.minutes) updateField(m.id, 'minutes', e.target.value); }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {showAdd && (
                  <tr className="border-b border-border/50 bg-blue-50/30">
                    <td className="py-2 px-4 sticky left-0 bg-blue-50/30 z-10">
                      <input autoFocus className="w-full text-xs border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Client name *" value={newRow.client} onChange={(e) => setNewRow((r) => ({ ...r, client: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addRow(); if (e.key === 'Escape') setShowAdd(false); }} />
                    </td>
                    <td className="py-2 px-4">
                      <select className="text-xs border border-border rounded px-2 py-1 bg-white focus:outline-none" value={newRow.frequency} onChange={(e) => setNewRow((r) => ({ ...r, frequency: e.target.value }))}>
                        {FREQ_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </td>
                    {MEETING_QUARTER_GROUPS.flatMap((g) =>
                      collapsedQuarters.has(g.key)
                        ? [<td key={g.key} className="py-2 px-1 text-center text-xs text-muted-foreground border-l border-border/30">—</td>]
                        : g.months.map((mk) => (
                            <td key={mk} className="py-2 px-1 text-center text-xs text-muted-foreground border-l border-border/30">—</td>
                          )),
                    )}
                    <td className="py-2 px-4">
                      <input className="w-full text-xs border border-border rounded px-2 py-1 bg-white focus:outline-none" placeholder="Remarks..." maxLength={60} value={newRow.remarks} onChange={(e) => setNewRow((r) => ({ ...r, remarks: e.target.value }))} />
                    </td>
                    <td className="py-2 px-3 flex gap-1">
                      <button type="button" onClick={addRow} className="text-status-green hover:text-status-green/80 transition-colors"><CheckCircle2 className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
