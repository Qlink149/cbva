import React from 'react';

const STATUS_STYLES = {
  Green: 'bg-status-green-bg text-status-green border-status-green/20',
  Amber: 'bg-status-amber-bg text-status-amber border-status-amber/20',
  'Blue Sky': 'bg-status-blue-bg text-status-blue border-status-blue/20',
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {status}
    </span>
  );
}