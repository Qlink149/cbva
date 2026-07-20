import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { displayPersonName } from '@/lib/personNames';

const OTHER_VALUE = '__other__';

export default function PersonSelect({
  value = '',
  onChange,
  primaryOptions = [],
  otherOptions = [],
  placeholder = 'Select person',
  compact = false,
  className = '',
  title,
}) {
  const [open, setOpen] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [search, setSearch] = useState('');

  const displayLabel = displayPersonName(value, 'short');
  const fullTitle = title || value || placeholder;

  const filteredOther = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return otherOptions;
    return otherOptions.filter((name) => name.toLowerCase().includes(q));
  }, [otherOptions, search]);

  function selectPerson(name) {
    onChange(name);
    setOpen(false);
    setShowOther(false);
    setSearch('');
  }

  function clearSelection() {
    onChange('');
    setOpen(false);
    setShowOther(false);
    setSearch('');
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
            {value ? displayLabel : <span className="text-muted-foreground/60">-</span>}
          </span>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {primaryOptions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => selectPerson(name)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${value === name ? 'bg-cbva-navy/10 text-cbva-navy font-medium' : ''}`}
            >
              {name}
            </button>
          ))}
          {otherOptions.length > 0 && (
            <>
              {!showOther ? (
                <button
                  type="button"
                  onClick={() => setShowOther(true)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted text-cbva-navy font-medium border-t border-border/50 mt-1 pt-2"
                >
                  Other…
                </button>
              ) : (
                <div className="border-t border-border/50 mt-1 pt-2 space-y-1">
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
                    filteredOther.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => selectPerson(name)}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${value === name ? 'bg-cbva-navy/10 text-cbva-navy font-medium' : ''}`}
                      >
                        {name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
          {value && (
            <button
              type="button"
              onClick={clearSelection}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted text-muted-foreground border-t border-border/50 mt-1 pt-2"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { OTHER_VALUE };
