import React, { useMemo, useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Plus, Filter, Edit2 } from 'lucide-react';
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
import { getPrevFySlug, getFyLabel } from '@/lib/fiscalYear';
import { formatINRFull } from '@/lib/formatCurrency';
import {
  DEFAULT_ENGAGEMENT_FILTERS,
  applyEngagementFilters,
  countActiveEngagementFilters,
  uniqueManagers,
  pruneMonthlyFilters,
} from '@/lib/engagementFilters';
import { uniqueRelationshipPartners, relationshipPartnerLabel } from '@/lib/relationshipPartners';
import { leaderHasClientScope, CLIENT_SCOPE_VALUES } from '@/lib/clientScope';
import { useEngagementChanges } from '@/hooks/useEngagementMeta';

const L = 100000;
const BLUE_SKY_BG = '#00CCFF';
const SCOPE_COL_WIDTH = 100;
const PREV_ACTUAL_COLLECTED_COL_WIDTH = 150;
const MONTH_SUB_COL_WIDTH = 80;

// Column order: #, client, [scope], manager, relPartner, elStatus, prevActualCollected,
// green, amber, blueSky, total, collected, [ (planned, collected, variance) x months ],
// balance, remarks, expand
function engagementColumnWidths(collectionsOpen, showScope, monthCount = 0) {
  const widths = [32, 180];
  if (showScope) widths.push(SCOPE_COL_WIDTH);
  widths.push(100, 100, 100);                 // manager, rel partner, el status
  widths.push(PREV_ACTUAL_COLLECTED_COL_WIDTH); // prior-FY actual collected
  widths.push(96, 96, 96, 96, 96);            // green, amber, blue sky, total, collected
  if (collectionsOpen) {
    for (let i = 0; i < monthCount; i += 1) {
      widths.push(MONTH_SUB_COL_WIDTH, MONTH_SUB_COL_WIDTH, MONTH_SUB_COL_WIDTH);
    }
  }
  widths.push(96);                            // balance
  widths.push(320, 32);                       // remarks, expand
  return widths;
}

function engagementTableMinWidth(collectionsOpen, showScope, monthCount = 0) {
  return engagementColumnWidths(collectionsOpen, showScope, monthCount).reduce((sum, width) => sum + width, 0);
}

function stickyLeftOffsets(showScope) {
  if (showScope) {
    return { client: 32, scope: 212, manager: 212 + SCOPE_COL_WIDTH, relPartner: 312 + SCOPE_COL_WIDTH, elStatus: 412 + SCOPE_COL_WIDTH };
  }
  return { client: 32, manager: 212, relPartner: 312, elStatus: 412 };
}

function EngagementColGroup({ collectionsOpen, showScope, monthCount }) {
  return (
    <colgroup>
      {engagementColumnWidths(collectionsOpen, showScope, monthCount).map((width, index) => (
        <col key={index} style={{ width, minWidth: width }} />
      ))}
    </colgroup>
  );
}

const EL_STATUS_OPTIONS = ['Signed', 'Not Signed', 'Waived', 'NA', 'DS', '—'];

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
      <div className="flex items-center gap-1.5 w-full">
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

function RelPartnerCell({ value, onChange, stickyClass, stickyStyle, suggestions = [] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const listId = 'engagement-rel-partner-suggestions';

  function startEdit() {
    setDraft(value || '');
    setEditing(true);
  }

  function commit() {
    const next = draft.trim();
    if (next !== (value || '').trim()) onChange(next);
    setEditing(false);
  }

  if (editing) {
    return (
      <td className={`${stickyClass} py-1 px-2`} style={stickyStyle}>
        <input
          autoFocus
          list={listId}
          className="w-full text-xs border border-cbva-navy rounded px-1.5 py-1 focus:outline-none bg-white"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </td>
    );
  }

  const label = relationshipPartnerLabel(value);
  return (
    <td
      className={`${stickyClass} py-3 px-3 text-xs text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors`}
      style={stickyStyle}
      onClick={startEdit}
      title="Click to edit relationship partner"
    >
      {label !== '-' ? (
        <span className="truncate block max-w-[90px]" title={label}>{label}</span>
      ) : (
        <span className="text-muted-foreground/60">-</span>
      )}
    </td>
  );
}

function ELStatusCell({ value, onChange, stickyClass, stickyStyle }) {
  return (
    <td className={`${stickyClass} py-2 px-1.5 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]`} style={{ ...stickyStyle, clipPath: 'inset(0 -15px 0 0)' }}>
      <select
        aria-label="EL status"
        title="Change EL status"
        className="w-full text-[10px] border border-transparent hover:border-border/60 rounded px-1 py-1 bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-cbva-navy/40"
        value={value || '—'}
        onChange={(e) => {
          if (e.target.value !== (value || '—')) onChange(e.target.value);
        }}
      >
        {EL_STATUS_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </td>
  );
}

function ManagerCell({ value, onChange, stickyClass, stickyStyle, listId }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function startEdit() {
    setDraft(value || '');
    setEditing(true);
  }

  function commit() {
    const next = draft.trim();
    if (next !== (value || '').trim()) onChange(next);
    setEditing(false);
  }

  if (editing) {
    return (
      <td className={`${stickyClass} py-1 px-2`} style={stickyStyle}>
        <input
          autoFocus
          list={listId}
          className="w-full text-xs border border-cbva-navy rounded px-1.5 py-1 focus:outline-none bg-white"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      </td>
    );
  }

  return (
    <td
      className={`${stickyClass} py-3 px-3 text-xs text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors group`}
      style={stickyStyle}
      onClick={startEdit}
      title="Click to edit manager"
    >
      {value ? (
        <span className="truncate block max-w-[90px]" title={value}>{value}</span>
      ) : (
        <span className="text-muted-foreground/60">-</span>
      )}
    </td>
  );
}

function ScopeCell({ value, onChange, stickyClass, stickyStyle }) {
  const scope = value || 'Domestic';
  const isIntl = scope === 'International';
  return (
    <td className={`${stickyClass} py-2 px-1.5`} style={stickyStyle}>
      <div className="relative w-full">
        <select
          aria-label="Client scope"
          title={scope}
          className={`appearance-none w-full text-[10px] font-medium rounded-full pl-2.5 pr-6 py-1 cursor-pointer border border-transparent hover:border-border/60 focus:outline-none focus:ring-1 focus:ring-cbva-navy/40 transition-colors ${
            isIntl ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-800'
          }`}
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
  const { clients, isLoading, isError, clientActions, addAction, deleteAction, updateEngagement, updateRemarks: updateRemarksApi } = useClientActions();
  const { selectedLeaderId, activeFY, fiscalYears } = useGlobalSelector();
  const { teamMembers } = useTeam(selectedLeaderId);
  const managerSuggestions = useMemo(
    () => [...new Set(teamMembers.map(m => m.full_name).filter(Boolean))].sort(),
    [teamMembers]
  );
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [expandedRow, setExpandedRow] = useState(null);
  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_ENGAGEMENT_FILTERS);

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
  const { data: transactions = [] } = useCollectionTransactions(selectedLeaderId, activeFY);
  const txMap = useMemo(() => groupTxByEngagementMonth(transactions), [transactions]);
  const addTransaction = useAddTransaction(selectedLeaderId, activeFY);
  const deleteTransaction = useDeleteTransaction(selectedLeaderId, activeFY);
  const [settingCollectedKey, setSettingCollectedKey] = useState(null);

  const managerOptions = useMemo(() => uniqueManagers(clients), [clients]);
  const relPartnerOptions = useMemo(() => uniqueRelationshipPartners(clients), [clients]);
  const elStatusOptions = useMemo(() => {
    const s = new Set(clients.map(c => c.elStatus).filter(Boolean));
    return Array.from(s).sort();
  }, [clients]);

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  }

  function SortIcon({ field }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;
    return sortDir === 'desc'
      ? <ArrowDown className="w-3 h-3 inline ml-1 text-cbva-navy" />
      : <ArrowUp className="w-3 h-3 inline ml-1 text-cbva-navy" />;
  }

  function toggleExpandedRow(num) {
    setExpandedRow((current) => (current === num ? null : num));
  }

  function updateField(clientId, field, newVal) {
    updateEngagement({ id: clientId, [field]: newVal });
  }

  function updateMonthPlan(clientId, monthKey, newVal) {
    updateEngagement({ id: clientId, monthlyPlan: { [monthKey]: newVal } });
  }

  function updateManager(clientId, val) {
    updateEngagement({ id: clientId, manager: val });
  }

  function updateScope(clientId, val) {
    updateEngagement({ id: clientId, clientScope: val });
  }

  function updateName(clientId, val) {
    updateEngagement({ id: clientId, name: val });
  }

  function updateRelPartner(clientId, val) {
    updateEngagement({ id: clientId, relPartner: val });
  }

  function updateElStatus(clientId, val) {
    updateEngagement({ id: clientId, elStatus: val });
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
    let list = applyEngagementFilters(clients, filters, { txMap, selectedMonths });

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
  }, [clients, sortField, sortDir, filters, txMap, selectedMonths]);

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

  const partnerOptions = useMemo(() => uniqueRelationshipPartners(clients), [clients]);
  const showScopeColumn = leaderHasClientScope(selectedLeaderId);
  const stickyLeft = stickyLeftOffsets(showScopeColumn);
  const monthCount = selectedMonths.length;
  const tableMinWidth = engagementTableMinWidth(collectionsOpen, showScopeColumn, monthCount);
  const bodyColSpan = 14 + (showScopeColumn ? 1 : 0) + (collectionsOpen ? monthCount * 3 : 0);

  const HDR_BG = '#F1F2F4';
  const stickyHeaderRow1 = 'sticky z-20 top-0';
  const stickyHeaderRow2 = 'sticky z-20';
  const stickyBase = 'sticky z-10 bg-white';
  const stickyFooter = 'sticky bottom-0 z-10 bg-muted';
  const stickyFooterLeft = 'sticky bottom-0 z-20 bg-muted';
  const thStyle = { top: 36, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  const activeFilterCount = countActiveEngagementFilters(filters, selectedMonths);

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
          <input
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring w-72"
            placeholder="Search clients..."
            value={filters.name}
            onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}
          />
          <span className="text-xs text-muted-foreground hidden sm:block">Click name, partner, EL, amounts, or month collected to edit · Chevron expands details</span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-cbva-navy text-white hover:bg-cbva-navy/90 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Engagement
        </button>
      </div>

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
          partnerOptions={partnerOptions}
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
        />
      )}

      {isLoading && (
        <div className="space-y-3 py-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-muted/40 rounded-lg animate-pulse" />
          ))}
        </div>
      )}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load engagements. Try refreshing the page.
        </div>
      )}

      {!isLoading && !isError && (
      <div className="bg-card rounded-xl border border-border/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {managerSuggestions.length > 0 && (
          <datalist id="engagement-manager-suggestions">
            {managerSuggestions.map(name => <option key={name} value={name} />)}
          </datalist>
        )}
        <div
          className="scrollbar-x-none overflow-auto"
          style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 230px)', minHeight: '500px' }}
        >
          <table className="text-sm border-separate" style={{ minWidth: tableMinWidth, borderSpacing: 0, tableLayout: 'fixed' }}>
            <EngagementColGroup collectionsOpen={collectionsOpen} showScope={showScopeColumn} monthCount={monthCount} />
            <thead>
              <tr style={{ background: HDR_BG, height: 36 }}>
                <th className={`${stickyHeaderRow1} left-0 border-b-0`} style={{ minWidth: 32, width: 32, background: HDR_BG }}></th>
                <th className={`${stickyHeaderRow1} border-b-0`} style={{ left: stickyLeft.client, minWidth: 180, width: 180, background: HDR_BG }}></th>
                {showScopeColumn && (
                  <th className={`${stickyHeaderRow1} border-b-0`} style={{ left: stickyLeft.scope, minWidth: SCOPE_COL_WIDTH, width: SCOPE_COL_WIDTH, background: HDR_BG }}></th>
                )}
                <th className={`${stickyHeaderRow1} border-b-0`} style={{ left: stickyLeft.manager, minWidth: 100, width: 100, background: HDR_BG }}></th>
                <th className={`${stickyHeaderRow1} border-b-0`} style={{ left: stickyLeft.relPartner, minWidth: 100, width: 100, background: HDR_BG }}></th>
                <th className={`${stickyHeaderRow1} border-b-0 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]`} style={{ left: stickyLeft.elStatus, minWidth: 100, width: 100, background: HDR_BG, clipPath: 'inset(0 -15px 0 0)' }}></th>
                <th colSpan={5} className="border-b-0" style={{ minWidth: 570, background: HDR_BG, position: 'sticky', top: 0, zIndex: 5 }}></th>
                <th className="text-center py-1 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border/50" style={{ minWidth: 120, background: HDR_BG, position: 'sticky', top: 0, zIndex: 5 }}>
                  Collected <span className="font-normal normal-case">(Finance Actuals)</span>
                </th>
                {collectionsOpen && (
                  <th colSpan={monthCount * 3 + 1} className="text-center py-1 px-3 text-[10px] uppercase tracking-wider text-cbva-navy font-semibold border-b border-border/50 border-l border-border/40" style={{ background: HDR_BG, position: 'sticky', top: 0, zIndex: 5 }}>
                    Planned vs Collected{' '}
                    <span className="font-normal text-blue-400 normal-case">(Forecast vs Actuals)</span>
                    <button onClick={() => setCollectionsOpen(false)} className="ml-2 text-cbva-navy hover:text-cbva-navy/80 font-medium inline-flex"><ChevronDown className="w-3 h-3" /></button>
                  </th>
                )}
                {!collectionsOpen && (
                  <th className="text-center py-1 px-3 text-[10px] text-cbva-navy font-semibold border-b border-border/50 border-l border-border/40 whitespace-nowrap" style={{ background: HDR_BG, position: 'sticky', top: 0, zIndex: 5 }}>
                    Planned vs Collected
                    <button onClick={() => setCollectionsOpen(true)} className="ml-2 text-cbva-navy hover:text-cbva-navy/80 font-medium inline-flex"><ChevronRight className="w-3 h-3" /></button>
                  </th>
                )}
                <th colSpan={2} className="border-b-0" style={{ background: HDR_BG, position: 'sticky', top: 0, zIndex: 5 }}></th>
              </tr>
              <tr className="[&>th]:border-b [&>th]:border-border" style={{ background: HDR_BG }}>
                <th className={`${stickyHeaderRow2} left-0 text-left py-3 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium`} style={{ minWidth: 32, width: 32, top: 36, background: HDR_BG }}>#</th>
                <ColumnHeaderFilter
                  label="Client Name"
                  type="text"
                  filterKey="name"
                  filters={filters}
                  setFilters={setFilters}
                  className={`${stickyHeaderRow2} text-muted-foreground`}
                  style={{ left: stickyLeft.client, minWidth: 180, width: 180, top: 36, background: HDR_BG }}
                />
                {showScopeColumn && (
                  <ColumnHeaderFilter
                    label="Scope"
                    type="multi"
                    filterKey="clientScope"
                    filters={filters}
                    setFilters={setFilters}
                    options={CLIENT_SCOPE_VALUES}
                    className={`${stickyHeaderRow2} text-muted-foreground`}
                    style={{ left: stickyLeft.scope, minWidth: SCOPE_COL_WIDTH, width: SCOPE_COL_WIDTH, top: 36, background: HDR_BG }}
                  />
                )}
                <ColumnHeaderFilter
                  label="Manager"
                  type="multi"
                  filterKey="manager"
                  filters={filters}
                  setFilters={setFilters}
                  options={managerOptions}
                  includeEmpty
                  className={`${stickyHeaderRow2} text-muted-foreground`}
                  style={{ left: stickyLeft.manager, minWidth: 100, width: 100, top: 36, background: HDR_BG }}
                />
                <ColumnHeaderFilter
                  label="Rel. Partner"
                  type="multi"
                  filterKey="relPartner"
                  filters={filters}
                  setFilters={setFilters}
                  options={relPartnerOptions}
                  includeEmpty
                  className={`${stickyHeaderRow2} text-muted-foreground`}
                  style={{ left: stickyLeft.relPartner, minWidth: 100, width: 100, top: 36, background: HDR_BG }}
                />
                <ColumnHeaderFilter
                  label="EL Status"
                  type="multi"
                  filterKey="elStatus"
                  filters={filters}
                  setFilters={setFilters}
                  options={elStatusOptions}
                  includeEmpty
                  className={`${stickyHeaderRow2} text-muted-foreground shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]`}
                  style={{ left: stickyLeft.elStatus, minWidth: 100, width: 100, top: 36, background: HDR_BG, clipPath: 'inset(0 -15px 0 0)' }}
                />
                <th
                  className="text-right py-3 px-3 text-[11px] uppercase tracking-wider text-emerald-800 font-medium"
                  style={{ minWidth: PREV_ACTUAL_COLLECTED_COL_WIDTH, width: PREV_ACTUAL_COLLECTED_COL_WIDTH, top: 36, position: 'sticky', zIndex: 5, background: HDR_BG }}
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
                  style={{ minWidth: 110, width: 110, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                  onSort={() => handleSort('green')}
                  sortIcon={<SortIcon field="green" />}
                />
                <ColumnHeaderFilter
                  label="Amber (?)"
                  align="right"
                  type="range"
                  filterKey="amber"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-amber-600 cursor-pointer select-none"
                  style={{ minWidth: 110, width: 110, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                  onSort={() => handleSort('amber')}
                  sortIcon={<SortIcon field="amber" />}
                />
                <ColumnHeaderFilter
                  label="Blue Sky (?)"
                  align="right"
                  type="range"
                  filterKey="blueSky"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-cbva-navy cursor-pointer select-none"
                  style={{ minWidth: 120, width: 120, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                  onSort={() => handleSort('blueSky')}
                  sortIcon={<SortIcon field="blueSky" />}
                />
                <ColumnHeaderFilter
                  label="Total (?)"
                  align="right"
                  type="range"
                  filterKey="total"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-muted-foreground"
                  style={{ minWidth: 110, width: 110, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                />
                <ColumnHeaderFilter
                  label="Collected (?)"
                  align="right"
                  type="range"
                  filterKey="collected"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-muted-foreground"
                  style={{ minWidth: 120, width: 120, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
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
                        style={{ minWidth: MONTH_SUB_COL_WIDTH, width: MONTH_SUB_COL_WIDTH, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
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
                        style={{ minWidth: MONTH_SUB_COL_WIDTH, width: MONTH_SUB_COL_WIDTH, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
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
                        style={{ minWidth: MONTH_SUB_COL_WIDTH, width: MONTH_SUB_COL_WIDTH, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
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
                    style={{ minWidth: 110, width: 110, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
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
                    style={{ minWidth: 110, width: 110, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                  />
                )}
                <ColumnHeaderFilter
                  label="Remarks"
                  type="text"
                  filterKey="remarks"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-muted-foreground"
                  style={{ minWidth: 320, width: 320, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                />
                <th className="py-3 px-3" style={{ minWidth: 32, width: 32, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client, i) => {
                const isExpanded = expandedRow === client.num;
                const actCount = clientActions.filter(a => a.clientNum === client.num && a.status !== 'Done').length;
                const prevActualCollected = prevActualCollectedFor(client);
                return (
                  <React.Fragment key={i}>
                    <tr className={`[&>td]:border-b [&>td]:border-border/50 hover:bg-muted/20 transition-colors ${isExpanded ? 'bg-muted/10' : ''}`}>
                      <td className={`${stickyBase} left-0 py-3 px-3 text-xs text-muted-foreground`} style={{ minWidth: 32 }}>{client.num}</td>
                      <NameCell
                        value={client.name}
                        onChange={(v) => updateName(client.id, v)}
                        isExpanded={isExpanded}
                        actCount={actCount}
                        onToggleExpand={() => toggleExpandedRow(client.num)}
                        stickyClass={stickyBase}
                        stickyStyle={{ left: stickyLeft.client, minWidth: 180 }}
                      />
                      {showScopeColumn && (
                        <ScopeCell
                          value={client.clientScope}
                          onChange={v => updateScope(client.id, v)}
                          stickyClass={stickyBase}
                          stickyStyle={{ left: stickyLeft.scope, minWidth: SCOPE_COL_WIDTH }}
                        />
                      )}
                      <ManagerCell
                        value={client.manager}
                        onChange={v => updateManager(client.id, v)}
                        stickyClass={stickyBase}
                        stickyStyle={{ left: stickyLeft.manager, minWidth: 100 }}
                        listId="engagement-manager-suggestions"
                      />
                      <RelPartnerCell
                        value={client.relPartner}
                        onChange={(v) => updateRelPartner(client.id, v)}
                        stickyClass={stickyBase}
                        stickyStyle={{ left: stickyLeft.relPartner, minWidth: 100 }}
                        suggestions={relPartnerOptions}
                      />
                      <ELStatusCell
                        value={client.elStatus}
                        onChange={(v) => updateElStatus(client.id, v)}
                        stickyClass={stickyBase}
                        stickyStyle={{ left: stickyLeft.elStatus, minWidth: 100 }}
                      />
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
                            onAddAction={addAction}
                            onDeleteAction={deleteAction}
                            onUpdateRemarks={updateRemarks}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted [&>td]:border-t-2 [&>td]:border-border">
                <td className={`${stickyFooterLeft} left-0 py-3 px-3 text-xs font-bold uppercase text-foreground`} style={{ minWidth: 32 }}></td>
                <td className={`${stickyFooterLeft} py-3 px-3 text-xs font-bold uppercase text-foreground`} style={{ left: stickyLeft.client, minWidth: 180 }}>TOTAL</td>
                {showScopeColumn && <td className={`${stickyFooterLeft} py-3 px-3`} style={{ left: stickyLeft.scope, minWidth: SCOPE_COL_WIDTH }}></td>}
                <td className={`${stickyFooterLeft} py-3 px-3`} style={{ left: stickyLeft.manager, minWidth: 100 }}></td>
                <td className={`${stickyFooterLeft} py-3 px-3`} style={{ left: stickyLeft.relPartner, minWidth: 100 }}></td>
                <td className={`${stickyFooterLeft} py-3 px-3 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]`} style={{ left: stickyLeft.elStatus, minWidth: 100, clipPath: 'inset(0 -15px 0 0)' }}></td>
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

