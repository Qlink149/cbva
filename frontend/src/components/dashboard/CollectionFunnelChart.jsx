import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatINR } from '@/lib/formatCurrency';
import { Plus, X, ChevronDown, Pencil, Check } from 'lucide-react';

const FY_MONTHS = [
  { key: '04', label: 'Apr' }, { key: '05', label: 'May' },
  { key: '06', label: 'Jun' }, { key: '07', label: 'Jul' },
  { key: '08', label: 'Aug' }, { key: '09', label: 'Sep' },
  { key: '10', label: 'Oct' }, { key: '11', label: 'Nov' },
  { key: '12', label: 'Dec' }, { key: '01', label: 'Jan' },
  { key: '02', label: 'Feb' }, { key: '03', label: 'Mar' },
];

function getCurrentMonthKey() {
  return String(new Date().getMonth() + 1).padStart(2, '0');
}

function computeCollectionStats(monthlyLines, monthKey) {
  const monthLines = monthlyLines.filter(l => {
    if (!l.month) return false;
    const d = new Date(l.month);
    return String(d.getMonth() + 1).padStart(2, '0') === monthKey;
  });

  // Only sum actual_collection from entry lines (those with engagement_id)
  const actual = monthLines
    .filter(l => l.engagement_id)
    .reduce((s, l) => s + (l.actual_collection || 0), 0);
  return { actual };
}

function CollectionBarRow({ label, sublabel, stats, scaleMax, onRemove, onGoalChange }) {
  const { expected, actual } = stats;
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');
  const effectiveMax = scaleMax || Math.max(expected, actual, 1);

  const expectedPct = effectiveMax > 0 ? (expected / effectiveMax) * 100 : 0;
  const actualPct = effectiveMax > 0 ? (actual / effectiveMax) * 100 : 0;
  const achievedPct = expected > 0 ? (actual / expected) * 100 : null;

  const color = achievedPct === null ? 'bg-slate-200'
    : achievedPct >= 100 ? 'bg-emerald-500'
    : achievedPct >= 60 ? 'bg-amber-400'
    : 'bg-red-400';

  const badgeColor = achievedPct === null ? 'bg-slate-100 text-slate-500 border-slate-200'
    : achievedPct >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : achievedPct >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-600 border-red-200';

  const startEdit = () => {
    setEditVal((expected / 100000).toFixed(2));
    setEditing(true);
  };
  const commitEdit = () => {
    const parsed = parseFloat(editVal);
    if (!isNaN(parsed) && onGoalChange) onGoalChange(parsed * 100000);
    setEditing(false);
  };

  return (
    <div className="group flex items-center gap-0 min-h-[56px]">
      {/* Label */}
      <div className="w-28 shrink-0 pr-4 text-right">
        <p className="text-[13px] font-medium text-slate-600 leading-tight truncate">{label}</p>
        {sublabel && (
          <p className="text-[10px] text-cbva-navy font-semibold uppercase tracking-wide mt-0.5">{sublabel}</p>
        )}
      </div>

      {/* Bars */}
      <div className="flex-1 relative flex flex-col justify-center gap-1 py-1">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <div key={f} className="absolute top-0 bottom-0 w-px bg-slate-100" style={{ left: `${f * 100}%` }} />
        ))}

        {/* Expected bar (ghost) */}
        <div className="relative h-3 flex items-center">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${expectedPct}%` }}
            transition={{ duration: 0.55, ease: [0.65, 0, 0.35, 1] }}
            className="h-full rounded-[3px] bg-slate-200"
            style={{ minWidth: expected > 0 ? 3 : 0 }}
            title={`Expected: ${formatINR(expected)}`}
          />
        </div>

        {/* Actual bar */}
        <div className="relative h-4 flex items-center">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${actualPct}%` }}
            transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
            className={`h-full rounded-[3px] ${color} flex items-center justify-end pr-1.5`}
            style={{ minWidth: actual > 0 ? 3 : 0 }}
            title={`Actual: ${formatINR(actual)}`}
          >
            {actualPct > 15 && (
              <span className="text-[10px] font-bold text-white/90 font-tabular select-none truncate">
                {formatINR(actual)}
              </span>
            )}
          </motion.div>
          {/* Label outside if bar is narrow */}
          {actualPct <= 15 && actual > 0 && (
            <span className="absolute text-[10px] font-tabular text-slate-500 pl-1" style={{ left: `${actualPct}%` }}>
              {formatINR(actual)}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="w-44 shrink-0 flex items-center justify-end gap-2 pl-3">
        {achievedPct !== null && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border font-tabular ${badgeColor}`}>
            {achievedPct.toFixed(0)}%
          </span>
        )}
        <div className="flex flex-col items-end">
          <span className="text-[12px] font-tabular font-bold text-slate-600 leading-tight">{formatINR(actual)}</span>
          {/* Editable goal */}
          {editing ? (
            <div className="flex items-center gap-1 mt-0.5">
              <input
                autoFocus
                className="w-16 text-[10px] border border-slate-300 rounded px-1 py-0.5 font-tabular text-slate-700 outline-none focus:border-cbva-navy"
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                placeholder="L"
              />
              <span className="text-[9px] text-slate-400">L</span>
              <button onClick={commitEdit} className="text-emerald-600 hover:text-emerald-700">
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="flex items-center gap-1 text-[10px] font-tabular text-slate-400 leading-tight hover:text-slate-700 transition-colors group/edit"
            >
              of {formatINR(expected)}
              <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
        {onRemove && (
          <button onClick={onRemove} className="opacity-0 group-hover:opacity-80 text-muted-foreground hover:text-red-500 transition-all ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function CollectionFunnelChart({ monthlyLines = [], boardTotal = 0 }) {
  const currentMonthKey = getCurrentMonthKey();
  const [extraMonths, setExtraMonths] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  // Per-month goal overrides (monthKey → amount). Falls back to boardTotal/12.
  const [goalOverrides, setGoalOverrides] = useState({});

  const defaultGoal = boardTotal > 0 ? boardTotal / 12 : 0;

  function getStatsWithGoal(rawStats, monthKey) {
    const goal = goalOverrides[monthKey] !== undefined ? goalOverrides[monthKey] : defaultGoal;
    return {
      actual: rawStats.actual,
      expected: goal,
    };
  }

  const rawCurrentStats = useMemo(
    () => computeCollectionStats(monthlyLines, currentMonthKey),
    [monthlyLines, currentMonthKey]
  );
  const currentMonthStats = getStatsWithGoal(rawCurrentStats, currentMonthKey);

  const extraRows = useMemo(() =>
    extraMonths.map(k => {
      const raw = computeCollectionStats(monthlyLines, k);
      return {
        key: k,
        label: FY_MONTHS.find(m => m.key === k)?.label || k,
        stats: raw,
      };
    }),
    [monthlyLines, extraMonths]
  );

  const currentMonthLabel = FY_MONTHS.find(m => m.key === currentMonthKey)?.label || 'Now';
  const addableMonths = FY_MONTHS.filter(m => m.key !== currentMonthKey && !extraMonths.includes(m.key));

  const setGoal = (monthKey, val) => setGoalOverrides(prev => ({ ...prev, [monthKey]: val }));

  // Scale: max of all expected/actual values shown
  const scaleMax = Math.max(
    currentMonthStats.expected,
    currentMonthStats.actual,
    ...extraRows.flatMap(r => {
      const s = getStatsWithGoal(r.stats, r.key);
      return [s.expected, s.actual];
    }),
    defaultGoal,
    1
  );

  // Axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-[13px] font-bold tracking-tight text-slate-800">Collections</h3>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-8 h-2.5 rounded-sm bg-slate-200 inline-block" />
            Expected
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-8 h-3.5 rounded-sm bg-emerald-500 inline-block" />
            Actual
          </span>
        </div>
      </div>

      <div className="px-5 pt-4 pb-2">
        {/* Axis tick labels */}
        <div className="flex items-center mb-1">
          <div className="w-28 shrink-0" />
          <div className="flex-1 flex justify-between">
            {ticks.map(f => (
              <span key={f} className="text-[10px] text-slate-400 font-tabular">
                {f === 0 ? '0' : formatINR(scaleMax * f)}
              </span>
            ))}
          </div>
          <div className="w-44 shrink-0" />
        </div>

        {/* Rows */}
        <div className="space-y-1 py-1">
          <CollectionBarRow
            label={currentMonthLabel}
            sublabel="This Month"
            stats={currentMonthStats}
            scaleMax={scaleMax}
            onGoalChange={val => setGoal(currentMonthKey, val)}
          />

          <AnimatePresence>
            {extraRows.map(({ key, label, stats }) => {
              const s = getStatsWithGoal(stats, key);
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <CollectionBarRow
                    label={label}
                    stats={s}
                    scaleMax={scaleMax}
                    onRemove={() => setExtraMonths(prev => prev.filter(k => k !== key))}
                    onGoalChange={val => setGoal(key, val)}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* X axis baseline */}
        <div className="flex items-center mt-1">
          <div className="w-28 shrink-0" />
          <div className="flex-1 border-t border-slate-300" />
          <div className="w-44 shrink-0" />
        </div>
      </div>

      {/* Add month */}
      <div className="px-4 pb-4 pt-2 relative">
        <button
          onClick={() => setShowDropdown(d => !d)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-slate-200 hover:border-cbva-navy/40 hover:bg-slate-50 transition-all text-[11px] text-slate-400 hover:text-slate-700 font-medium"
        >
          <Plus className="w-3 h-3" />
          Add month to compare
          <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.13 }}
              className="absolute bottom-full mb-1 left-4 right-4 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden"
            >
              <div className="grid grid-cols-4">
                {addableMonths.map(m => (
                  <button
                    key={m.key}
                    onClick={() => { setExtraMonths(prev => [...prev, m.key]); setShowDropdown(false); }}
                    className="px-3 py-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors text-center"
                  >
                    {m.label}
                  </button>
                ))}
                {addableMonths.length === 0 && (
                  <p className="col-span-4 text-xs text-slate-400 text-center py-3">All months added</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}