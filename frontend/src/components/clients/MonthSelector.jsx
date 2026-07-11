import React, { useState, useRef, useEffect } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { FY_MONTH_KEYS, getFyMonthLabelYear } from '@/lib/fyMonths';

/**
 * Multi-select month toggle. Shows the currently selected months as chips and a
 * "+" dropdown to add/remove other FY months. `selected` is an array of month
 * keys ("04".."03"); `onChange` receives the next array (kept in FY order).
 */
export default function MonthSelector({ selected = [], onChange, fySlug }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function toggleMonth(mk) {
    const has = selected.includes(mk);
    let next = has ? selected.filter((m) => m !== mk) : [...selected, mk];
    // keep FY order and never allow an empty selection
    next = FY_MONTH_KEYS.filter((m) => next.includes(m));
    if (next.length === 0) return;
    onChange(next);
  }

  const orderedSelected = FY_MONTH_KEYS.filter((m) => selected.includes(m));

  return (
    <div className="flex items-center gap-2 flex-wrap" ref={ref}>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Months</span>
      {orderedSelected.map((mk) => (
        <span
          key={mk}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-cbva-navy/10 text-cbva-navy font-medium"
        >
          {getFyMonthLabelYear(mk, fySlug)}
          {orderedSelected.length > 1 && (
            <button
              type="button"
              onClick={() => toggleMonth(mk)}
              className="hover:text-red-500 transition-colors"
              aria-label={`Remove ${getFyMonthLabelYear(mk, fySlug)}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:border-cbva-navy hover:text-cbva-navy transition-colors"
        >
          <Plus className="w-3 h-3" /> Add month
        </button>
        {open && (
          <div className="absolute z-40 left-0 top-8 bg-white border border-border rounded-lg shadow-lg py-1 w-40 max-h-72 overflow-y-auto">
            {FY_MONTH_KEYS.map((mk) => {
              const active = selected.includes(mk);
              return (
                <button
                  key={mk}
                  type="button"
                  onClick={() => toggleMonth(mk)}
                  className="flex items-center justify-between w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                >
                  <span className={active ? 'text-cbva-navy font-medium' : 'text-foreground'}>
                    {getFyMonthLabelYear(mk, fySlug)}
                  </span>
                  {active && <Check className="w-3.5 h-3.5 text-cbva-navy" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

