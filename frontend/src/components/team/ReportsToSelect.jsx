import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { sortByDesignation } from '@/lib/designations';

export default function ReportsToSelect({ value, onChange, teamMembers = [], excludeId, label = 'Reports To' }) {
  const options = [...teamMembers]
    .filter((m) => m.id !== excludeId && m.status !== 'Inactive')
    .sort(sortByDesignation);

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">{label}</label>
      <Select
        value={value || 'default'}
        onValueChange={(v) => onChange(v === 'default' ? null : v)}
      >
        <SelectTrigger><SelectValue placeholder="Reports to leader (by designation)" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Reports to leader (by designation)</SelectItem>
          {options.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.full_name} · {m.designation || 'Member'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
