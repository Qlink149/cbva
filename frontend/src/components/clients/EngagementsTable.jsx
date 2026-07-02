import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Plus, Filter, Edit2 } from 'lucide-react';
import ClientRowExpanded from '@/components/clients/ClientRowExpanded';
import AddEngagementModal from '@/components/clients/AddEngagementModal';
import ClientFilterPanel from '@/components/clients/ClientFilterPanel';
import { ColumnHeaderFilter } from '@/components/clients/ColumnHeaderFilter';
import { useClientActions } from '@/lib/ClientActionsContext';
import { useGlobalSelector } from '@/lib/GlobalSelectorContext';
import { useTeam } from '@/hooks/useTeam';
import { formatINRFull } from '@/lib/formatCurrency';
import {
  DEFAULT_ENGAGEMENT_FILTERS,
  applyEngagementFilters,
  countActiveEngagementFilters,
  uniqueManagers,
} from '@/lib/engagementFilters';
import { uniqueRelationshipPartners, relationshipPartnerLabel } from '@/lib/relationshipPartners';
import { leaderHasClientScope, CLIENT_SCOPE_VALUES } from '@/lib/clientScope';
import { useEngagementChanges } from '@/hooks/useEngagementMeta';

const L = 100000;
const BLUE_SKY_BG = '#00CCFF';
const SCOPE_COL_WIDTH = 100;
const ENGAGEMENT_COLUMN_WIDTHS_OPEN = [32, 180, 100, 100, 100, 110, 110, 120, 110, 120, 100, 100, 100, 110, 160, 32];
const ENGAGEMENT_COLUMN_WIDTHS_CLOSED = [32, 180, 100, 100, 100, 110, 110, 120, 110, 120, 110, 160, 32];

function engagementColumnWidths(collectionsOpen, showScope) {
  const widths = [...(collectionsOpen ? ENGAGEMENT_COLUMN_WIDTHS_OPEN : ENGAGEMENT_COLUMN_WIDTHS_CLOSED)];
  if (showScope) widths.splice(2, 0, SCOPE_COL_WIDTH);
  return widths;
}

function engagementTableMinWidth(collectionsOpen, showScope) {
  return engagementColumnWidths(collectionsOpen, showScope).reduce((sum, width) => sum + width, 0);
}

function stickyLeftOffsets(showScope) {
  if (showScope) {
    return { client: 32, scope: 212, manager: 212 + SCOPE_COL_WIDTH, relPartner: 312 + SCOPE_COL_WIDTH, elStatus: 412 + SCOPE_COL_WIDTH };
  }
  return { client: 32, manager: 212, relPartner: 312, elStatus: 412 };
}

function EngagementColGroup({ collectionsOpen, showScope }) {
  return (
    <colgroup>
      {engagementColumnWidths(collectionsOpen, showScope).map((width, index) => (
        <col key={index} style={{ width, minWidth: width }} />
      ))}
    </colgroup>
  );
}

function ELBadge({ status }) {
  if (status === 'Signed') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-green-bg text-status-green">Signed</span>;
  if (status === 'Not Signed') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-status-red-bg text-status-red">Not Signed</span>;
  if (status === 'Waived') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">Waived</span>;
  if (status && status.includes('/')) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700">{status}</span>;
  return <span className="text-xs text-muted-foreground">{status || '-'}</span>;
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
          className="absolute z-50 top-2 right-2 bg-white border border-border shadow-xl rounded-xl p-3 w-[260px] animate-in fade-in zoom-in-95 duration-100"
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
           <span className="text-xs text-foreground truncate max-w-[130px]" title={value}>{value}</span>
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
  const { selectedLeaderId, activeFY } = useGlobalSelector();
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

  function updateCollected(clientId, newVal) {
    updateEngagement({ id: clientId, collected: newVal });
  }

  function updateMonthCol(clientId, field, newVal) {
    updateEngagement({ id: clientId, [field]: newVal });
  }

  function updateManager(clientId, val) {
    updateEngagement({ id: clientId, manager: val });
  }

  function updateScope(clientId, val) {
    updateEngagement({ id: clientId, clientScope: val });
  }

  function updateRemarks(clientId, val, mode = 'edit') {
    updateRemarksApi({ id: clientId, remarks: val, mode });
  }

  const filtered = useMemo(() => {
    let list = applyEngagementFilters(clients, filters);

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
  }, [clients, sortField, sortDir, filters]);

  const totals = useMemo(() => {
    const green = filtered.reduce((s, c) => s + (c.green || 0), 0);
    const amber = filtered.reduce((s, c) => s + (c.amber || 0), 0);
    const blueSky = filtered.reduce((s, c) => s + (c.blueSky || 0), 0);
    return {
      green,
      amber,
      blueSky,
      total: green + amber + blueSky,
      collected: filtered.reduce((s, c) => s + (c.collected || 0), 0),
      balance: filtered.reduce((s, c) => s + (c.balance || 0), 0),
      may: filtered.reduce((s, c) => s + (c.mayCol || 0), 0),
      june: filtered.reduce((s, c) => s + (c.juneCol || 0), 0),
      july: filtered.reduce((s, c) => s + (c.julyCol || 0), 0),
    };
  }, [filtered]);

  const partnerOptions = useMemo(() => uniqueRelationshipPartners(clients), [clients]);
  const showScopeColumn = leaderHasClientScope(selectedLeaderId);
  const stickyLeft = stickyLeftOffsets(showScopeColumn);
  const tableMinWidth = engagementTableMinWidth(collectionsOpen, showScopeColumn);
  const bodyColSpan = (collectionsOpen ? 16 : 13) + (showScopeColumn ? 1 : 0);

  const HDR_BG = '#F1F2F4';
  const stickyHeaderRow1 = 'sticky z-20 top-0';
  const stickyHeaderRow2 = 'sticky z-20';
  const stickyBase = 'sticky z-10 bg-white';
  const stickyFooter = 'sticky bottom-0 z-10 bg-muted';
  const stickyFooterLeft = 'sticky bottom-0 z-20 bg-muted';
  const thStyle = { top: 36, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  const activeFilterCount = countActiveEngagementFilters(filters);

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
          <span className="text-xs text-muted-foreground hidden sm:block">Click any number to edit inline · Click client name to expand details</span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-cbva-navy text-white hover:bg-cbva-navy/90 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Engagement
        </button>
      </div>

      {showAddModal && (
        <AddEngagementModal
          nextNum={clients.length + 1}
          onClose={() => setShowAddModal(false)}
          partnerOptions={partnerOptions}
          showScopeField={showScopeColumn}
        />
      )}

      {showFilters && <ClientFilterPanel clients={clients} filters={filters} setFilters={setFilters} showScope={showScopeColumn} />}

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
            <EngagementColGroup collectionsOpen={collectionsOpen} showScope={showScopeColumn} />
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
                <th colSpan={4} className="border-b-0" style={{ minWidth: 440, background: HDR_BG, position: 'sticky', top: 0, zIndex: 5 }}></th>
                <th className="text-center py-1 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border/50" style={{ minWidth: 120, background: HDR_BG, position: 'sticky', top: 0, zIndex: 5 }}>
                  Collected <span className="font-normal normal-case">(Finance Actuals)</span>
                </th>
                {collectionsOpen && (
                  <th colSpan={4} className="text-center py-1 px-3 text-[10px] uppercase tracking-wider text-cbva-navy font-semibold border-b border-border/50 border-l border-border/40" style={{ background: HDR_BG, position: 'sticky', top: 0, zIndex: 5 }}>
                    To Be Collected{' '}
                    <span className="font-normal text-blue-400 normal-case">(Leader Forecast)</span>
                    <button onClick={() => setCollectionsOpen(false)} className="ml-2 text-cbva-navy hover:text-cbva-navy/80 font-medium inline-flex"><ChevronDown className="w-3 h-3" /></button>
                  </th>
                )}
                {!collectionsOpen && (
                  <th className="text-center py-1 px-3 text-[10px] text-cbva-navy font-semibold border-b border-border/50 border-l border-border/40 whitespace-nowrap" style={{ background: HDR_BG, position: 'sticky', top: 0, zIndex: 5 }}>
                    To Be Collected
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
                <ColumnHeaderFilter
                  label="Green (₹)"
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
                  label="Amber (₹)"
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
                  label="Blue Sky (₹)"
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
                  label="Total (₹)"
                  align="right"
                  type="range"
                  filterKey="total"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-muted-foreground"
                  style={{ minWidth: 110, width: 110, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                />
                <ColumnHeaderFilter
                  label="Collected (₹)"
                  align="right"
                  type="range"
                  filterKey="collected"
                  filters={filters}
                  setFilters={setFilters}
                  className="text-muted-foreground"
                  style={{ minWidth: 120, width: 120, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                />
                {collectionsOpen && <>
                  <ColumnHeaderFilter
                    label="May (₹)"
                    align="right"
                    type="range"
                    filterKey="mayCol"
                    filters={filters}
                    setFilters={setFilters}
                    className="text-cbva-navy border-l border-border/40"
                    style={{ minWidth: 100, width: 100, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                  />
                  <ColumnHeaderFilter
                    label="June (₹)"
                    align="right"
                    type="range"
                    filterKey="juneCol"
                    filters={filters}
                    setFilters={setFilters}
                    className="text-cbva-navy"
                    style={{ minWidth: 100, width: 100, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                  />
                  <ColumnHeaderFilter
                    label="July (₹)"
                    align="right"
                    type="range"
                    filterKey="julyCol"
                    filters={filters}
                    setFilters={setFilters}
                    className="text-cbva-navy"
                    style={{ minWidth: 100, width: 100, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                  />
                  <ColumnHeaderFilter
                    label="Balance (₹)"
                    align="right"
                    type="range"
                    filterKey="balance"
                    filters={filters}
                    setFilters={setFilters}
                    className="text-muted-foreground border-r border-border/40"
                    style={{ minWidth: 110, width: 110, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                  />
                </>}
                {!collectionsOpen && (
                  <ColumnHeaderFilter
                    label="Balance (₹)"
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
                  style={{ minWidth: 160, width: 160, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}
                />
                <th className="py-3 px-3" style={{ minWidth: 32, width: 32, position: 'sticky', top: 36, zIndex: 5, background: HDR_BG }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client, i) => {
                const isExpanded = expandedRow === client.num;
                const actCount = clientActions.filter(a => a.clientNum === client.num && a.status !== 'Done').length;
                return (
                  <React.Fragment key={i}>
                    <tr className={`[&>td]:border-b [&>td]:border-border/50 hover:bg-muted/20 transition-colors ${isExpanded ? 'bg-muted/10' : ''}`}>
                      <td className={`${stickyBase} left-0 py-3 px-3 text-xs text-muted-foreground`} style={{ minWidth: 32 }}>{client.num}</td>
                      <td className={`${stickyBase} py-3 px-3 font-medium text-foreground`} style={{ left: 32, minWidth: 180 }}>
                        <button
                          type="button"
                          onClick={() => toggleExpandedRow(client.num)}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${client.name || 'client'}`}
                          className="flex items-center gap-1.5 text-left w-full group rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/40 transition-colors"
                        >
                          <span className="text-muted-foreground group-hover:text-cbva-navy transition-colors shrink-0">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </span>
                          <span className={`truncate group-hover:text-cbva-navy group-hover:underline underline-offset-2 ${isExpanded ? 'text-cbva-navy' : 'text-foreground'}`}>
                            {client.name || <span className="text-muted-foreground italic no-underline">Unidentified</span>}
                          </span>
                          {actCount > 0 && (
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-cbva-navy text-white text-[9px] font-bold shrink-0">
                              {actCount}
                            </span>
                          )}
                        </button>
                      </td>
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
                      <td className={`${stickyBase} py-3 px-3 text-xs text-muted-foreground`} style={{ left: stickyLeft.relPartner, minWidth: 100 }}>{relationshipPartnerLabel(client.relPartner)}</td>
                      <td className={`${stickyBase} py-3 px-3 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]`} style={{ left: stickyLeft.elStatus, minWidth: 100, clipPath: 'inset(0 -15px 0 0)' }}><ELBadge status={client.elStatus} /></td>
                      <EditableCell value={client.green} onChange={v => updateField(client.id, 'green', v)} color="#00FF00" />
                      <EditableCell value={client.amber} onChange={v => updateField(client.id, 'amber', v)} color="#FF8800" />
                      <EditableCell value={client.blueSky} onChange={v => updateField(client.id, 'blueSky', v)} color={BLUE_SKY_BG} />
                      <td className="py-3 px-3 text-right font-tabular font-semibold text-foreground text-xs">{client.total ? formatINRFull(client.total) : '-'}</td>
                      <EditableCell value={client.collected} onChange={v => updateCollected(client.id, v)} />
                      {collectionsOpen && <>
                        <EditableCell value={client.mayCol} onChange={v => updateMonthCol(client.id, 'mayCol', v)} />
                        <EditableCell value={client.juneCol} onChange={v => updateMonthCol(client.id, 'juneCol', v)} />
                        <EditableCell value={client.julyCol} onChange={v => updateMonthCol(client.id, 'julyCol', v)} />
                        <td className="py-3 px-3 text-right font-tabular text-xs">
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
                <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-black text-xs`} style={{ backgroundColor: '#00FF00' }}>{formatINRFull(totals.green)}</td>
                <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-black text-xs`} style={{ backgroundColor: '#FF8800' }}>{formatINRFull(totals.amber)}</td>
                <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-black text-xs`} style={{ backgroundColor: BLUE_SKY_BG }}>{formatINRFull(totals.blueSky)}</td>
                <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-foreground text-xs`}>{formatINRFull(totals.total)}</td>
                <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-slate-700 text-xs`}>{formatINRFull(totals.collected)}</td>
                {collectionsOpen && <>
                  <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-cbva-navy text-xs border-l border-border/40`}>{totals.may > 0 ? formatINRFull(totals.may) : '-'}</td>
                  <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-cbva-navy text-xs`}>{totals.june > 0 ? formatINRFull(totals.june) : '-'}</td>
                  <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-cbva-navy text-xs`}>{totals.july > 0 ? formatINRFull(totals.july) : '-'}</td>
                  <td className={`${stickyFooter} py-3 px-3 text-right font-tabular font-bold text-red-600 text-xs border-r border-border/40`}>{formatINRFull(totals.balance)}</td>
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
