import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, History, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatINRFull } from '@/lib/formatCurrency';
import { formatIstRelative } from '@/lib/datetime';
import { useAuditLog, exportAuditLog } from '@/hooks/useAuditLog';

const ENTITY_TYPES = [
  { value: '', label: 'All modules' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'collection', label: 'Collection' },
  { value: 'collection_transaction', label: 'Collection Transaction' },
  { value: 'action', label: 'Action' },
  { value: 'task', label: 'Task' },
  { value: 'team_member', label: 'Team Member' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'client_meeting', label: 'Client Meeting' },
  { value: 'user', label: 'User' },
  { value: 'auth', label: 'Auth' },
  { value: 'settings', label: 'Settings' },
  { value: 'consolidated_summary', label: 'Consolidated Import' },
];

const ACTIONS = [
  { value: '', label: 'All actions' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'archived', label: 'Archived' },
  { value: 'status_changed', label: 'Status changed' },
  { value: 'login', label: 'Login' },
  { value: 'imported', label: 'Imported' },
  { value: 'baseline', label: 'Baseline' },
];

function actionBadgeClass(action) {
  switch (action) {
    case 'created': return 'bg-emerald-100 text-emerald-800';
    case 'updated': return 'bg-amber-100 text-amber-800';
    case 'deleted':
    case 'archived': return 'bg-red-100 text-red-800';
    case 'login': return 'bg-blue-100 text-blue-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}

function formatValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') return formatINRFull(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function AuditRowDetails({ entry }) {
  const changes = entry.changes || [];
  if (!changes.length) {
    return (
      <p className="text-xs text-muted-foreground italic py-2">
        No field-level changes recorded for this action.
      </p>
    );
  }
  return (
    <div className="space-y-2 py-2">
      {changes.map((change, idx) => (
        <div
          key={idx}
          className={`text-xs flex flex-wrap items-center gap-2 ${change.derived ? 'text-muted-foreground' : 'text-slate-700'}`}
        >
          <span className="font-medium">{change.label || change.field}:</span>
          <span className="font-tabular text-red-600">{formatValue(change.old)}</span>
          <span>→</span>
          <span className="font-tabular text-emerald-600">{formatValue(change.new)}</span>
          {change.derived && (
            <span className="text-[10px] uppercase tracking-wide">(calculated)</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ChangeLog() {
  const [expanded, setExpanded] = useState({});
  const [filters, setFilters] = useState({
    q: '',
    entity_type: '',
    action: '',
    date_from: '',
    date_to: '',
  });
  const [skip, setSkip] = useState(0);
  const limit = 50;

  const queryParams = useMemo(() => {
    const params = { skip, limit };
    if (filters.q) params.q = filters.q;
    if (filters.entity_type) params.entity_type = filters.entity_type;
    if (filters.action) params.action = filters.action;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    return params;
  }, [filters, skip, limit]);

  const { data, isLoading, isFetching } = useAuditLog(queryParams);
  const entries = data?.data ?? [];
  const total = data?.total ?? 0;

  function toggleRow(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleExport() {
    exportAuditLog(queryParams).catch(console.error);
  }

  const page = Math.floor(skip / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-[var(--violet)]" />
            <h1 className="text-4xl font-light tracking-tight">Change Log</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Who changed what, when — across the entire platform.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={filters.q}
            onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setSkip(0); }}
            className="pl-9"
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.entity_type}
          onChange={(e) => { setFilters((f) => ({ ...f, entity_type: e.target.value })); setSkip(0); }}
        >
          {ENTITY_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.action}
          onChange={(e) => { setFilters((f) => ({ ...f, action: e.target.value })); setSkip(0); }}
        >
          {ACTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <Input
            type="date"
            value={filters.date_from}
            onChange={(e) => { setFilters((f) => ({ ...f, date_from: e.target.value })); setSkip(0); }}
            className="text-sm"
          />
          <Input
            type="date"
            value={filters.date_to}
            onChange={(e) => { setFilters((f) => ({ ...f, date_to: e.target.value })); setSkip(0); }}
            className="text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No audit entries found.
                  </TableCell>
                </TableRow>
              )}
              {entries.map((entry) => {
                const isOpen = expanded[entry.id];
                const changeCount = entry.changes?.length ?? 0;
                return (
                  <React.Fragment key={entry.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => toggleRow(entry.id)}
                    >
                      <TableCell>
                        {isOpen
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {entry.created_at
                          ? formatIstRelative(entry.created_at)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{entry.actor_name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={actionBadgeClass(entry.action)}>
                          {entry.action?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize">
                        {entry.entity_type?.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={entry.entity_label}>
                        {entry.entity_label || '—'}
                      </TableCell>
                      <TableCell>
                        {changeCount > 0 ? (
                          <Badge variant="outline">{changeCount} field{changeCount !== 1 ? 's' : ''}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={7} className="px-8">
                          <AuditRowDetails entry={entry} />
                          {entry.source === 'system' && (
                            <p className="text-[10px] text-muted-foreground mt-1">System-generated cascade</p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} total · page {page} of {totalPages}
          {isFetching && !isLoading ? ' · refreshing…' : ''}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={skip <= 0}
            onClick={() => setSkip(Math.max(0, skip - limit))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={skip + limit >= total}
            onClick={() => setSkip(skip + limit)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
