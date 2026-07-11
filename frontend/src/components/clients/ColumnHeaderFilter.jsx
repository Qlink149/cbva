import React from 'react';
import { Filter, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EMPTY_FILTER, setFinancialFilter, clearFinancialFilter, setMonthFinancialFilter, clearMonthFinancialFilter, toggleFilterList } from '@/lib/engagementFilters';

function FilterIcon({ active }) {
  return (
    <Filter
      className={`w-3 h-3 shrink-0 ${active ? 'text-cbva-navy fill-cbva-navy/20' : 'text-muted-foreground/50'}`}
    />
  );
}

export function ColumnHeaderFilter({
  label,
  align = 'left',
  type,
  filterKey,
  monthKey,
  monthField,
  filters,
  setFilters,
  options = [],
  includeEmpty = false,
  className = '',
  style = {},
  onSort,
  sortIcon,
}) {
  const isActive = (() => {
    if (type === 'text') return Boolean(filters[filterKey]?.trim());
    if (type === 'multi') return (filters[filterKey]?.length || 0) > 0;
    if (type === 'range') {
      const r = filters.financials?.[filterKey];
      return r && (r.min !== '' || r.max !== '');
    }
    if (type === 'monthRange') {
      const r = filters.monthly?.[monthKey]?.[monthField];
      return r && (r.min !== '' || r.max !== '');
    }
    return false;
  })();

  function clearFilter(e) {
    e.stopPropagation();
    if (type === 'text') {
      setFilters(prev => ({ ...prev, [filterKey]: '' }));
    } else if (type === 'multi') {
      setFilters(prev => ({ ...prev, [filterKey]: [] }));
    } else if (type === 'range') {
      clearFinancialFilter(setFilters, filterKey);
    } else if (type === 'monthRange') {
      clearMonthFinancialFilter(setFilters, monthKey, monthField);
    }
  }

  return (
    <th
      className={`py-3 px-2 text-[11px] uppercase tracking-wider font-medium whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
      style={style}
      onClick={onSort}
    >
      <div className={`flex items-center gap-0.5 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <span className={isActive ? 'text-cbva-navy' : 'text-muted-foreground'}>{label}</span>
        {sortIcon}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="p-0.5 rounded hover:bg-muted/80 transition-colors"
              onClick={e => e.stopPropagation()}
              aria-label={`Filter ${label}`}
            >
              <FilterIcon active={isActive} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-56 p-3"
            align={align === 'right' ? 'end' : 'start'}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Filter {label}</p>
              {isActive && (
                <button type="button" onClick={clearFilter} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {type === 'text' && (
              <input
                autoFocus
                className="w-full text-xs border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cbva-navy"
                placeholder="Contains..."
                value={filters[filterKey] || ''}
                onChange={e => setFilters(prev => ({ ...prev, [filterKey]: e.target.value }))}
              />
            )}

            {type === 'multi' && (
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {includeEmpty && (
                  <label className="flex items-center gap-2 px-1 py-1.5 text-xs hover:bg-muted/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters[filterKey]?.includes(EMPTY_FILTER)}
                      onChange={() => setFilters(prev => ({
                        ...prev,
                        [filterKey]: toggleFilterList(prev[filterKey] || [], EMPTY_FILTER),
                      }))}
                      className="rounded border-gray-300 text-cbva-navy"
                    />
                    <span className="text-muted-foreground italic">(Empty)</span>
                  </label>
                )}
                {options.length === 0 && !includeEmpty && (
                  <p className="text-xs text-muted-foreground italic py-1">No values</p>
                )}
                {options.map(opt => (
                  <label key={opt} className="flex items-center gap-2 px-1 py-1.5 text-xs hover:bg-muted/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters[filterKey]?.includes(opt)}
                      onChange={() => setFilters(prev => ({
                        ...prev,
                        [filterKey]: toggleFilterList(prev[filterKey] || [], opt),
                      }))}
                      className="rounded border-gray-300 text-cbva-navy"
                    />
                    <span className="truncate">{opt}</span>
                  </label>
                ))}
              </div>
            )}

            {type === 'range' && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">Amount in ₹ (raw value)</p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="Min"
                    className="w-full text-xs px-2 py-1.5 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-cbva-navy"
                    value={filters.financials?.[filterKey]?.min || ''}
                    onChange={e => setFinancialFilter(setFilters, filterKey, 'min', e.target.value)}
                  />
                  <span className="text-muted-foreground text-[10px]">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    className="w-full text-xs px-2 py-1.5 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-cbva-navy"
                    value={filters.financials?.[filterKey]?.max || ''}
                    onChange={e => setFinancialFilter(setFilters, filterKey, 'max', e.target.value)}
                  />
                </div>
              </div>
            )}

            {type === 'monthRange' && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">Amount in ₹ (raw value)</p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="Min"
                    className="w-full text-xs px-2 py-1.5 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-cbva-navy"
                    value={filters.monthly?.[monthKey]?.[monthField]?.min || ''}
                    onChange={e => setMonthFinancialFilter(setFilters, monthKey, monthField, 'min', e.target.value)}
                  />
                  <span className="text-muted-foreground text-[10px]">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    className="w-full text-xs px-2 py-1.5 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-cbva-navy"
                    value={filters.monthly?.[monthKey]?.[monthField]?.max || ''}
                    onChange={e => setMonthFinancialFilter(setFilters, monthKey, monthField, 'max', e.target.value)}
                  />
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </th>
  );
}
