import React, { useMemo, useState, useEffect, useDeferredValue, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Plus, Filter, Edit2, Columns3 } from 'lucide-react';
import ClientRowExpanded from '@/components/clients/ClientRowExpanded';
import AddEngagementModal from '@/components/clients/AddEngagementModal';
import ClientFilterPanel from '@/components/clients/ClientFilterPanel';
import { ColumnHeaderFilter } from '@/components/clients/ColumnHeaderFilter';
import { useClientActions } from '@/lib/ClientActionsContext';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useTeam } from '@/hooks/useTeam';
import { useEngagements } from '@/hooks/useEngagements';
import { useCollectionTransactions, useAddTransaction, useDeleteTransaction } from '@/hooks/useCollectionTransactions';
import MonthSelector from '@/components/clients/MonthSelector';
import { getDefaultMonthKey, MONTH_SHORT_NAMES } from '@/lib/fyMonths';
import { groupTxByEngagementMonth, plannedForMonth, collectedForMonth } from '@/lib/collectionsRollup';
import { getPrevFySlug, getFyLabel, isFyEditable } from '@/lib/fiscalYear';
import { formatINRFull } from '@/lib/formatCurrency';
import {
  DEFAULT_ENGAGEMENT_FILTERS,
  applyEngagementFilters,
  countActiveEngagementFilters,
  pruneMonthlyFilters,
} from '@/lib/engagementFilters';
import PersonSelect from '@/components/clients/PersonSelect';
import PersonMultiSelect from '@/components/clients/PersonMultiSelect';
import { useLeader } from '@/hooks/useLeaders';
import { leaderScopedManagerOptions } from '@/lib/designations';
import { displayPartnerNames } from '@/lib/relationshipPartners';
import { leaderHasClientScope, CLIENT_SCOPE_VALUES } from '@/lib/clientScope';
import { useEngagementChanges } from '@/hooks/useEngagementMeta';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { TableSkeleton, SectionLoadingOverlay, RefreshingBadge } from '@/components/ui/LoadingState';
import {
  COL_WIDTH,
  DEFAULT_COLUMN_VISIBILITY,
  TOGGLEABLE_IDENTITY_COLUMNS,
  STICKY_EDGE_SHADOW_CLASS,
  buildEngagementColumns,
  engagementTableMinWidth,
  colVisible,
  colWidth,
  widthStyle,
  stickyLeftMap,
} from '@/lib/fyTableConfig';

const L = 100000;
const BLUE_SKY_BG = '#00CCFF';

function EngagementColGroup({ columns }) {
  return (
    <colgroup>
      {columns.map((col) => (
        <col key={col.key} style={{ width: col.width, minWidth: col.width }} />
      ))}
    </colgroup>
  );
}

const EL_STATUS_OPTIONS = ['Signed', 'Not Signed', 'Waived', 'NA', 'DS', '—'];

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;
  return sortDir === 'desc'
    ? <ArrowDown className="w-3 h-3 inline ml-1 text-cbva-navy" />
    : <ArrowUp className="w-3 h-3 inline ml-1 text-cbva-navy" />;
}

function VirtualPadRow({ height, columns }) {
  if (!height) return null;
  return (
    <tr aria-hidden="true">
      {columns.map((col) => (
        <td key={col.key} style={{ height, padding: 0, border: 'none' }} />
      ))}
    </tr>
  );
}

function NameCell({ value, onChange, isExpanded, actCount, onToggleExpand, stickyClass, stickyStyle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function startEdit(e) {
    e.stopPropagation();
    setDraft(value || '');
    setEditing(true);
  }

  function commit() {
    const next = draft.trim();
    if (next && next !== (value || '').trim()) onChange(next);
    setEditing(false);
  }

  return (
    <td className={`${stickyClass} py-2 px-2 font-medium text-foreground`} style={stickyStyle}>
      <div className="flex items-center gap-1.5 w-full min-w-0 overflow-hidden">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details`}
          className="text-muted-foreground hover:text-cbva-navy transition-colors shrink-0 p-0.5 rounded"
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        {editing ? (
          <input
            autoFocus
            className="flex-1 min-w-0 text-xs border border-cbva-navy rounded px-1.5 py-1 focus:outline-none bg-white"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            title="Click to edit name"
            className={`flex-1 min-w-0 text-left truncate rounded-md px-1 py-0.5 hover:bg-muted/40 hover:text-cbva-navy hover:underline underline-offset-2 transition-colors ${isExpanded ? 'text-cbva-navy' : 'text-foreground'}`}
          >
            {value || <span className="text-muted-foreground italic no-underline">Unidentified</span>}
          </button>
        )}
        {actCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-cbva-navy text-white text-[9px] font-bold shrink-0">
            {actCount}
          </span>
        )}
      </div>
    </td>
  );
}

function RelPartnerCell({ value, onChange, stickyClass, stickyStyle, options = [], disabled = false }) {
  return (
    <td className={`${stickyClass} py-1 px-2`} style={stickyStyle}>
      <div className="min-w-0 w-full overflow-hidden">
        <PersonMultiSelect
          value={value}
          onChange={onChange}
          options={options}
          disabled={disabled}
          compact
          title={value ? displayPartnerNames(value) : 'Select relationship partner'}
        />
      </div>
    </td>
  );
}

function ELStatusCell({ value, onChange, stickyClass, stickyStyle, disabled = false }) {
  return (
    <td className={`${stickyClass} py-2 px-1.5`} style={stickyStyle}>
      <div className="min-w-0 w-full overflow-hidden">
        <select
          aria-label="EL status"
          title={disabled ? 'Fiscal year is locked' : 'Change EL status'}
          disabled={disabled}
          className={`w-full text-[10px] border border-transparent rounded px-1 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-cbva-navy/40 ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-border/60 cursor-pointer'}`}
          value={value || '—'}
          onChange={(e) => {
            if (e.target.value !== (value || '—')) onChange(e.target.value);
          }}
        >
          {EL_STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    </td>
  );
}

function ManagerCell({ value, onChange, stickyClass, stickyStyle, options = [], disabled = false }) {
  return (
    <td className={`${stickyClass} py-1 px-2`} style={stickyStyle}>
      <div className="min-w-0 w-full overflow-hidden">
        <PersonSelect
          value={value}
          onChange={onChange}
          options={options}
          disabled={disabled}
          compact
          title={value || 'Select manager'}
        />
      </div>
    </td>
  );
}

function ScopeCell({ value, onChange, stickyClass, stickyStyle, disabled = false }) {
  const scope = value || 'Domestic';
  const isIntl = scope === 'International';
  return (
    <td className={`${stickyClass} py-2 px-1.5`} style={stickyStyle}>
      <div className="relative w-full">
        <select
          aria-label="Client scope"
          title={disabled ? 'Fiscal year is locked' : scope}
          disabled={disabled}
          className={`appearance-none w-full text-[10px] font-medium rounded-full pl-2.5 pr-6 py-1 border border-transparent focus:outline-none focus:ring-1 focus:ring-cbva-navy/40 transition-colors ${
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-border/60'
          } ${isIntl ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-800'}`}
          value={scope}
          onChange={e => onChange(e.target.value)}
        >
          <option value="Domestic">Domestic</option>
          <option value="International">Intl</option>
        </select>
        <ChevronDown className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${isIntl ? 'text-indigo-500' : 'text-emerald-600'}`} />
      </div>
    </td>
  );
}

function RemarkCell({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function startEdit() {
    setDraft(value || '');
    setEditing(true);
  }

  function commit() {
    if (draft !== (value || '')) {
      onChange(draft);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <td className="py-2 px-3 relative">
        <div 
          className="absolute z-50 top-2 right-2 bg-white border border-border shadow-xl rounded-xl p-3 w-[320px] animate-in fade-in zoom-in-95 duration-100"
          tabIndex={-1}
          onBlur={e => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              commit();
            }
          }}
        >
           <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Edit Remark</p>
           <textarea 
             autoFocus
             className="w-full text-xs border border-border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-cbva-navy min-h-[80px] resize-none mb-3"
             value={draft}
             onChange={e => setDraft(e.target.value)}
             placeholder="Enter your remarks here..."
             onKeyDown={e => {
               if (e.key === 'Escape') setEditing(false);
               if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commit();
             }}
           />
           <div className="flex justify-end gap-2">
             <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded">Cancel</button>
             <button onClick={commit} className="text-xs bg-cbva-navy text-white px-3 py-1.5 rounded-md font-medium hover:bg-cbva-navy/90 transition-colors">Save</button>
           </div>
        </div>
      </td>
    );
  }

  return (
    <td className="py-3 px-3 cursor-pointer group hover:bg-muted/30 transition-colors" onClick={startEdit}>
       {value ? (
         <div className="flex items-center gap-2">
           <span className="text-xs text-foreground truncate max-w-[280px]" title={value}>{value}</span>
           <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-cbva-navy shrink-0" />
         </div>
       ) : (
         <span className="text-xs text-muted-foreground/60 group-hover:text-cbva-navy flex items-center gap-1 transition-colors italic">
            <Plus className="w-3 h-3" /> Add remark
         </span>
       )}
    </td>
  );
}


function CollectedMonthCell({ value, onSetAmount, pending }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function startEdit() {
    setDraft(value > 0 ? String(value) : '0');
    setEditing(true);
  }

  async function commit() {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0) {
      const next = Math.round(parsed);
      if (next !== (value || 0)) await onSetAmount(next);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <td className="py-1 px-2 text-right">
        <input
          autoFocus
          disabled={pending}
          className="w-24 text-right text-xs border border-cbva-navy rounded px-1 py-0.5 font-tabular focus:outline-none bg-white"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      </td>
    );
  }

  return (
    <td
      className="py-3 px-3 text-right font-tabular text-emerald-700 text-xs cursor-pointer hover:bg-emerald-50/50 transition-colors"
      title="Click to set collected amount for this month"
      onClick={startEdit}
    >
      {value > 0 ? formatINRFull(value) : '-'}
    </td>
  );
}

function EditableCell({ value, onChange, color, colVisible = true }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!colVisible) return null;

  function startEdit() {
    setDraft(value != null ? String(value) : '0');
    setEditing(true);
  }

  function commit() {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0) onChange(Math.round(parsed));
    setEditing(false);
  }

  if (editing) {
    return (
      <td className="py-1 px-2 text-right" style={color ? { backgroundColor: color } : {}}>
        <input
          autoFocus
          className="w-24 text-right text-xs border border-cbva-navy rounded px-1 py-0.5 font-tabular focus:outline-none bg-white"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        />
      </td>
    );
  }

  const isNavy = color === '#1e3a5f';
  return (
    <td
      className={`py-3 px-3 text-right font-tabular text-xs cursor-pointer hover:opacity-80 transition-opacity ${isNavy ? 'text-white' : 'text-black'}`}
      style={color ? { backgroundColor: color } : {}}
      title="Click to edit"
      onClick={startEdit}
    >
      {value != null && value > 0 ? formatINRFull(value) : '-'}
    </td>
  );
}

function EngagementExpandedPanel({ client, actions, onAddAction, onDeleteAction, onUpdateRemarks }) {
  const { data: changes = [], isLoading: changesLoading } = useEngagementChanges(client.id, true);
  return (
    <ClientRowExpanded
      client={client}
      actions={actions}
      changes={changes}
      changesLoading={changesLoading}
      onAddAction={onAddAction}
      onDeleteAction={onDeleteAction}
      onUpdateRemarks={onUpdateRemarks}
    />
  );
}

// Unified engagements table - same layout for all fiscal years
function EngagementsTable({ fiscalYear, fyLabel: fyLabelProp }) {
  const { user } = useAuth();
  const { clients, isLoading, isError, clientActions, addAction, deleteAction, updateEngagement, updateRemarks: updateRemarksApi, isUpdating } = useClientActions();
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();
  const canEdit = isFyEditable(activeFY, fiscalYears, user?.role);
  const { teamMembers } = useTeam(selectedLeaderId, activeFY);
  const { data: selectedLeader } = useLeader(selectedLeaderId);

  const selectedLeaderName = selectedLeader?.name || '';

  const managerOptions = useMemo(
    () => leaderScopedManagerOptions(teamMembers, selectedLeaderName),
    [teamMembers, selectedLeaderName],
  );

  const relPartnerOptions = managerOptions;
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [expandedRow, setExpandedRow] = useState(null);
  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMN_VISIBILITY);
  const [filters, setFilters] = useState(DEFAULT_ENGAGEMENT_FILTERS);
  const deferredFilters = useDeferredValue(filters);

  // Selected months for the Planned vs Collected section (default: previous month)
  const [selectedMonths, setSelectedMonths] = useState(() => [getDefaultMonthKey(activeFY)]);
  useEffect(() => {
    setSelectedMonths([getDefaultMonthKey(activeFY)]);
  }, [activeFY]);

  useEffect(() => {
    setFilters((prev) => pruneMonthlyFilters(prev, selectedMonths));
  }, [selectedMonths]);

  // Prior-FY actual collected (engagement.collected), matched by client name
  const prevFySlug = getPrevFySlug(activeFY, fiscalYears);
  const prevFyLabel = getFyLabel(prevFySlug, fiscalYears);
  const { data: prevEngagements = [] } = useEngagements(selectedLeaderId, prevFySlug);
  const prevCollectedByName = useMemo(() => {
    const map = new Map();
    prevEngagements.forEach((e) => {
      const key = (e.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!key) return;
      const cur = map.get(key);
      if (cur) map.set(key, { collected: cur.collected, count: cur.count + 1 });
      else map.set(key, { collected: e.collected || 0, count: 1 });
    });
    return map;
  }, [prevEngagements]);

  function prevActualCollectedFor(client) {
    const key = (client.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const hit = key ? prevCollectedByName.get(key) : null;
    if (!hit || hit.count !== 1) return null; // ambiguous or missing -> TBD
    return hit.collected;
  }

  // Per-engagement per-month actual collected (from finance transactions)
  const { data: transactions = [], isLoading: txLoading, isFetching: txFetching } = useCollectionTransactions(selectedLeaderId, activeFY);
  const txMap = useMemo(() => groupTxByEngagementMonth(transactions), [transactions]);
  const addTransaction = useAddTransaction(selectedLeaderId, activeFY);
  const deleteTransaction = useDeleteTransaction(selectedLeaderId, activeFY);
  const [settingCollectedKey, setSettingCollectedKey] = useState(null);

  const elStatusOptions = useMemo(() => {
    const s = new Set(clients.map(c => c.elStatus).filter(Boolean));
    return Array.from(s).sort();
  }, [clients]);

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  }

  function SortIconCell({ field }) {
    return <SortIcon field={field} sortField={sortField} sortDir={sortDir} />;
  }

  function toggleExpandedRow(num) {
    setExpandedRow((current) => (current === num ? null : num));
  }

  function guardEdit(action) {
    if (!canEdit) {
      toast.error('This fiscal year is locked for editing. Ask an admin to enable it in Admin Settings.');
      return;
    }
    action();
  }

  function updateField(clientId, field, newVal) {
    guardEdit(() => updateEngagement({ id: clientId, [field]: newVal }));
  }

  function updateMonthPlan(clientId, monthKey, newVal) {
    guardEdit(() => updateEngagement({ id: clientId, monthlyPlan: { [monthKey]: newVal } }));
  }

  function updateManager(clientId, val) {
    guardEdit(() => updateEngagement({ id: clientId, manager: val }));
  }

  function updateScope(clientId, val) {
    guardEdit(() => updateEngagement({ id: clientId, clientScope: val }));
  }

  function updateName(clientId, val) {
    guardEdit(() => updateEngagement({ id: clientId, name: val }));
  }

  function updateRelPartner(clientId, val) {
    guardEdit(() => updateEngagement({ id: clientId, relPartner: val }));
  }

  function updateElStatus(clientId, val) {
    guardEdit(() => updateEngagement({ id: clientId, elStatus: val }));
  }

  async function setMonthCollected(client, monthKey, amount) {
    if (!selectedLeaderId || !activeFY || !client?.id) return;
    const key = `${client.id}:${monthKey}`;
    setSettingCollectedKey(key);
    try {
      const existing = transactions.filter(
        (tx) => tx.engagement_id === client.id && tx.month === monthKey
      );
      for (const tx of existing) {
        await deleteTransaction.mutateAsync(tx.id);
      }
      if (amount > 0) {
        await addTransaction.mutateAsync({
          leader_id: selectedLeaderId,
          fiscal_year: activeFY,
          engagement_id: client.id,
          month: monthKey,
          client_name: client.name || '',
          amount_billed: 0,
          amount_collected: amount,
        });
      }
    } finally {
      setSettingCollectedKey(null);
    }
  }

  function updateRemarks(clientId, val, mode = 'edit') {
    updateRemarksApi({ id: clientId, remarks: val, mode });
  }

  const filtered = useMemo(() => {
    let list = applyEngagementFilters(clients, deferredFilters, { txMap, selectedMonths });

    if (sortField) {
      list = [...list].sort((a, b) => {
        const av = a[sortField] ?? '';
        const bv = b[sortField] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'desc' ? bv - av : av - bv;
        }
        const cmp = String(av).localeCompare(String(bv));
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    return list;
  }, [clients, sortField, sortDir, deferredFilters, txMap, selectedMonths]);

  const actCountByClient = useMemo(() => {
    const map = new Map();
    clientActions.forEach((a) => {
      if (a.status !== 'Done') {
        const key = a.engagementId != null ? String(a.engagementId) : a.clientNum;
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return map;
  }, [clientActions]);

  const totals = useMemo(() => {
    const acc = {
      green: 0, amber: 0, blueSky: 0, collected: 0, balance: 0, prevActualCollected: 0,
      months: {},
    };
    selectedMonths.forEach((mk) => { acc.months[mk] = { planned: 0, collected: 0, variance: 0 }; });
    filtered.forEach((c) => {
      acc.green += c.green || 0;
      acc.amber += c.amber || 0;
      acc.blueSky += c.blueSky || 0;
      acc.collected += c.collected || 0;
      acc.balance += c.balance || 0;
      const prevCollected = prevActualCollectedFor(c);
      if (prevCollected != null) acc.prevActualCollected += prevCollected;
      selectedMonths.forEach((mk) => {
        const planned = plannedForMonth(c, mk);
        const collected = collectedForMonth(txMap, c.id, mk);
        acc.months[mk].planned += planned;
        acc.months[mk].collected += collected;
        acc.months[mk].variance += (collected - planned);
      });
    });
    acc.total = acc.green + acc.amber + acc.blueSky;
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selectedMonths, txMap, prevCollectedByName]);

  const showScopeColumn = leaderHasClientScope(selectedLeaderId);
  const monthCount = selectedMonths.length;
  const columns = useMemo(
    () => buildEngagementColumns({
      collectionsOpen,
      showScope: showScopeColumn,
      monthCount,
      visibility: columnVisibility,
    }),
    [collectionsOpen, showScopeColumn, monthCount, columnVisibility],
  );
  const { stickyLeft, lastStickyKey } = stickyLeftMap(columns);
  const tableMinWidth = engagementTableMinWidth(columns);
  const bodyColSpan = columns.length;
  const showManager = colVisible(columns, 'manager');
  const showRelPartner = colVisible(columns, 'relPartner');
  const showElStatus = colVisible(columns, 'elStatus');
  const HDR_BG = '#F1F2F4';
  const stickyEdgeClass = (key) => (lastStickyKey === key ? STICKY_EDGE_SHADOW_CLASS : '');
  const colW = (key) => colWidth(columns, key) ?? COL_WIDTH[key];
  const headerBg = (width, extra = {}) => ({
    ...widthStyle(width),
    background: HDR_BG,
    ...extra,
  });
  const frozenHeader = (key, extra = {}) => ({
    left: stickyLeft[key],
    ...headerBg(colW(key), extra),
  });
  const frozenBody = (key) => ({
    left: stickyLeft[key],
    ...widthStyle(colW(key)),
  });

  // thead sticks as one block (no per-row top: 36). Identity cols only stick left.
  const stickyHeaderLeft = 'sticky z-50';
  const stickyBase = 'sticky z-[1] bg-white';
  const stickyFooter = 'sticky bottom-0 z-10 bg-muted';
  const stickyFooterLeft = 'sticky bottom-0 z-30 bg-muted';

  const activeFilterCount = countActiveEngagementFilters(filters, selectedMonths);

  const scrollRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (expandedRow === filtered[index]?.num ? 320 : 52),
    overscan: 8,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [expandedRow, filtered.length, collectionsOpen, columnVisibility, rowVirtualizer]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border font-medium transition-colors ${showFilters ? 'bg-cbva-navy text-white border-cbva-navy' : 'bg-white text-foreground border-border hover:bg-muted'}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className={`ml-1 flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${showFilters ? 'bg-white text-cbva-navy' : 'bg-cbva-navy text-white'}`}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColumns((v) => !v)}
              className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border font-medium transition-colors ${showColumns ? 'bg-cbva-navy text-white border-cbva-navy' : 'bg-white text-foreground border-border hover:bg-muted'}`}
            >
              <Columns3 className="w-4 h-4" />
              Columns
            </button>
            {showColumns && (
              <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-lg border border-border bg-white p-2 shadow-lg">
                {TOGGLEABLE_IDENTITY_COLUMNS.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60">
                    <input
                      type="checkbox"
                      checked={columnVisibility[col.key]}
                      onChange={() => setColumnVisibility((prev) => ({ ...prev, [col.key]: !prev[col.key] }))}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <input
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring w-72"
            placeholder="Search clients..."
            value={filters.name}
            onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}
          />
          <span className="text-xs text-muted-foreground hidden sm:block">Click name, partner, EL, amounts, or month collected to edit · Chevron expands details</span>
        </div>
        <button
          onClick={() => {
            if (!canEdit) {
              toast.error('This fiscal year is locked for editing. Ask an admin to enable it in Admin Settings.');
              return;
            }
            setShowAddModal(true);
          }}
          className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-cbva-navy text-white hover:bg-cbva-navy/90 transition-colors font-medium ${!canEdit ? 'opacity-50' : ''}`}
        >
          <Plus className="w-4 h-4" />
          Add Engagement
        </button>
      </div>

      {!canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {getFyLabel(activeFY, fiscalYears)} is read-only. An admin can enable editing under Admin Settings → Financial Years.
        </div>
      )}

      {collectionsOpen && (
        <div className="flex items-center gap-2 flex-wrap rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-cbva-navy font-semibold">Planned vs Collected</span>
          <MonthSelector selected={selectedMonths} onChange={setSelectedMonths} fySlug={activeFY} />
        </div>
      )}

      {showAddModal && (
        <AddEngagementModal
          nextNum={clients.length + 1}
          onClose={() => setShowAddModal(false)}
          showScopeField={showScopeColumn}
        />
      )}

      {showFilters && (
        <ClientFilterPanel
          clients={clients}
          filters={filters}
          setFilters={setFilters}
          showScope={showScopeColumn}
          selectedMonths={selectedMonths}
          fySlug={activeFY}
          collectionsOpen={collectionsOpen}
          managerOptions={managerOptions}
          relPartnerOptions={relPartnerOptions}
        />
      )}

      {isLoading && <TableSkeleton rows={6} />}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load engagements. Try refreshing the page.
        </div>
      )}

      {!isLoading && !isError && (
      <div className="relative bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex items-center justify-end px-3 py-1 border-b border-border/40 bg-muted/20">
          <RefreshingBadge show={txFetching && !txLoading} label="Refreshing collections…" />
          {isUpdating && <RefreshingBadge show label="Saving…" />}
        </div>
        <SectionLoadingOverlay show={txLoading && collectionsOpen} label="Loading collection data…" />
        <div
          ref={scrollRef}
          className="scrollbar-both isolate overflow-auto"
          style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 230px)', minHeight: '500px' }}
        >
          <table className="text-sm border-separate" style={{ minWidth: tableMinWidth, borderSpacing: 0, tableLayout: 'fixed' }}>
            <EngagementColGroup columns={columns} />
            <thead className="sticky top-0 z-40 shadow-[0_1px_0_0_rgba(15,23,42,0.08)]" style={{ background: HDR_BG }}>
              <tr className="h-9" style={{ background: HDR_BG }}>
                <th className={`${stickyHeaderLeft} left-0 border-b-0 h-9 ${stickyEdgeClass('num')}`} style={frozenHeader('num')}></th>
                <th className={`${stickyHeaderLeft} border-b-0 h-9 ${stickyEdgeClass('name')}`} style={frozenHeader('name')}></th>
                {showScopeColumn && (
                  <th className={`${stickyHeaderLeft} border-b-0 h-9 ${stickyEdgeClass('scope')}`} style={frozenHeader('scope')}></th>
                )}
                {showManager && (
                  <th className={`${stickyHeaderLeft} border-b-0 h-9 ${stickyEdgeClass('manager')}`} style={frozenHeader('manager')}></th>
                )}
                {showRelPartner && (
                  <th className={`${stickyHeaderLeft} border-b-0 h-9 ${stickyEdgeClass('relPartner')}`} style={frozenHeader('relPartner')}></th>
                )}
                {showElStatus && (
                  <th className={`${stickyHeaderLeft} border-b-0 h-9 ${stickyEdgeClass('elStatus')}`} style={frozenHeader('elStatus')}></th>
                )}
                <th colSpan={5} className="border-b-0 h-9" style={{ minWidth: 570, background: HDR_BG }}></th>
                <th className="text-center px-3 text-[10px] leading-tight uppercase tracking-wider text-muted-foreground font-semibold border-b border-border/50 h-9" style={{ minWidth: 120, background: HDR_BG }}>
                  Collected <span className="font-normal normal-case">(Finance Actuals)</span>
                </th>
                {collectionsOpen && (
                  <th colSpan={monthCount * 3 + 1} className="text-center px-3 text-[10px] leading-tight uppercase tracking-wider text-cbva-navy font-semibold border-b border-border/50 border-l border-border/40 h-9" style={{ background: HDR_BG }}>
                    Planned vs Collected{' '}
                    <span className="font-normal text-blue-400 normal-case">(Forecast vs Actuals)</span>
                    <button onClick={() => setCollectionsOpen(false)} className="ml-2 text-cbva-navy hover:text-cbva-navy/80 font-medium inline-flex"><ChevronDown className="w-3 h-3" /></button>
                  </th>
                )}
                {!collectionsOpen && (
                  <th className="text-center px-3 text-[10px] leading-tight text-cbva-navy font-semibold border-b border-border/50 border-l border-border/40 whitespace-nowrap h-9" style={{ background: HDR_BG }}>
                    Planned vs Collected
                    <button onClick={() => setCollectionsOpen(true)} className="ml-2 text-cbva-navy hover:text-cbva-navy/80 font-medium inline-flex"><ChevronRight className="w-3 h-3" /></button>
                  </th>
                )}
                <th colSpan={2} className="border-b-0 h-9" style={{ background: HDR_BG }}></th>
              </tr>
              <tr className="[&>th]:border-b [&>th]:border-border" style={{ background: HDR_BG }}>
                <th className={`${stickyHeaderLeft} left-0 text-left py-3 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium ${stickyEdgeClass('num')}`} style={frozenHeader('num')}>#</th>
                <ColumnHeaderFilter
                  label="Client Name"
                  type="text"
                  filterKey="name"
                  filters={filters}
                  setFilters={setFilters}
                  nowrap={false}
                  className={`${stickyHeaderLeft} text-muted-foreground ${stickyEdgeClass('name')}`}
                  style={frozenHeader('name')}
                />
                {showScopeColumn && (
                  <ColumnHeaderFilter
                    label="Scope"
                    type="multi"
                    filterKey="clientScope"
                    filters={filters}
                    setFilters={setFilters}
                    options={CLIENT_SCOPE_VALUES}
                    nowrap={false}
                    className={`${stickyHeaderLeft} text-muted-foreground ${stickyEdgeClass('scope')}`}
                    style={frozenHeader('scope')}
                  />
                )}
                {showManager && (
                  <ColumnHeaderFilter
                    label="Manager"
                    type="multi"
                    filterKey="manager"
                    filters={filters}
                    setFilters={setFilters}
                    options={managerOptions}
                    includeEmpty
                    nowrap={false}
                    className={`${stickyHeaderLeft} text-muted-foreground ${stickyEdgeClass('manager')}`}
                    style={frozenHeader('manager')}
                  />
                )}
                {showRelPartner && (
                  <ColumnHeaderFilter
                    label="Rel. Partner"
                    type="multi"
                    filterKey="relPartner"
                    filters={filters}
                    setFilters={setFilters}
                    options={relPartnerOptions}
                    includeEmpty
                    nowrap={false}
                    className={`${stickyHeaderLeft} text-muted-foreground ${stickyEdgeClass('relPartner')}`}
                    style={frozenHeader('relPartner')}
                  />
                )}
                {showElStatus && (
                  <ColumnHeaderFilter
                    label="EL Status"
                    type="multi"
                    filterKey="elStatus"
                    filters={filters}
                    setFilters={setFilters}
                    options={elStatusOptions}
                    includeEmpty
                    nowrap={false}
                    className={`${stickyHeaderLeft} text-muted-foreground ${stickyEdgeClass('elStatus')}`}
                    style={frozenHeader('elStatus')}
                  />
                )}
                <th
                  className="text-right py-3 px-3 text-[11px] uppercase tracking-wider text-emerald-800 font-medium"
                  style={headerBg(COL_WIDTH.prevActualCollected)}
                  title={`Actual collected from ${prevFyLabel} (engagement.collected)`}
                >
                  {prevFyLabel} Actual Collected
                </th>
                <ColumnHeaderFilter
                  label="Green (?)"
                  align="right"
                  type="range"
                  filterKey="green"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-emerald-700 cursor-pointer select-none"
                  style={{ ...widthStyle(COL_WIDTH.green), background: HDR_BG }}
                  onSort={() => handleSort('green')}
                  sortIcon={<SortIconCell field="green" />}
                />
                <ColumnHeaderFilter
                  label="Amber (?)"
                  align="right"
                  type="range"
                  filterKey="amber"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-amber-600 cursor-pointer select-none"
                  style={{ ...widthStyle(COL_WIDTH.amber), background: HDR_BG }}
                  onSort={() => handleSort('amber')}
                  sortIcon={<SortIconCell field="amber" />}
                />
                <ColumnHeaderFilter
                  label="Blue Sky (?)"
                  align="right"
                  type="range"
                  filterKey="blueSky"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-cbva-navy cursor-pointer select-none"
                  style={{ ...widthStyle(COL_WIDTH.blueSky), background: HDR_BG }}
                  onSort={() => handleSort('blueSky')}
                  sortIcon={<SortIconCell field="blueSky" />}
                />
                <ColumnHeaderFilter
                  label="Total (?)"
                  align="right"
                  type="range"
                  filterKey="total"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-muted-foreground"
                  style={{ ...widthStyle(COL_WIDTH.total), background: HDR_BG }}
                />
                <ColumnHeaderFilter
                  label="Collected (?)"
                  align="right"
                  type="range"
                  filterKey="collected"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-muted-foreground"
                  style={{ ...widthStyle(COL_WIDTH.collected), background: HDR_BG }}
                />
                {collectionsOpen && <>
                  {selectedMonths.map((mk) => (
                    <React.Fragment key={mk}>
                      <ColumnHeaderFilter
                        label={`${MONTH_SHORT_NAMES[mk]} Plan`}
                        align="right"
                        type="monthRange"
                        monthKey={mk}
                        monthField="planned"
                        filters={filters}
                        setFilters={setFilters}
                        className="text-cbva-navy border-l border-border/40"
                        style={{ ...widthStyle(COL_WIDTH.monthSub), background: HDR_BG }}
                      />
                      <ColumnHeaderFilter
                        label={`${MONTH_SHORT_NAMES[mk]} Coll`}
                        align="right"
                        type="monthRange"
                        monthKey={mk}
                        monthField="collected"
                        filters={filters}
                        setFilters={setFilters}
                        className="text-emerald-700"
                        style={{ ...widthStyle(COL_WIDTH.monthSub), background: HDR_BG }}
                      />
                      <ColumnHeaderFilter
                        label="Var"
                        align="right"
                        type="monthRange"
                        monthKey={mk}
                        monthField="variance"
                        filters={filters}
                        setFilters={setFilters}
                        className="text-muted-foreground"
                        style={{ ...widthStyle(COL_WIDTH.monthSub), background: HDR_BG }}
                      />
                    </React.Fragment>
                  ))}
                  <ColumnHeaderFilter
                    label="Balance (?)"
                    align="right"
                    type="range"
                    filterKey="balance"
                    filters={filters}
                    setFilters={setFilters}
                    className="text-muted-foreground border-l border-border/40"
                    style={{ ...widthStyle(COL_WIDTH.balance), background: HDR_BG }}
                  />
                </>}
                {!collectionsOpen && (
                  <ColumnHeaderFilter
                    label="Balance (?)"
                    align="right"
                    type="range"
                    filterKey="balance"
                    filters={filters}
                    setFilters={setFilters}
                    className="text-muted-foreground border-l border-border/40"
                    style={{ ...widthStyle(COL_WIDTH.balance), background: HDR_BG }}
                  />
                )}
                <ColumnHeaderFilter
                  label="Remarks"
                  type="text"
                  filterKey="remarks"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-muted-foreground"
                  style={{ ...widthStyle(COL_WIDTH.remarks), background: HDR_BG }}
                />
                <th className="py-3 px-3" style={{ ...widthStyle(COL_WIDTH.expand), background: HDR_BG }}></th>
              </tr>
            </thead>
            <tbody className="relative z-0">
              <VirtualPadRow height={paddingTop} columns={columns} />
              {virtualRows.map((virtualRow) => {
                const client = filtered[virtualRow.index];
                const isExpanded = expandedRow === client.num;
                const actCount = actCountByClient.get(String(client.id)) || actCountByClient.get(client.num) || 0;
                const prevActualCollected = prevActualCollectedFor(client);
                return (
                  <React.Fragment key={client.id}>
                    <tr className={`[&>td]:border-b [&>td]:border-border/50 hover:bg-muted/20 transition-colors ${isExpanded ? 'bg-muted/10' : ''}`}>
                      <td className={`${stickyBase} left-0 py-3 px-3 text-xs text-muted-foreground ${stickyEdgeClass('num')}`} style={frozenBody('num')}>{client.num}</td>
                      <NameCell
                        value={client.name}
                        onChange={(v) => updateName(client.id, v)}
                        isExpanded={isExpanded}
                        actCount={actCount}
                        onToggleExpand={() => toggleExpandedRow(client.num)}
                        stickyClass={`${stickyBase} ${stickyEdgeClass('name')}`}
                        stickyStyle={frozenBody('name')}
                      />
                      {showScopeColumn && (
                        <ScopeCell
                          value={client.clientScope}
                          onChange={v => updateScope(client.id, v)}
                          stickyClass={`${stickyBase} ${stickyEdgeClass('scope')}`}
                          stickyStyle={frozenBody('scope')}
                          disabled={!canEdit}
                        />
                      )}
                      {showManager && (
                        <ManagerCell
                          value={client.manager}
                          onChange={v => updateManager(client.id, v)}
                          stickyClass={`${stickyBase} ${stickyEdgeClass('manager')}`}
                          stickyStyle={frozenBody('manager')}
                          options={managerOptions}
                          disabled={!canEdit}
                        />
                      )}
                      {showRelPartner && (
                        <RelPartnerCell
                          value={client.relPartner}
                          onChange={(v) => updateRelPartner(client.id, v)}
                          stickyClass={`${stickyBase} ${stickyEdgeClass('relPartner')}`}
                          stickyStyle={frozenBody('relPartner')}
                          options={relPartnerOptions}
                          disabled={!canEdit}
                        />
                      )}
                      {showElStatus && (
                        <ELStatusCell
                          value={client.elStatus}
                          onChange={(v) => updateElStatus(client.id, v)}
                          stickyClass={`${stickyBase} ${stickyEdgeClass('elStatus')}`}
                          stickyStyle={frozenBody('elStatus')}
                          disabled={!canEdit}
                        />
                      )}
                      <td className="py-3 px-3 text-right font-tabular text-xs text-emerald-800" title={prevActualCollected == null ? 'No confident prior-year match' : `Actual collected from ${prevFyLabel}`}>
                        {prevActualCollected == null ? <span className="text-muted-foreground/60 italic">TBD</span> : formatINRFull(prevActualCollected)}
                      </td>
                      <EditableCell value={client.green} onChange={v => updateField(client.id, 'green', v)} color="#00FF00" />
                      <EditableCell value={client.amber} onChange={v => updateField(client.id, 'amber', v)} color="#FF8800" />
                      <EditableCell value={client.blueSky} onChange={v => updateField(client.id, 'blueSky', v)} color={BLUE_SKY_BG} />
                      <td className="py-3 px-3 text-right font-tabular font-semibold text-foreground text-xs">{client.total ? formatINRFull(client.total) : '-'}</td>
                      <td
                        className="py-3 px-3 text-right font-tabular text-muted-foreground text-xs"
                        title="Sum of collection transactions"
                      >
                        {client.collected ? formatINRFull(client.collected) : '-'}
                      </td>
                      {collectionsOpen && <>
                        {selectedMonths.map((mk) => {
                          const planned = plannedForMonth(client, mk);
                          const collected = collectedForMonth(txMap, client.id, mk);
                          const variance = collected - planned;
                          return (
                            <React.Fragment key={mk}>
                              <EditableCell value={planned} onChange={v => updateMonthPlan(client.id, mk, v)} />
                              <CollectedMonthCell
                                value={collected}
                                pending={settingCollectedKey === `${client.id}:${mk}`}
                                onSetAmount={(amount) => setMonthCollected(client, mk, amount)}
                              />
                              <td className="py-3 px-3 text-right font-tabular text-xs">
                                {planned === 0 && collected === 0
                                  ? <span className="text-muted-foreground/50">-</span>
                                  : variance >= 0
                                    ? <span className="text-emerald-600">+{formatINRFull(variance)}</span>
                                    : <span className="text-red-600">({formatINRFull(Math.abs(variance))})</span>}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="py-3 px-3 text-right font-tabular text-xs border-l border-border/40">
                          {client.balance == null ? '-' : client.balance === 0 ? <span className="text-emerald-600">{formatINRFull(0)}</span> : <span className="text-red-600">{formatINRFull(client.balance)}</span>}
                        </td>
                      </>}
                      {!collectionsOpen && (
                        <td className="py-3 px-3 text-right font-tabular text-xs border-l border-border/40">
                          {client.balance == null ? '-' : client.balance === 0 ? <span className="text-emerald-600">{formatINRFull(0)}</span> : <span className="text-red-600">{formatINRFull(client.balance)}</span>}
                        </td>
                      )}
                      <RemarkCell value={client.remarks} onChange={v => updateRemarks(client.id, v)} />
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => toggleExpandedRow(client.num)}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} row details`}
                          className="text-muted-foreground hover:text-cbva-navy transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={bodyColSpan} className="border-b border-border/50 p-0">
                          <EngagementExpandedPanel
                            client={client}
                            actions={clientActions}
                            onAddAction={(payload) => {
                              if (!canEdit) {
                                toast.error('This fiscal year is locked for editing. Ask an admin to enable it in Admin Settings.');
                                return Promise.reject(new Error('locked'));
                              }
                              return addAction(payload);
                            }}
                            onDeleteAction={(id) => guardEdit(() => deleteAction(id))}
                            onUpdateRemarks={updateRemarks}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              <VirtualPadRow height={paddingBottom} columns={columns} />
            </tbody>
            <tfoot className="relative z-30">
              <tr className="bg-muted [&>td]:border-t-2 [&>td]:border-border">
                <td className={`${stickyFooterLeft} left-0 py-3 px-3 text-xs font-bold uppercase text-foreground ${stickyEdgeClass('num')}`} style={frozenBody('num')}></td>
                <td className={`${stickyFooterLeft} py-3 px-3 text-xs font-bold uppercase text-foreground ${stickyEdgeClass('name')}`} style={frozenBody('name')}>TOTAL</td>
                {showScopeColumn && <td className={`${stickyFooterLeft} py-3 px-3 ${stickyEdgeClass('scope')}`} style={frozenBody('scope')}></td>}
                {showManager && <td className={`${stickyFooterLeft} py-3 px-3 ${stickyEdgeClass('manager')}`} style={frozenBody('manager')}></td>}
                {showRelPartner && <td className={`${stickyFooterLeft} py-3 px-3 ${stickyEdgeClass('relPartner')}`} style={frozenBody('relPartner')}></td>}
                {showElStatus && <td className={`${stickyFooterLeft} py-3 px-3 ${stickyEdgeClass('elStatus')}`} style={frozenBody('elStatus')}></td>}
                <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-emerald-800 text-xs`}>{totals.prevActualCollected > 0 ? formatINRFull(totals.prevActualCollected) : '-'}</td>
                <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-black text-xs`} style={{ backgroundColor: '#00FF00' }}>{formatINRFull(totals.green)}</td>
                <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-black text-xs`} style={{ backgroundColor: '#FF8800' }}>{formatINRFull(totals.amber)}</td>
                <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-black text-xs`} style={{ backgroundColor: BLUE_SKY_BG }}>{formatINRFull(totals.blueSky)}</td>
                <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-foreground text-xs`}>{formatINRFull(totals.total)}</td>
                <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-slate-700 text-xs`}>{formatINRFull(totals.collected)}</td>
                {collectionsOpen && <>
                  {selectedMonths.map((mk) => {
                    const m = totals.months[mk] || { planned: 0, collected: 0, variance: 0 };
                    return (
                      <React.Fragment key={mk}>
                        <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-cbva-navy text-xs border-l border-border/40`}>{m.planned > 0 ? formatINRFull(m.planned) : '-'}</td>
                        <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-emerald-700 text-xs`}>{m.collected > 0 ? formatINRFull(m.collected) : '-'}</td>
                        <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-xs ${m.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {m.planned === 0 && m.collected === 0 ? '-' : (m.variance >= 0 ? `+${formatINRFull(m.variance)}` : `(${formatINRFull(Math.abs(m.variance))})`)}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-red-600 text-xs border-l border-border/40`}>{formatINRFull(totals.balance)}</td>
                </>}
                {!collectionsOpen && (
                  <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-red-600 text-xs border-l border-border/40`}>{formatINRFull(totals.balance)}</td>
                )}
                <td className={`${stickyFooter} py-3 px-3`}></td>
                <td className={`${stickyFooter} py-3 px-3`}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

export default EngagementsTable;

