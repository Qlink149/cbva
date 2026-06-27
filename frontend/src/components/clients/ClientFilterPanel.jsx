import React, { useMemo, useState, useRef, useEffect } from 'react';
import { FilterX, ChevronDown } from 'lucide-react';
import {
  DEFAULT_ENGAGEMENT_FILTERS,
  countActiveEngagementFilters,
  uniqueManagers,
  toggleFilterList,
  setFinancialFilter,
  EMPTY_FILTER,
} from '@/lib/engagementFilters';
import { uniqueRelationshipPartners } from '@/lib/relationshipPartners';

export default function ClientFilterPanel({ clients, filters, setFilters }) {
  const relPartners = useMemo(() => uniqueRelationshipPartners(clients), [clients]);
  const managers = useMemo(() => uniqueManagers(clients), [clients]);

  const elStatuses = useMemo(() => {
    const s = new Set(clients.map(c => c.elStatus).filter(Boolean));
    return Array.from(s).sort();
  }, [clients]);

  function handleCatToggle(field, val) {
    setFilters(prev => ({
      ...prev,
      [field]: toggleFilterList(prev[field] || [], val),
    }));
  }

  function clearFilters() {
    setFilters(DEFAULT_ENGAGEMENT_FILTERS);
  }

  const finFields = [
    { key: 'green', label: 'Green (₹)' },
    { key: 'amber', label: 'Amber (₹)' },
    { key: 'blueSky', label: 'Blue Sky (₹)' },
    { key: 'total', label: 'Total (₹)' },
    { key: 'collected', label: 'Collected (₹)' },
    { key: 'balance', label: 'Balance (₹)' },
    { key: 'mayCol', label: 'May Col (₹)' },
    { key: 'juneCol', label: 'June Col (₹)' },
    { key: 'julyCol', label: 'July Col (₹)' },
  ];

  const totalActive = countActiveEngagementFilters(filters);

  const [partnerDropdownOpen, setPartnerDropdownOpen] = useState(false);
  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false);
  const partnerDropdownRef = useRef(null);
  const managerDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (partnerDropdownRef.current && !partnerDropdownRef.current.contains(event.target)) {
        setPartnerDropdownOpen(false);
      }
      if (managerDropdownRef.current && !managerDropdownRef.current.contains(event.target)) {
        setManagerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-5 mb-4 text-sm animate-in slide-in-from-top-2 duration-200 fade-in relative z-20">
      <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          Advanced Filters
          {totalActive > 0 && (
            <span className="inline-flex items-center justify-center bg-cbva-navy text-white text-[10px] w-5 h-5 rounded-full font-bold">
              {totalActive}
            </span>
          )}
        </h3>
        <button onClick={clearFilters} className="text-xs flex items-center gap-1.5 font-medium text-slate-500 hover:text-red-600 transition-colors">
          <FilterX className="w-3.5 h-3.5" />
          Clear All
        </button>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Client Name</p>
            <input
              className="w-full text-xs px-3 py-2 border border-border/80 rounded-md focus:outline-none focus:ring-1 focus:ring-cbva-navy"
              placeholder="Contains..."
              value={filters.name || ''}
              onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Remarks</p>
            <input
              className="w-full text-xs px-3 py-2 border border-border/80 rounded-md focus:outline-none focus:ring-1 focus:ring-cbva-navy"
              placeholder="Contains..."
              value={filters.remarks || ''}
              onChange={e => setFilters(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div ref={managerDropdownRef}>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2.5">Manager</p>
            <div className="relative">
              <div
                className="w-full text-xs px-3 py-2 border border-border/80 rounded-md bg-white cursor-pointer flex items-center justify-between shadow-sm hover:border-cbva-navy/50 transition-colors"
                onClick={() => setManagerDropdownOpen(!managerDropdownOpen)}
              >
                <span className="truncate text-foreground font-medium">
                  {filters.manager.length === 0 ? 'All managers' : `${filters.manager.length} selected`}
                </span>
                <ChevronDown className={`w-4 h-4 opacity-50 transition-transform ${managerDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
              {managerDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-border/80 rounded-md shadow-lg max-h-56 overflow-y-auto">
                  <label className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 cursor-pointer text-xs border-b border-border/40">
                    <input
                      type="checkbox"
                      checked={filters.manager.includes(EMPTY_FILTER)}
                      onChange={() => handleCatToggle('manager', EMPTY_FILTER)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-cbva-navy"
                    />
                    <span className="italic text-muted-foreground">(Empty)</span>
                  </label>
                  {managers.map(m => (
                    <label key={m} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 cursor-pointer text-xs border-b border-border/40 last:border-0">
                      <input
                        type="checkbox"
                        checked={filters.manager.includes(m)}
                        onChange={() => handleCatToggle('manager', m)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-cbva-navy"
                      />
                      <span className="truncate">{m}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div ref={partnerDropdownRef}>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2.5">Relationship Partner</p>
            <div className="relative">
              <div
                className="w-full text-xs px-3 py-2 border border-border/80 rounded-md bg-white cursor-pointer flex items-center justify-between shadow-sm hover:border-cbva-navy/50 transition-colors"
                onClick={() => setPartnerDropdownOpen(!partnerDropdownOpen)}
              >
                <span className="truncate text-foreground font-medium">
                  {filters.relPartner.length === 0 ? 'All partners' : `${filters.relPartner.length} selected`}
                </span>
                <ChevronDown className={`w-4 h-4 opacity-50 transition-transform ${partnerDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
              {partnerDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-border/80 rounded-md shadow-lg max-h-56 overflow-y-auto">
                  <label className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 cursor-pointer text-xs border-b border-border/40">
                    <input
                      type="checkbox"
                      checked={filters.relPartner.includes(EMPTY_FILTER)}
                      onChange={() => handleCatToggle('relPartner', EMPTY_FILTER)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-cbva-navy"
                    />
                    <span className="italic text-muted-foreground">(Empty)</span>
                  </label>
                  {relPartners.map(p => (
                    <label key={p} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 cursor-pointer text-xs border-b border-border/40 last:border-0">
                      <input
                        type="checkbox"
                        checked={filters.relPartner.includes(p)}
                        onChange={() => handleCatToggle('relPartner', p)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-cbva-navy"
                      />
                      <span className="truncate">{p}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2.5">EL Status</p>
            <div className="flex flex-wrap gap-2">
              {elStatuses.map(s => {
                const active = filters.elStatus.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleCatToggle('elStatus', s)}
                    className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${active ? 'bg-cbva-navy text-white border-cbva-navy' : 'bg-muted/30 text-foreground hover:bg-muted border-border/80'}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">Financial Ranges (₹)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-4">
            {finFields.map(f => {
              const active = filters.financials[f.key]?.min !== '' || filters.financials[f.key]?.max !== '';
              return (
                <div key={f.key} className="space-y-1.5">
                  <label className={`text-[10px] uppercase font-semibold ${active ? 'text-cbva-navy' : 'text-slate-500'}`}>{f.label}</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      placeholder="Min"
                      className="w-full text-xs px-2 py-1.5 border border-border/80 rounded-md focus:outline-none focus:ring-1 focus:ring-cbva-navy bg-white shadow-sm"
                      value={filters.financials[f.key]?.min || ''}
                      onChange={e => setFinancialFilter(setFilters, f.key, 'min', e.target.value)}
                    />
                    <span className="text-muted-foreground text-[10px]">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      className="w-full text-xs px-2 py-1.5 border border-border/80 rounded-md focus:outline-none focus:ring-1 focus:ring-cbva-navy bg-white shadow-sm"
                      value={filters.financials[f.key]?.max || ''}
                      onChange={e => setFinancialFilter(setFilters, f.key, 'max', e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
