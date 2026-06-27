import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost, apiPut } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, User, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirmwideTeam } from '@/hooks/useFirmwide';
import { useLeaders } from '@/hooks/useLeaders';

const DESIGNATIONS = [
  'Managing Partner',
  'Partner',
  'Business Leader',
  'Director',
  'Senior Manager',
  'Manager',
  'Associate',
  'Analyst',
  'Other',
];

const LEADER_DESIGNATIONS = ['Managing Partner', 'Partner', 'Business Leader', 'Director'];

const EMPTY_FORM = {
  full_name: '',
  designation: 'Manager',
  email: '',
  phone: '',
  leader_id: '',
  status: 'Active',
  notes: '',
};

function MemberForm({ member, leaders, onSave, onClose }) {
  const [form, setForm] = useState(member ? {
    full_name: member.full_name || '',
    designation: member.designation || 'Manager',
    email: member.email || '',
    phone: member.phone || '',
    leader_id: member.leader_id || '',
    status: member.status || 'Active',
    notes: member.notes || '',
  } : { ...EMPTY_FORM });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Full Name *</Label>
          <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Rajesh Kumar" />
        </div>
        <div>
          <Label>Designation</Label>
          <Select value={form.designation} onValueChange={v => set('designation', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="On Notice">On Notice</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@cbva.com" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98xxx" />
        </div>
        <div className="col-span-2">
          <Label>Reports To (Leader)</Label>
          <Select value={form.leader_id || 'none'} onValueChange={v => set('leader_id', v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Select leader..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— No leader —</SelectItem>
              {leaders.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Notes</Label>
          <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1 bg-cbva-navy hover:bg-cbva-navy/90" onClick={() => onSave(form)} disabled={!form.full_name}>
          {member ? 'Save Changes' : 'Add Member'}
        </Button>
      </div>
    </div>
  );
}

export default function FirmwideTeam() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [filterDesig, setFilterDesig] = useState('all');

  const { data: members = [], isLoading: membersLoading } = useFirmwideTeam();
  const { data: leaders = [] } = useLeaders();

  const addMember = useMutation({
    mutationFn: (body) => apiPost('/api/team', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firmwide-team'] });
      setAddOpen(false);
      toast.success('Team member added');
    },
    onError: (e) => toast.error(e.message || 'Failed to add member'),
  });

  const updateMember = useMutation({
    mutationFn: ({ id, ...body }) => apiPut(`/api/team/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firmwide-team'] });
      setEditMember(null);
      toast.success('Member updated');
    },
    onError: (e) => toast.error(e.message || 'Failed to update member'),
  });

  const filtered = useMemo(() => {
    if (filterDesig === 'all') return members;
    if (filterDesig === 'leaders') return members.filter(m => LEADER_DESIGNATIONS.includes(m.designation));
    return members.filter(m => m.designation === filterDesig);
  }, [members, filterDesig]);

  const grouped = useMemo(() => ({
    leaderTier: filtered.filter(m => LEADER_DESIGNATIONS.includes(m.designation)),
    staffTier: filtered.filter(m => !LEADER_DESIGNATIONS.includes(m.designation)),
  }), [filtered]);

  const leaderMap = useMemo(() => Object.fromEntries(leaders.map(l => [l.id, l.name])), [leaders]);

  if (membersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-light text-foreground tracking-tight">Firm Team</h1>
          <p className="text-sm text-muted-foreground mt-1">{members.length} members across the firm</p>
        </div>
        <Button className="bg-cbva-navy hover:bg-cbva-navy/90 gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" /> Add Member
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'All' },
          { value: 'leaders', label: 'Leadership' },
          ...DESIGNATIONS.map(d => ({ value: d, label: d })),
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilterDesig(f.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterDesig === f.value ? 'bg-cbva-navy text-white border-cbva-navy' : 'bg-card text-muted-foreground border-border hover:border-cbva-navy/40'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {grouped.leaderTier.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Business Leaders</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.leaderTier.map((m, i) => (
              <MemberCard key={m.id} member={m} index={i} leaderMap={leaderMap} onEdit={() => setEditMember(m)} />
            ))}
          </div>
        </section>
      )}

      {grouped.staffTier.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Staff</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.staffTier.map((m, i) => (
              <MemberCard key={m.id} member={m} index={i} leaderMap={leaderMap} onEdit={() => setEditMember(m)} />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No team members yet. Click "Add Member" to get started.</p>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
          <MemberForm
            leaders={leaders}
            onSave={(data) => addMember.mutate(data)}
            onClose={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editMember} onOpenChange={v => !v && setEditMember(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Member</DialogTitle></DialogHeader>
          {editMember && (
            <MemberForm
              member={editMember}
              leaders={leaders}
              onSave={(data) => updateMember.mutate({ id: editMember.id, ...data })}
              onClose={() => setEditMember(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberCard({ member, index, leaderMap, onEdit }) {
  const statusColor = member.status === 'Active'
    ? 'bg-status-green-bg text-status-green'
    : member.status === 'On Notice'
    ? 'bg-status-amber-bg text-status-amber'
    : 'bg-muted text-muted-foreground';
  const isLeaderTier = LEADER_DESIGNATIONS.includes(member.designation);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card rounded-2xl border border-border/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] p-5"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0 text-white ${isLeaderTier ? 'bg-cbva-navy' : 'bg-slate-400'}`}>
          {member.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{member.full_name}</p>
          <p className="text-xs text-muted-foreground">{member.designation}</p>
          {member.leader_id && leaderMap[member.leader_id] && (
            <p className="text-[11px] text-muted-foreground mt-0.5">→ {leaderMap[member.leader_id]}</p>
          )}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}>{member.status}</span>
      </div>

      {member.email && (
        <p className="text-xs text-muted-foreground mt-3 truncate">{member.email}</p>
      )}

      <div className="flex gap-2 mt-4">
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={onEdit}>
          <Pencil className="w-3 h-3" /> Edit
        </Button>
      </div>
    </motion.div>
  );
}
