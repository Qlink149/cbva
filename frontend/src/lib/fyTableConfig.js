export const ENGAGEMENT_COLUMNS = {
  base: ['num', 'name', 'manager', 'relPartner', 'elStatus', 'green', 'amber', 'blueSky', 'total', 'collected', 'balance', 'remarks'],
  monthCols: ['mayCol', 'juneCol', 'julyCol'],
};

export function hasMonthColumns(clients) {
  if (!clients?.length) return false;
  return clients.some(c => (c.mayCol || 0) > 0 || (c.juneCol || 0) > 0 || (c.julyCol || 0) > 0);
}

/** Identity columns the user can hide (T2). When visible they stay in the left sticky group. */
export const TOGGLEABLE_IDENTITY_COLUMNS = [
  { key: 'manager', label: 'Manager' },
  { key: 'relPartner', label: 'Rel. Partner' },
  { key: 'elStatus', label: 'EL Status' },
];

export const DEFAULT_COLUMN_VISIBILITY = {
  manager: true,
  relPartner: true,
  elStatus: true,
};

/** Single source of truth for engagement table column widths (T5). */
export const COL_WIDTH = {
  num: 32,
  name: 196,
  scope: 100,
  manager: 112,
  relPartner: 140,
  elStatus: 112,
  prevActualCollected: 150,
  green: 112,
  amber: 112,
  blueSky: 112,
  total: 112,
  collected: 112,
  monthSub: 80,
  balance: 112,
  remarks: 240,
  expand: 32,
};

/**
 * Ordered column spec for colgroup / minWidth / sticky offsets.
 * Hidden toggleable columns are omitted so table-layout:fixed reclaims space to the right.
 * When visible, Manager / Rel. Partner / EL Status stay in the left sticky group so
 * headers and body cannot slide over Client Name. Hide still removes them from the group.
 */
export function buildEngagementColumns({
  collectionsOpen,
  showScope,
  monthCount = 0,
  visibility = DEFAULT_COLUMN_VISIBILITY,
} = {}) {
  const vis = { ...DEFAULT_COLUMN_VISIBILITY, ...visibility };
  const cols = [];
  const push = (key, width, sticky = false) => {
    cols.push({ key, width, sticky });
  };

  push('num', COL_WIDTH.num, true);
  push('name', COL_WIDTH.name, true);
  if (showScope) push('scope', COL_WIDTH.scope, true);
  if (vis.manager) push('manager', COL_WIDTH.manager, true);
  if (vis.relPartner) push('relPartner', COL_WIDTH.relPartner, true);
  if (vis.elStatus) push('elStatus', COL_WIDTH.elStatus, true);
  push('prevActualCollected', COL_WIDTH.prevActualCollected);
  push('green', COL_WIDTH.green);
  push('amber', COL_WIDTH.amber);
  push('blueSky', COL_WIDTH.blueSky);
  push('total', COL_WIDTH.total);
  push('collected', COL_WIDTH.collected);
  if (collectionsOpen) {
    for (let i = 0; i < monthCount; i += 1) {
      push(`month-${i}-planned`, COL_WIDTH.monthSub);
      push(`month-${i}-collected`, COL_WIDTH.monthSub);
      push(`month-${i}-variance`, COL_WIDTH.monthSub);
    }
  }
  push('balance', COL_WIDTH.balance);
  push('remarks', COL_WIDTH.remarks);
  push('expand', COL_WIDTH.expand);
  return cols;
}

export function engagementTableMinWidth(cols) {
  return cols.reduce((sum, col) => sum + col.width, 0);
}

export function colVisible(cols, key) {
  return cols.some((c) => c.key === key);
}

export function colWidth(cols, key) {
  return cols.find((c) => c.key === key)?.width;
}

export function widthStyle(width, extra = {}) {
  return { minWidth: width, width, ...extra };
}

/** left offsets for the leading sticky identity block. */
export function stickyLeftMap(cols) {
  const stickyLeft = {};
  let left = 0;
  let lastStickyKey = null;
  for (const col of cols) {
    if (!col.sticky) break;
    stickyLeft[col.key] = left;
    lastStickyKey = col.key;
    left += col.width;
  }
  return { stickyLeft, lastStickyKey };
}

export const STICKY_EDGE_SHADOW_CLASS = 'shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]';
