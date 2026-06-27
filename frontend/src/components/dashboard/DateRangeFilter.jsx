import React, { useState } from 'react';
import { startOfMonth, startOfWeek, subMonths, startOfQuarter, subQuarters, endOfQuarter, format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';

const PRESETS = [
  { label: 'This Month', key: 'this_month' },
  { label: 'This Week', key: 'this_week' },
  { label: 'Last Quarter', key: 'last_quarter' },
  { label: 'Custom', key: 'custom' },
];

function getRange(key) {
  const now = new Date();
  if (key === 'this_month') return { from: startOfMonth(now), to: now };
  if (key === 'this_week') return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
  if (key === 'last_quarter') {
    const lq = subQuarters(now, 1);
    return { from: startOfQuarter(lq), to: endOfQuarter(lq) };
  }
  return null;
}

export default function DateRangeFilter({ value, onChange }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customRange, setCustomRange] = useState({ from: undefined, to: undefined });

  const activeKey = value?.key || 'this_month';

  const handlePreset = (key) => {
    if (key === 'custom') {
      setCustomOpen(true);
      return;
    }
    const range = getRange(key);
    onChange({ key, ...range });
  };

  const handleCustomSelect = (range) => {
    setCustomRange(range || { from: undefined, to: undefined });
    if (range?.from && range?.to) {
      onChange({ key: 'custom', from: range.from, to: range.to });
      setCustomOpen(false);
    }
  };

  const customLabel = value?.key === 'custom' && value?.from && value?.to
    ? `${format(value.from, 'dd MMM')} – ${format(value.to, 'dd MMM')}`
    : 'Custom';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PRESETS.map(({ label, key }) => {
        const isActive = activeKey === key;
        if (key === 'custom') {
          return (
            <Popover key={key} open={customOpen} onOpenChange={setCustomOpen}>
              <PopoverTrigger asChild>
                <button
                  onClick={() => handlePreset('custom')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    isActive
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
                  }`}
                >
                  <CalendarIcon className="w-3 h-3" />
                  {isActive ? customLabel : label}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={handleCustomSelect}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          );
        }
        return (
          <button
            key={key}
            onClick={() => handlePreset(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              isActive
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}