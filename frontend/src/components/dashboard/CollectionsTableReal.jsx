import React, { useState, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { formatINRFull } from '@/lib/formatCurrency';
import { getCurrentMonthKey } from '@/lib/fyMonths';

function VarianceCell({ v }) {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  if (v === 0) return <span className="text-emerald-600 font-semibold">+₹0</span>;
  if (v > 0) return <span className="text-emerald-600 font-semibold">+{formatINRFull(v)}</span>;
  return <span className="text-red-600 font-semibold">({formatINRFull(Math.abs(v))})</span>;
}

function InlineNumber({ value, onSave, readOnly, placeholder = '0' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (readOnly) {
    return <span className="font-tabular">{formatINRFull(value)}</span>;
  }

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed) && parsed !== value) {
      onSave(parsed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        className="w-28 text-right font-tabular text-xs border border-primary rounded px-1.5 py-0.5 outline-none bg-white"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(String(value ?? '')); setEditing(true); }}
      className="font-tabular text-right hover:underline hover:text-primary transition-colors cursor-pointer"
      title="Click to edit"
    >
      {value ? formatINRFull(value) : <span className="text-muted-foreground/50 text-xs italic">—</span>}
    </button>
  );
}

function InlineRemark({ value, onSave, readOnly, txCount = 0 }) {
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  const commit = () => {
    const next = draft.trim();
    if (next !== (value || '').trim()) {
      onSave(next);
    }
  };

  if (readOnly) {
    return (
      <span className="text-xs text-muted-foreground">
        {value || (txCount > 0 ? `${txCount} entr${txCount === 1 ? 'y' : 'ies'}` : '—')}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <input
        className="w-full max-w-[220px] text-xs border border-transparent hover:border-border rounded px-1.5 py-0.5 bg-transparent focus:outline-none focus:border-ring focus:bg-white transition-colors text-muted-foreground placeholder:text-slate-400"
        placeholder="Add remark..."
        maxLength={120}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      {txCount > 0 && (
        <span className="block text-[10px] text-muted-foreground/70">
          {txCount} entr{txCount === 1 ? 'y' : 'ies'}
        </span>
      )}
    </div>
  );
}

export default function CollectionsTableReal({
  rows,
  totalCollected,
  tableMaxHeight,
  fyLabel = '',
  fySlug = '',
  /** @deprecated use variant="page" */
  fillHeight = false,
  variant = fillHeight ? 'page' : 'embedded',
  onUpdatePlanned,
  onUpdateCollected,
  onUpdateRemarks,
}) {
  const isPage = variant === 'page';
  const isEditable = isPage && (onUpdatePlanned || onUpdateCollected);
  const canEditRemarks = Boolean(onUpdateRemarks);
  const currentMonthKey = getCurrentMonthKey();

  // Embedded dashboard: show all elapsed months without clipping the current month
  const scrollStyle = isPage
    ? undefined
    : tableMaxHeight != null
      ? { maxHeight: tableMaxHeight, overflowY: 'auto' }
      : undefined;

  // Support both new API format (actual) and legacy format (collected) seamlessly
  const getActual = (r) => r.actual ?? r.collected ?? 0;
  const getMonthLabel = (r) => r.month_label ?? r.month ?? '';

  // YTD sums
  const ytdPlanned = rows.reduce((s, r) => s + (r.planned || 0), 0);
  const ytdCollected = rows.reduce((s, r) => s + getActual(r), 0);
  const ytdVariance = ytdCollected - ytdPlanned;

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden ${isPage ? 'w-full' : ''}`}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Wallet className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Collections{fyLabel ? ` · ${fyLabel}` : ''}
          </h3>
          {isEditable && (
            <span className="ml-2 text-[10px] text-muted-foreground/60 italic">Click any cell to edit</span>
          )}
        </div>

        {/* YTD chips */}
        <div className="flex flex-wrap gap-2">
          {isPage && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
              YTD Planned <span className="font-tabular font-semibold">{formatINRFull(ytdPlanned)}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            YTD Collected <span className="font-tabular font-semibold">{formatINRFull(ytdCollected)}</span>
          </span>
          {isPage && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-tabular ${ytdVariance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              Variance: {ytdVariance >= 0 ? '+' : ''}{formatINRFull(ytdVariance)}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        className="overflow-x-auto"
        style={scrollStyle}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Month</th>
              <th className="text-right py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">
                Planned{isEditable ? ' ✎' : ''}
              </th>
              <th className="text-right py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">
                Collected{isEditable ? ' ✎' : ''}
              </th>
              <th className="text-right py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Variance</th>
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-remarks">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const actual = getActual(row);
              const variance = row.variance ?? (actual - (row.planned || 0));
              const isCurrentMonth = row.month_key === currentMonthKey;
              return (
                <tr
                  key={row.month_key ?? i}
                  className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${isCurrentMonth ? 'bg-sky-50/80' : ''}`}
                >
                  <td className="py-3 font-medium text-foreground col-num">
                    {getMonthLabel(row)}
                    {isCurrentMonth && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-sky-700">Current</span>
                    )}
                  </td>
                  <td className="py-3 text-right col-num">
                    <InlineNumber
                      value={row.planned}
                      readOnly={!isEditable || !onUpdatePlanned}
                      onSave={(v) => onUpdatePlanned(row, v)}
                    />
                  </td>
                  <td className="py-3 text-right font-semibold col-num">
                    <InlineNumber
                      value={actual}
                      readOnly={!isEditable || !onUpdateCollected}
                      onSave={(v) => onUpdateCollected(row, v)}
                    />
                  </td>
                  <td className="py-3 text-right col-num"><VarianceCell v={variance} /></td>
                  <td className="py-3 px-4 col-remarks">
                    <InlineRemark
                      value={row.remarks || ''}
                      readOnly={!canEditRemarks}
                      txCount={row.transactions?.length || 0}
                      onSave={(remarks) => onUpdateRemarks?.(row, remarks)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 border-t border-border">
              <td className="py-3 text-xs font-bold uppercase text-foreground col-num">Total Collected</td>
              <td className="py-3 text-right text-muted-foreground col-num">—</td>
              <td className="py-3 text-right font-tabular font-bold text-foreground col-num">{formatINRFull(totalCollected ?? ytdCollected)}</td>
              <td className="py-3 text-right text-muted-foreground col-num">—</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
