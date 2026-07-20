import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { displayPartnerNames, relationshipPartnerList } from '@/lib/relationshipPartners';

export default function PersonMultiSelect({
  value = '',
  onChange,
  primaryOptions = [],
  otherOptions = [],
  placeholder = 'Select partners',
  compact = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [search, setSearch] = useState('');

  const selected = useMemo(() => relationshipPartnerList(value), [value]);
  const displayLabel = displayPartnerNames(value);
  const fullTitle = selected.length > 0 ? selected.join(', ') : placeholder;

  const filteredOther = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return otherOptions;
    return otherOptions.filter((name) => name.toLowerCase().includes(q));
  }, [otherOptions, search]);

  function togglePerson(name) {
    const next = selected.includes(name)
      ? selected.filter((p) => p !== name)
      : [...selected, name];
    onChange(next.join(', '));
  }

  function renderOption(name) {
    const checked = selected.includes(name);
    return (
      <label
        key={name}
        className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
      >
        <Checkbox checked={checked} onCheckedChange={() => togglePerson(name)} />
        <span className="truncate">{name}</span>
      </label>
    );
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next) {
        setShowOther(false);
        setSearch('');
      }
    }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={fullTitle}
          className={`inline-flex items-center gap-1 text-left w-full ${compact ? 'text-xs text-muted-foreground hover:bg-muted/30 rounded px-1 py-0.5' : 'text-sm border border-border rounded-lg px-2.5 py-1.5 bg-background hover:bg-muted/40'} ${className}`}
        >
          <span className="truncate flex-1">
            {selected.length > 0 ? displayLabel : <span className="text-muted-foreground/60">-</span>}
          </span>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {primaryOptions.map(renderOption)}
          {otherOptions.length > 0 && (
            <div className="border-t border-border/50 mt-1 pt-1">
              {!showOther ? (
                <button
                  type="button"
                  onClick={() => setShowOther(true)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted text-cbva-navy font-medium"
                >
                  Other…
                </button>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 px-1">
                    <Search className="w-3 h-3 text-muted-foreground" />
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search people…"
                      className="flex-1 text-xs bg-transparent outline-none"
                    />
                  </div>
                  {filteredOther.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground px-2 py-1">No matches</p>
                  ) : (
                    filteredOther.map(renderOption)
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
