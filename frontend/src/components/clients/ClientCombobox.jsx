import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { personNameMatchesQuery } from '@/lib/personNames';

/** Searchable client picker for action forms. */
export default function ClientCombobox({
  clients = [],
  value = '',
  onChange,
  disabled = false,
  placeholder = 'Select client *',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = useMemo(
    () => clients.find((c) => String(c.id) === String(value)),
    [clients, value],
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return clients;
    return clients.filter((c) => personNameMatchesQuery(c.name || '', q));
  }, [clients, search]);

  function close() {
    setOpen(false);
    setSearch('');
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      if (disabled) return;
      setOpen(next);
      if (!next) setSearch('');
    }}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className="w-full text-left text-xs border border-border rounded-lg px-2 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring mb-2 inline-flex items-center gap-1 disabled:opacity-50"
        >
          <span className={`truncate flex-1 ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
            {selected?.name || placeholder}
          </span>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 z-[200]" align="start">
        <div className="flex items-center gap-1.5 px-1 mb-2">
          <Search className="w-3 h-3 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="flex-1 text-xs bg-transparent outline-none"
          />
        </div>
        <div className="max-h-52 overflow-y-auto space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-[10px] text-muted-foreground px-2 py-1">No clients found</p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(String(c.id));
                close();
              }}
              className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${
                String(c.id) === String(value) ? 'bg-cbva-navy/10 text-cbva-navy font-medium' : ''
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
