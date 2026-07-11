import React from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, ChevronDown, ChevronRight, Eye, Users,
} from 'lucide-react';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatINR } from '@/lib/formatCurrency';
import { getReportsToName } from '@/lib/teamHierarchy';

const STATUS_DOT = {
  Active: 'bg-emerald-500 animate-pulse',
  'On Notice': 'bg-amber-500',
  Inactive: 'bg-muted-foreground',
};

function StatusDot({ status }) {
  return <span className={`h-1.5 w-1.5 rounded-full mt-1 shrink-0 ${STATUS_DOT[status] || 'bg-muted-foreground'}`} />;
}

export function RootNode({ title, subtitle, isHighlighted, onClick }) {
  return (
    <motion.div
      onClick={onClick}
      className={`rounded-2xl bg-card border text-foreground p-4 text-center cursor-pointer shadow-xl transition-all duration-300 select-none flex flex-col justify-center items-center h-[80px] ${isHighlighted ? 'border-indigo-400 ring-2 ring-indigo-400/40 scale-105' : 'border-border hover:bg-muted/30'}`}
      whileHover={{ y: -3, scale: 1.02 }}
    >
      <div className="mx-auto h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-400/25 flex items-center justify-center mb-1.5 shadow-sm">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="text-xs font-bold uppercase tracking-wider opacity-60">{subtitle || 'Organisation'}</p>
      <h3 className="text-sm font-extrabold tracking-tight">{title}</h3>
    </motion.div>
  );
}

function ExpandPill({ isExpanded, childCount, onToggle, colorClass }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 z-20 h-6 px-3 rounded-full border text-[10px] font-bold shadow-md flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer hover:shadow-lg ${isExpanded ? `${colorClass} border-current/35 bg-current/5` : 'text-muted-foreground hover:text-foreground hover:bg-muted border-border'}`}
    >
      {isExpanded
        ? <><ChevronDown className="h-3.5 w-3.5" /><span>Collapse</span></>
        : <><ChevronRight className="h-3.5 w-3.5" /><span>Expand ({childCount})</span></>}
    </button>
  );
}

export function L1Card({ data, isExpanded, isHighlighted, childCount, onToggleExpand, onOpenDrawer, showExpand = true }) {
  const isTier = data.isTier;
  const isLeader = data.isLeader;
  const label = isTier ? 'Designation Tier' : isLeader ? 'Business Leader' : data.designation || 'Senior Staff';
  const color = isLeader ? 'indigo' : 'indigo';

  return (
    <motion.div
      className={`rounded-2xl border bg-card p-4.5 space-y-3 shadow-md hover:shadow-xl transition-all duration-300 relative ${isHighlighted ? `border-${color}-500 ring-2 ring-${color}-500/30 scale-[1.02]` : 'border-border hover:border-indigo-500/30'}`}
      whileHover={{ y: -3 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-bold flex items-center justify-center shadow-inner">
            {isTier ? <Users className="h-4 w-4" /> : (data.name?.[0] || '?')}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold truncate text-foreground hover:text-indigo-500 transition-colors cursor-pointer" onClick={onOpenDrawer}>
              {data.name}
            </h4>
            <p className="text-[10px] text-muted-foreground truncate">{label}</p>
          </div>
        </div>
        <StatusDot status={data.status} />
      </div>
      <div className="flex items-center justify-between text-[10px] border-t pt-2.5 border-border">
        <span className="text-muted-foreground font-semibold">
          {childCount} {isTier ? 'members' : 'direct reports'}
          {data.hiringCount > 0 && <span className="text-status-amber ml-1">· {data.hiringCount} open</span>}
        </span>
        {!isTier && (
          <button onClick={onOpenDrawer} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-muted-foreground/10" title="View Details">
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {showExpand && childCount > 0 && (
        <ExpandPill isExpanded={isExpanded} childCount={childCount} onToggle={onToggleExpand} colorClass="text-indigo-500" />
      )}
    </motion.div>
  );
}

export function L2Card({ data, isExpanded, isHighlighted, childCount, onToggleExpand, onOpenDrawer, showExpand = true }) {
  return (
    <motion.div
      className={`rounded-2xl border bg-card p-4.5 space-y-3 shadow-md hover:shadow-xl transition-all duration-300 relative ${isHighlighted ? 'border-emerald-500 ring-2 ring-emerald-500/30 scale-[1.02]' : 'border-border hover:border-emerald-500/30'}`}
      whileHover={{ y: -3 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold flex items-center justify-center shadow-inner">
            {data.name?.[0] || '?'}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold truncate text-foreground hover:text-emerald-500 transition-colors cursor-pointer" onClick={onOpenDrawer}>
              {data.name}
            </h4>
            <p className="text-[10px] text-muted-foreground truncate">{data.designation || data.email || 'Team Member'}</p>
          </div>
        </div>
        <StatusDot status={data.status} />
      </div>
      <div className="flex items-center justify-between text-[10px] border-t pt-2.5 border-border">
        <span className="text-muted-foreground font-semibold">{childCount} reports</span>
        <button onClick={onOpenDrawer} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-muted-foreground/10" title="View Details">
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>
      {showExpand && childCount > 0 && (
        <ExpandPill isExpanded={isExpanded} childCount={childCount} onToggle={onToggleExpand} colorClass="text-emerald-500" />
      )}
    </motion.div>
  );
}

export function L3Card({ data, isExpanded, isHighlighted, childCount, onToggleExpand, onOpenDrawer, showExpand = true }) {
  return (
    <motion.div
      className={`rounded-2xl border bg-card p-4.5 space-y-3 shadow-md hover:shadow-xl transition-all duration-300 relative ${isHighlighted ? 'border-violet-500 ring-2 ring-violet-500/30 scale-[1.02]' : 'border-border hover:border-violet-500/30'}`}
      whileHover={{ y: -3 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/20 font-bold flex items-center justify-center shadow-inner">
            {(data.title || data.name)?.[0] || '?'}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold truncate text-foreground hover:text-violet-500 transition-colors cursor-pointer" onClick={onOpenDrawer}>
              {data.title || data.name}
            </h4>
            <p className="text-[10px] text-muted-foreground truncate">{data.designation || 'Team Member'}</p>
          </div>
        </div>
        <StatusDot status={data.status} />
      </div>
      <div className="flex items-center justify-between text-[10px] border-t pt-2.5 border-border">
        <span className="text-muted-foreground font-semibold">{childCount} reports</span>
        <button onClick={onOpenDrawer} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-muted-foreground/10" title="View Details">
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>
      {showExpand && childCount > 0 && (
        <ExpandPill isExpanded={isExpanded} childCount={childCount} onToggle={onToggleExpand} colorClass="text-violet-500" />
      )}
    </motion.div>
  );
}

export function L4Card({ data, isHighlighted, onOpenDrawer }) {
  const overdue = data.joining_date && new Date(data.joining_date) < new Date();
  return (
    <motion.div
      className={`rounded-2xl border bg-card p-4.5 space-y-3 shadow-md hover:shadow-xl transition-all duration-300 relative ${isHighlighted ? 'border-sky-500 ring-2 ring-sky-500/30 scale-[1.02]' : 'border-border hover:border-sky-500/30'}`}
      whileHover={{ y: -3 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20 font-bold flex items-center justify-center shadow-inner">
            {(data.title || data.name)?.[0] || '?'}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold truncate text-foreground hover:text-sky-500 transition-colors cursor-pointer" onClick={onOpenDrawer}>
              {data.title || data.name}
            </h4>
            <p className="text-[10px] text-muted-foreground truncate">{data.designation || 'Team Member'}</p>
          </div>
        </div>
        <StatusDot status={data.status} />
      </div>
      <div className="flex items-center justify-between text-[10px] border-t pt-2.5 border-border">
        <span className={`font-semibold ${overdue ? 'text-red-500' : 'text-muted-foreground'}`}>
          {data.joining_date ? `Joined ${data.joining_date}` : data.status}
        </span>
        <button onClick={onOpenDrawer} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-muted-foreground/10" title="View Details">
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

const TYPE_LABELS = {
  l1: 'Tier / Leader',
  l2: 'Manager / Member',
  l3: 'Team Member',
  l4: 'Junior Staff',
};

export function EntityDetailsDrawer({ entityType, data, hierarchy, onClose }) {
  const member = data?.raw || data;
  const reportsTo = getReportsToName(
    member,
    hierarchy?.memberById,
    hierarchy?.rootTitle,
  );

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
        <SheetTitle className="text-lg">{member?.full_name || member?.name || data?.title || 'Details'}</SheetTitle>
        <p className="text-xs text-muted-foreground">{TYPE_LABELS[entityType] || entityType}</p>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {member?.designation && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Designation</p>
            <p className="text-sm">{member.designation}</p>
          </div>
        )}
        {member?.email && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Email</p>
            <p className="text-sm">{member.email}</p>
          </div>
        )}
        {member?.status && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Status</p>
            <p className="text-sm">{member.status}</p>
          </div>
        )}
        {member?.annual_cost > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Annual Cost</p>
            <p className="text-sm">{formatINR(member.annual_cost)}</p>
          </div>
        )}
        {member?.joining_date && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Joining Date</p>
            <p className="text-sm">{member.joining_date}</p>
          </div>
        )}
        {member?.full_name && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Reports To</p>
            <p className="text-sm">{reportsTo}</p>
          </div>
        )}
        {member?.practice && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Practice</p>
            <p className="text-sm">{member.practice}</p>
          </div>
        )}
        {member?.notes && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
            <p className="text-sm text-muted-foreground">{member.notes}</p>
          </div>
        )}
        {data?.isTier && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Members in Tier</p>
            <p className="text-sm">{data.memberCount}</p>
          </div>
        )}
      </div>
      <div className="px-6 py-4 border-t border-border">
        <button onClick={onClose} className="w-full text-sm font-medium py-2 rounded-lg border border-border hover:bg-muted transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}
