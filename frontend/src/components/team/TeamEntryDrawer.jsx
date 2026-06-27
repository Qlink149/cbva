import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Briefcase } from 'lucide-react';

const TABS = [
  { key: 'member', label: 'Add Team Member', icon: Users },
  { key: 'hiring', label: 'Hiring Requirement', icon: Briefcase },
];

const emptyMember = { full_name: '', designation: '', email: '', phone: '', annual_cost: '', joining_date: '', status: 'Active', notes: '' };
const emptyHiring = { role_title: '', level: 'Analyst', expected_joining_date: '', status: 'Open', expected_cost: '', notes: '' };

export default function TeamEntryDrawer({ open, onClose, onSaveMember, onSaveHiring, isSavingMember, isSavingHiring }) {
  const [tab, setTab] = useState('member');
  const [member, setMember] = useState(emptyMember);
  const [hiring, setHiring] = useState(emptyHiring);

  const handleSaveMember = () => {
    onSaveMember({ ...member, annual_cost: parseFloat(member.annual_cost) || 0 });
  };

  const handleSaveHiring = () => {
    onSaveHiring({ ...hiring, expected_cost: parseFloat(hiring.expected_cost) || 0 });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Team Entry</SheetTitle>
        </SheetHeader>

        {/* Tab Toggle */}
        <div className="flex gap-2 mt-4 mb-6 bg-muted rounded-lg p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'member' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Full Name *</label>
              <Input value={member.full_name} onChange={e => setMember(p => ({ ...p, full_name: e.target.value }))} placeholder="e.g. Rahul Sharma" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Designation</label>
              <Input value={member.designation} onChange={e => setMember(p => ({ ...p, designation: e.target.value }))} placeholder="e.g. Senior Manager" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Email</label>
              <Input type="email" value={member.email} onChange={e => setMember(p => ({ ...p, email: e.target.value }))} placeholder="rahul@firm.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Phone</label>
              <Input type="tel" value={member.phone} onChange={e => setMember(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Annual Cost (INR)</label>
              <Input type="number" value={member.annual_cost} onChange={e => setMember(p => ({ ...p, annual_cost: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Joining Date</label>
              <Input type="date" value={member.joining_date} onChange={e => setMember(p => ({ ...p, joining_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Status</label>
              <Select value={member.status} onValueChange={v => setMember(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="On Notice">On Notice</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Notes</label>
              <Input value={member.notes} onChange={e => setMember(p => ({ ...p, notes: e.target.value }))} placeholder="Any notes..." />
            </div>
            <Button className="w-full bg-cbva-navy hover:bg-cbva-navy/90 mt-2" onClick={handleSaveMember} disabled={!member.full_name || isSavingMember}>
              {isSavingMember ? 'Saving…' : 'Add Team Member'}
            </Button>
          </div>
        )}

        {tab === 'hiring' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Role Title *</label>
              <Input value={hiring.role_title} onChange={e => setHiring(p => ({ ...p, role_title: e.target.value }))} placeholder="e.g. Tax Manager" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Level</label>
              <Select value={hiring.level} onValueChange={v => setHiring(p => ({ ...p, level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Analyst', 'Associate', 'Manager', 'Senior Manager', 'Director', 'Partner', 'Other'].map(l => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Expected Joining Date</label>
              <Input type="date" value={hiring.expected_joining_date} onChange={e => setHiring(p => ({ ...p, expected_joining_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Status</label>
              <Select value={hiring.status} onValueChange={v => setHiring(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Filled">Filled</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Expected Annual Cost (INR)</label>
              <Input type="number" value={hiring.expected_cost} onChange={e => setHiring(p => ({ ...p, expected_cost: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">Notes</label>
              <Input value={hiring.notes} onChange={e => setHiring(p => ({ ...p, notes: e.target.value }))} placeholder="Any notes..." />
            </div>
            <Button className="w-full bg-cbva-navy hover:bg-cbva-navy/90 mt-2" onClick={handleSaveHiring} disabled={!hiring.role_title || isSavingHiring}>
              {isSavingHiring ? 'Saving…' : 'Add Hiring Requirement'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}