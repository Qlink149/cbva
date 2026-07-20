import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { displayPersonName, mergePersonOptions, namesMatch } from '@/lib/personNames';

export default function PersonSelect({
  value = '',
  onChange,
  primaryOptions = [],
  otherOptions = [],
  options: optionsProp,
  placeholder = 'Select person',
  compact = false,
  className = '',
  title,
  disabled = false,
  allowCustom = true,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customDraft, setCustomDraft] = useState('');

  const allOptions = useMemo(
    () => mergePersonOptions(
      optionsProp,
      primaryOptions,
      otherOptions,
      value,
    ),
    [optionsProp, primaryOptions, otherOptions, value],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((name) => name.toLowerCase().includes(q));
  }, [allOptions, search]);

  const displayLabel = displayPersonName(value, 'short');
  const fullTitle = title || value || placeholder;
  const trimmedCustom = customDraft.trim();
  const canUseCustom = allowCustom
    && trimmedCustom
    && !allOptions.some((name) => namesMatch(name, trimmedCustom));

  function closePopover() {
    setOpen(false);
    setSearch('');
    setCustomDraft('');
  }

  function selectPerson(name) {
    onChange(name);
    closePopover();
  }

  function clearSelection() {
    onChange('');
    closePopover();
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      if (disabled) return;
      setOpen(next);
      if (!next) {
        setSearch('');
        setCustomDraft('');
      }
    }}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          title={fullTitle}
          disabled={disabled}
          onPointerDown={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 text-left w-full ${compact ? 'text-xs text-muted-foreground hover:bg-muted/30 rounded px-1 py-0.5' : 'text-sm border border-border rounded-lg px-2.5 py-1.5 bg-background hover:bg-muted/40'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
        >
          <span className="truncate flex-1">
            {value ? displayLabel : <span className="text-muted-foreground/60">-</span>}
          </span>
          {!disabled && <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-2 z-[200]"
        align="start"
        onPointerDown={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or type a name…"
              className="flex-1 text-xs bg-transparent outline-none"
            />
          </div>
          <div className="max-h-52 overflow-y-auto space-y-0.5">
            {filtered.length === 0 && !canUseCustom && (
              <p className="text-[10px] text-muted-foreground px-2 py-1">No people found</p>
            )}
            {filtered.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => selectPerson(name)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${namesMatch(value, name) ? 'bg-cbva-navy/10 text-cbva-navy font-medium' : ''}`}
              >
                {name}
              </button>
            ))}
          </div>
          {allowCustom && (
            <div className="border-t border-border/50 pt-2 space-y-1">
              <input
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canUseCustom) {
                    e.preventDefault();
                    selectPerson(trimmedCustom);
                  }
                }}
                placeholder="Add custom name…"
                className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background"
              />
              {canUseCustom && (
                <button
                  type="button"
                  onClick={() => selectPerson(trimmedCustom)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted text-cbva-navy font-medium"
                >
                  Use &ldquo;{trimmedCustom}&rdquo;
                </button>
              )}
            </div>
          )}
          {value && (
            <button
              type="button"
              onClick={clearSelection}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted text-muted-foreground border-t border-border/50 pt-2"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
