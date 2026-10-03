import React from 'react';
import { getFyMonthLabelYear } from '@/lib/fyMonths';

const HDR_BG = '#F8FAFC';

/**
 * Two-row grouped header: quarter labels spanning month columns, then month sub-headers.
 * Reused by Meetings tab (pattern from CollectionsRollupTable).
 */
export default function GroupedMonthTableHeader({
  quarterGroups = [],
  fySlug,
  leadingColSpan = 1,
  leadingLabel = '',
  trailingColCount = 0,
  stickyLeading = false,
}) {
  const monthCount = quarterGroups.reduce((n, g) => n + g.months.length, 0);

  return (
    <>
      <tr style={{ background: HDR_BG, height: 36 }}>
        {leadingColSpan > 0 && (
          <th
            rowSpan={2}
            className={`${stickyLeading ? 'sticky left-0 z-30' : ''} text-left py-3 px-4 text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border`}
            style={{ background: HDR_BG, minWidth: 180 }}
          >
            {leadingLabel}
          </th>
        )}
        {quarterGroups.map((g) => (
          <th
            key={g.key}
            colSpan={g.months.length}
            className="sticky top-0 z-20 text-center py-2 px-2 text-[11px] uppercase tracking-wider text-cbva-navy font-semibold border-l border-border/40"
            style={{ background: HDR_BG }}
          >
            {g.label}
          </th>
        ))}
        {trailingColCount > 0 && (
          <th
            rowSpan={2}
            colSpan={trailingColCount}
            className="sticky top-0 z-20 border-b border-border"
            style={{ background: HDR_BG }}
          />
        )}
      </tr>
      <tr className="[&>th]:border-b [&>th]:border-border" style={{ background: HDR_BG }}>
        {quarterGroups.flatMap((g) =>
          g.months.map((mk) => (
            <th
              key={mk}
              className="sticky z-20 text-center py-2 px-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-l border-border/40"
              style={{ background: HDR_BG, minWidth: 88, top: 36 }}
            >
              {getFyMonthLabelYear(mk, fySlug).split(' ')[0]}
            </th>
          )),
        )}
      </tr>
    </>
  );
}

export { HDR_BG };
