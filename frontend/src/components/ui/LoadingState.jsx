import React from 'react';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function TableSkeleton({ rows = 6, className = '' }) {
  return (
    <div className={`space-y-3 py-4 ${className}`}>
      {[...Array(rows)].map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function CardSkeleton({ className = 'h-48' }) {
  return <Skeleton className={`w-full ${className}`} />;
}

export function InlineSaving({ saving = false, children, className = '' }) {
  return (
    <div className={`relative ${saving ? 'opacity-70' : ''} ${className}`}>
      {children}
      {saving && (
        <span className="absolute right-1 top-1/2 -translate-y-1/2">
          <Loader2 className="w-3 h-3 animate-spin text-cbva-navy" />
        </span>
      )}
    </div>
  );
}

export function RefreshingBadge({ show = false, label = 'Updating…' }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground animate-pulse">
      <Loader2 className="w-3 h-3 animate-spin" />
      {label}
    </span>
  );
}

export function SectionLoadingOverlay({ show = false, label = 'Loading…' }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg">
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-cbva-navy" />
        {label}
      </span>
    </div>
  );
}
