import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TEAM_DESIGNATIONS } from '@/lib/designations';
import ReportsToSelect from '@/components/team/ReportsToSelect';

export default function EditMemberDrawer({ member, onClose, onSave, isSaving, teamMembers = [] }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (member) {
      setForm({
        full_name: member.full_name || '',
        designation: member.designation || '',
        email: member.email || '',
        phone: member.phone || '',
        annual_cost: member.annual_cost ? String(member.annual_cost) : '',
        joining_date: member.joining_date || '',
        status: member.status || 'Active',
        notes: member.notes || '',
        reports_to_member_id: member.reports_to_member_id || null,
      });
    }
  }, [member]);

  if (!form) return null;

  const handleSave = () => {
    onSave({
      ...form,
      annual_cost: parseFloat(form.annual_cost) || 0,
      reports_to_member_id: form.reports_to_member_id || null,
    });
  };

  return (
    <Sheet open={!!member} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Team Member</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Full Name *</label>
            <Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="e.g. Rahul Sharma" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Designation</label>
            <Select value={form.designation || undefined} onValueChange={v => setForm(p => ({ ...p, designation: v }))}>
              <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
              <SelectContent>
                {TEAM_DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Email</label>
            <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="rahul@firm.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Phone</label>
            <Input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Annual Cost (INR)</label>
            <Input type="number" value={form.annual_cost} onChange={e => setForm(p => ({ ...p, annual_cost: e.target.value }))} placeholder="0" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Joining Date</label>
            <Input type="date" value={form.joining_date} onChange={e => setForm(p => ({ ...p, joining_date: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Status</label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="On Notice">On Notice</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ReportsToSelect
            value={form.reports_to_member_id}
            onChange={(v) => setForm((p) => ({ ...p, reports_to_member_id: v }))}
            teamMembers={teamMembers}
            excludeId={member?.id}
          />
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Remarks</label>
            <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any notes..." />
          </div>
          <Button
            className="w-full bg-cbva-navy hover:bg-cbva-navy/90 mt-2"
            onClick={handleSave}
            disabled={!form.full_name || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}