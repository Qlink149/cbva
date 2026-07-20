import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { displayPartnerNames, relationshipPartnerList } from '@/lib/relationshipPartners';
import { mergePersonOptions, namesMatch } from '@/lib/personNames';

export default function PersonMultiSelect({
  value = '',
  onChange,
  primaryOptions = [],
  otherOptions = [],
  options: optionsProp,
  placeholder = 'Select partners',
  compact = false,
  className = '',
  disabled = false,
  allowCustom = true,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customDraft, setCustomDraft] = useState('');

  const selected = useMemo(() => relationshipPartnerList(value), [value]);
  const displayLabel = displayPartnerNames(value);
  const fullTitle = selected.length > 0 ? selected.join(', ') : placeholder;

  const allOptions = useMemo(
    () => mergePersonOptions(
      optionsProp,
      primaryOptions,
      otherOptions,
      ...selected,
    ),
    [optionsProp, primaryOptions, otherOptions, selected],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((name) => name.toLowerCase().includes(q));
  }, [allOptions, search]);

  const trimmedCustom = customDraft.trim();
  const canUseCustom = allowCustom
    && trimmedCustom
    && !allOptions.some((name) => namesMatch(name, trimmedCustom))
    && !selected.some((name) => namesMatch(name, trimmedCustom));

  function isSelected(name) {
    return selected.some((item) => namesMatch(item, name));
  }

  function togglePerson(name) {
    const next = isSelected(name)
      ? selected.filter((p) => !namesMatch(p, name))
      : [...selected, name];
    onChange(next.join(', '));
  }

  function addCustom() {
    if (!canUseCustom) return;
    onChange([...selected, trimmedCustom].join(', '));
    setCustomDraft('');
    setSearch('');
  }

  function clearAll() {
    onChange('');
    setOpen(false);
    setSearch('');
    setCustomDraft('');
  }

  function renderOption(name) {
    const checked = isSelected(name);
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
            {selected.length > 0 ? displayLabel : <span className="text-muted-foreground/60">-</span>}
          </span>
          {!disabled && <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-2 z-[200]"
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
              placeholder="Search or add partners…"
              className="flex-1 text-xs bg-transparent outline-none"
            />
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1 px-1">
              {selected.map((name) => (
                <span key={name} className="text-[10px] bg-cbva-navy/10 text-cbva-navy px-1.5 py-0.5 rounded">
                  {name}
                </span>
              ))}
            </div>
          )}
          <div className="max-h-52 overflow-y-auto space-y-0.5">
            {filtered.length === 0 && !canUseCustom && (
              <p className="text-[10px] text-muted-foreground px-2 py-1">No people found</p>
            )}
            {filtered.map(renderOption)}
          </div>
          {allowCustom && (
            <div className="border-t border-border/50 pt-2 space-y-1">
              <input
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canUseCustom) {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="Add partner not in list…"
                className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background"
              />
              {canUseCustom && (
                <button
                  type="button"
                  onClick={addCustom}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted text-cbva-navy font-medium"
                >
                  Add &ldquo;{trimmedCustom}&rdquo;
                </button>
              )}
            </div>
          )}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted text-muted-foreground border-t border-border/50 pt-2"
            >
              Clear all
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
