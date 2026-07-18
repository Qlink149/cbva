import React, { useState, useEffect } from 'react';
import { CloudSun } from 'lucide-react';
import { formatINRFull } from '@/lib/formatCurrency';

function fmtCell(val) {
  if (val === null || val === undefined || val === '') return '—';
  return formatINRFull(val);
}

function RemarkInput({ value = '', onSave, disabled }) {
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  const commit = () => {
    const next = draft.trim();
    if (next !== (value || '').trim()) {
      onSave?.(next);
    }
  };

  if (disabled) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <input
      className={`w-full min-w-[220px] text-xs border border-transparent hover:border-border rounded px-2 py-1.5 bg-transparent focus:outline-none focus:border-ring focus:bg-white transition-colors placeholder:text-slate-400 ${
        draft ? 'text-foreground' : 'text-muted-foreground'
      }`}
      placeholder="Add remark..."
      maxLength={120}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      title={draft || undefined}
    />
  );
}

function AmountCell({ value, onChange, disabled, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function startEdit() {
    if (disabled) return;
    setDraft(value != null ? String(value) : '0');
    setEditing(true);
  }

  function commit() {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0) {
      const next = Math.round(parsed);
      if (next !== (value ?? 0)) onChange?.(next);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <td className={`py-1 px-2 text-right ${className}`}>
        <input
          autoFocus
          className="w-24 ml-auto text-right text-xs border border-cbva-navy rounded px-1 py-0.5 font-tabular focus:outline-none bg-white"
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
      className={`py-3 text-right font-tabular col-num ${className} ${
        disabled ? '' : 'cursor-pointer hover:bg-muted/40 transition-colors'
      }`}
      title={disabled ? undefined : 'Click to edit'}
      onClick={startEdit}
    >
      {fmtCell(value)}
    </td>
  );
}

export default function BlueSkyTableReal({
  blueSkyRows = [],
  totals,
  fyLabel = '',
  onUpdateRemarks,
  onUpdateAmounts,
}) {
  const firstWithData = blueSkyRows.find((r) => r.has_data !== false && r.opening != null);
  const openingChip = firstWithData?.opening ?? totals?.opening;
  const canEditRow = (row) => row.has_data !== false && !!row.id && typeof onUpdateAmounts === 'function';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_15px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            <CloudSun className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Blue Sky Pipeline{fyLabel ? ` · ${fyLabel}` : ''}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
            Opening <span className="font-tabular font-semibold">{fmtCell(openingChip)}</span>
          </span>
          {totals && (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium">
                Additional <span className="font-tabular font-semibold text-cbva-navy">{fmtCell(totals.additional)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                Converted: {fmtCell(totals.converted)}
              </span>
            </>
          )}
        </div>
        {onUpdateAmounts && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Click Opening / Additional / Converted to edit · Closing is auto-calculated
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Month</th>
              <th className="text-right py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Opening</th>
              <th className="text-right py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Additional</th>
              <th className="text-right py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Converted</th>
              <th className="text-right py-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-num">Closing</th>
              <th className="text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium col-remarks">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {blueSkyRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No blue sky rows for this period</td>
              </tr>
            ) : blueSkyRows.map((row, i) => {
              const noData = row.has_data === false;
              const editable = canEditRow(row);
              return (
                <tr key={row.month_key || row.monthKey || row.month || i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 font-medium text-foreground col-num">
                    <span className="inline-flex items-center gap-2">
                      {row.month}
                      {row.is_current_month && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700">
                          Current
                        </span>
                      )}
                    </span>
                  </td>
                  <AmountCell
                    value={row.opening}
                    disabled={!editable}
                    className={noData ? 'text-muted-foreground' : 'text-muted-foreground'}
                    onChange={(v) => onUpdateAmounts?.(row, { opening: v })}
                  />
                  <AmountCell
                    value={row.additional}
                    disabled={!editable}
                    className={noData ? 'text-muted-foreground' : 'text-cbva-navy'}
                    onChange={(v) => onUpdateAmounts?.(row, { additional: v })}
                  />
                  <AmountCell
                    value={row.converted}
                    disabled={!editable}
                    className={`font-semibold ${noData ? 'text-muted-foreground' : 'text-emerald-600'}`}
                    onChange={(v) => onUpdateAmounts?.(row, { converted: v })}
                  />
                  <td className={`py-3 text-right font-tabular font-semibold col-num ${noData ? 'text-muted-foreground' : 'text-foreground'}`} title="Auto-calculated">
                    {fmtCell(row.closing)}
                  </td>
                  <td className="py-3 px-4 col-remarks">
                    <RemarkInput
                      value={row.remarks || ''}
                      disabled={noData || !row.id}
                      onSave={(remarks) => onUpdateRemarks?.(row, remarks)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {totals && blueSkyRows.length > 0 && (
            <tfoot>
              <tr className="bg-muted/30 border-t border-border">
                <td className="py-3 text-xs font-bold uppercase text-foreground col-num">Total</td>
                <td className="py-3 text-right font-tabular font-bold text-foreground col-num">{fmtCell(totals.opening)}</td>
                <td className="py-3 text-right font-tabular font-bold text-cbva-navy col-num">{fmtCell(totals.additional)}</td>
                <td className="py-3 text-right font-tabular font-bold text-emerald-700 col-num">{fmtCell(totals.converted)}</td>
                <td className="py-3 text-right font-tabular font-bold text-foreground col-num">{fmtCell(totals.closing)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
