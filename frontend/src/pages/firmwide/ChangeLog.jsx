import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, History, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatINRFull } from '@/lib/formatCurrency';
import { formatIstDateTime } from '@/lib/datetime';
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
    <div className="space-y-6 pb-12 min-w-0 max-w-full overflow-x-hidden">
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
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 shrink-0">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={filters.q}
            onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setSkip(0); }}
            className="pl-9 w-full"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 min-w-0">
          <select
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
            value={filters.entity_type}
            onChange={(e) => { setFilters((f) => ({ ...f, entity_type: e.target.value })); setSkip(0); }}
          >
            {ENTITY_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
            value={filters.action}
            onChange={(e) => { setFilters((f) => ({ ...f, action: e.target.value })); setSkip(0); }}
          >
            {ACTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Input
            type="date"
            value={filters.date_from}
            onChange={(e) => { setFilters((f) => ({ ...f, date_from: e.target.value })); setSkip(0); }}
            className="text-sm w-full min-w-0"
            aria-label="From date"
          />
          <Input
            type="date"
            value={filters.date_to}
            onChange={(e) => { setFilters((f) => ({ ...f, date_to: e.target.value })); setSkip(0); }}
            className="text-sm w-full min-w-0"
            aria-label="To date"
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
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: '2rem' }} />
              <col style={{ width: '11.5rem' }} />
              <col style={{ width: '6rem' }} />
              <col style={{ width: '5rem' }} />
              <col style={{ width: '5.5rem' }} />
              <col />
              <col style={{ width: '5rem' }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 px-1" />
                <TableHead className="px-2">When</TableHead>
                <TableHead className="px-2">Actor</TableHead>
                <TableHead className="px-2">Action</TableHead>
                <TableHead className="px-2">Module</TableHead>
                <TableHead className="px-2">Record</TableHead>
                <TableHead className="px-2">Changes</TableHead>
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
                const whenLabel = formatIstDateTime(entry.created_at, 'dd MMM yyyy · h:mm a');
                const whenTitle = formatIstDateTime(entry.created_at, 'dd MMM yyyy, h:mm:ss a');
                return (
                  <React.Fragment key={entry.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => toggleRow(entry.id)}
                    >
                      <TableCell className="px-1">
                        {isOpen
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="text-xs px-2" title={whenTitle}>
                        <span className="block truncate tabular-nums text-foreground">{whenLabel}</span>
                      </TableCell>
                      <TableCell className="text-xs px-2 truncate" title={entry.actor_name || ''}>
                        {entry.actor_name || '—'}
                      </TableCell>
                      <TableCell className="px-2">
                        <Badge variant="secondary" className={`${actionBadgeClass(entry.action)} text-[10px] px-1.5`}>
                          {entry.action?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] capitalize px-2 truncate" title={entry.entity_type}>
                        {entry.entity_type?.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-xs px-2 truncate" title={entry.entity_label}>
                        {entry.entity_label || '—'}
                      </TableCell>
                      <TableCell className="px-2">
                        {changeCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] px-1.5">{changeCount}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={7} className="px-4 sm:px-8">
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
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="min-w-0">
          {total} total · page {page} of {totalPages}
          {isFetching && !isLoading ? ' · refreshing…' : ''}
        </span>
        <div className="flex gap-2 shrink-0">
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
