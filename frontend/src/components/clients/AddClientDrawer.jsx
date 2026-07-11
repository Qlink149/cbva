import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY = {
  name: '',
  type: '',
  primary_industry: '',
  status: 'Active',
  date_onboarded: '',
  next_meeting_date: '',
  notes: '',
};

export default function AddClientDrawer({ open, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
    setForm(EMPTY);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add New Client</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label>Client Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Tata Group" className="mt-1" required />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => set('type', v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {['Corporate', 'Promoter/HNI', 'Family Office', 'NRI', 'Foreign Co', 'SME', 'Other'].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Industry</Label>
            <Input value={form.primary_industry} onChange={e => set('primary_industry', e.target.value)} placeholder="e.g. Manufacturing" className="mt-1" />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Active', 'Dormant', 'Lost', 'Prospect'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date Onboarded</Label>
            <Input type="date" value={form.date_onboarded} onChange={e => set('date_onboarded', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Next Meeting Date</Label>
            <Input type="date" value={form.next_meeting_date} onChange={e => set('next_meeting_date', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Remarks</Label>
            <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes" className="mt-1" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">Add Client</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}