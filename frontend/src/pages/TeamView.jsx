import React, { useState } from 'react';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import LeaderFYSelector from '@/components/layout/LeaderFYSelector';
import { Skeleton } from '@/components/ui/skeleton';
import { formatINR } from '@/lib/formatCurrency';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TeamEntryDrawer from '@/components/team/TeamEntryDrawer';
import EditMemberDrawer from '@/components/team/EditMemberDrawer';
import HeadcountTable from '@/components/team/HeadcountTable';
import { useTeam } from '@/hooks/useTeam';
import { useHiring } from '@/hooks/useHiring';
import { useHeadcount } from '@/hooks/useHeadcount';
import { getFyLabel } from '@/lib/fiscalYear';
import { sortByDesignation } from '@/lib/designations';
import { useFyEditAccess } from '@/hooks/useFyEditAccess';
import { toast } from 'sonner';

function InitialsAvatar({ name, size = 'md' }) {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sizeClass} rounded-full bg-cbva-navy text-white flex items-center justify-center font-medium shrink-0`}>
      {initials}
    </div>
  );
}

const HIRING_STATUS_STYLES = {
  'Open': 'bg-status-blue-bg text-status-blue',
  'In Progress': 'bg-status-amber-bg text-status-amber',
  'Filled': 'bg-status-green-bg text-status-green',
  'On Hold': 'bg-muted text-muted-foreground',
};

function HiringRemarks({ req, onSave }) {
  const [value, setValue] = useState(req.remarks || '');

  React.useEffect(() => {
    setValue(req.remarks || '');
  }, [req.remarks]);

  const commit = () => {
    if ((value || '') !== (req.remarks || '')) {
      onSave({ id: req.id, remarks: value });
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground shrink-0">Remarks</label>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        placeholder="Recruitment stage, interview status, CV availability..."
        className="h-8 text-xs"
      />
    </div>
  );
}

export default function TeamView({ user }) {
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();
  const { canEdit, lockedMessage } = useFyEditAccess();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const { teamMembers, isLoading: teamLoading, addMember, updateMember, deleteMember } = useTeam(selectedLeaderId, activeFY);
  const { hiringReqs, isLoading: hiringLoading, addHiring, updateHiring, deleteHiring } = useHiring(selectedLeaderId, activeFY);
  const { approvedByDesignation, isLoading: headcountLoading } = useHeadcount(selectedLeaderId, activeFY);

  const currentHeadcount = teamMembers.length;
  const boardApproved = Object.values(approvedByDesignation).reduce((sum, v) => sum + (v || 0), 0);

  const fyLabel = getFyLabel(activeFY, fiscalYears);

  const isLoading = teamLoading || hiringLoading || headcountLoading;
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedLeaderId} · {fyLabel} · {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LeaderFYSelector />
          <Button
            onClick={() => canEdit ? setDrawerOpen(true) : toast.error(lockedMessage)}
            disabled={!canEdit}
            className="bg-cbva-navy hover:bg-cbva-navy/90"
          >
            <Plus className="w-4 h-4 mr-2" /> Add
          </Button>
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {fyLabel} is read-only. An admin can enable editing under Admin Settings → Financial Years.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground mb-1">Current Headcount</p>
          <p className="text-2xl font-medium text-foreground">{currentHeadcount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground mb-1">Board-Approved Headcount</p>
          <p className="text-2xl font-medium text-foreground">{boardApproved}</p>
        </div>
      </div>

      {/* Headcount Table */}
      <HeadcountTable
        teamMembers={teamMembers}
        leaderId={selectedLeaderId}
        fiscalYear={activeFY}
        fyLabel={fyLabel}
      />

      {/* Hiring Requirements */}
      {hiringReqs.length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h2 className="text-sm font-semibold text-foreground">Hiring Requirements</h2>
          </div>
          <div className="divide-y divide-border/50">
            {hiringReqs.map(h => (
              <div key={h.id} className="px-5 py-3 hover:bg-muted/20 transition-colors group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{h.role_title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {h.level}{h.expected_joining_date ? ` · Expected ${h.expected_joining_date}` : ''}
                      {h.expected_cost ? ` · ${formatINR(h.expected_cost)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${HIRING_STATUS_STYLES[h.status] || 'bg-muted text-muted-foreground'}`}>
                      {h.status}
                    </span>
                    <button
                      onClick={() => deleteHiring.mutate(h.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                      title="Delete requirement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <HiringRemarks req={h} onSave={(data) => updateHiring.mutate(data)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Member Cards */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Team Members</h2>
        {teamMembers.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border/60">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No team members yet. Click Add to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...teamMembers].sort(sortByDesignation).map(m => (
              <div key={m.id} className="bg-card rounded-xl border border-border/60 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] group">
                <div className="flex items-center gap-3 mb-3">
                  <InitialsAvatar name={m.full_name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground">{m.designation || '—'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      m.status === 'Active' ? 'bg-status-green-bg text-status-green' :
                      m.status === 'On Notice' ? 'bg-status-amber-bg text-status-amber' :
                      'bg-muted text-muted-foreground'
                    }`}>{m.status}</span>
                    <button
                      onClick={() => setEditingMember(m)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                      title="Edit member"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (window.confirm(`Remove ${m.full_name} from team?`)) deleteMember.mutate(m.id); }}
                      className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded-md hover:bg-muted opacity-0 group-hover:opacity-100"
                      title="Delete member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-xs border-t border-border pt-2">
                  {m.email && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium truncate ml-2">{m.email}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Annual Cost</span>
                    <span className="font-tabular font-medium">{m.annual_cost > 0 ? formatINR(m.annual_cost) : '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TeamEntryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        teamMembers={teamMembers}
        onSaveMember={(data) => addMember.mutate(data, { onSuccess: () => setDrawerOpen(false) })}
        onSaveHiring={(data) => addHiring.mutate(data, { onSuccess: () => setDrawerOpen(false) })}
        isSavingMember={addMember.isPending}
        isSavingHiring={addHiring.isPending}
      />

      <EditMemberDrawer
        member={editingMember}
        teamMembers={teamMembers}
        onClose={() => setEditingMember(null)}
        onSave={(data) => updateMember.mutate({ id: editingMember.id, ...data }, { onSuccess: () => setEditingMember(null) })}
        isSaving={updateMember.isPending}
      />
    </div>
  );
}
